import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiRateLimiter } from "@/lib/rate-limit";
import { proxyFetch, DEFAULT_SCRAPE_HEADERS } from "@/lib/proxy-fetch";
import { analyzeUrl } from "@/lib/url-checker";
import { UrlCheckResult } from "@/lib/url-checker/types";

async function fetchAndAnalyzeSafe(targetUrl: string): Promise<UrlCheckResult | null> {
  try {
    let response: Response;
    try {
      response = await proxyFetch(targetUrl, { headers: DEFAULT_SCRAPE_HEADERS, timeoutMs: 15000 });
    } catch {
      response = await fetch(targetUrl, { headers: DEFAULT_SCRAPE_HEADERS, signal: AbortSignal.timeout(15000), redirect: "follow" });
    }
    if (!response.ok) return null;
    const html = await response.text();
    if (!html.includes("<")) return null;
    return analyzeUrl(html, response.url || targetUrl, response.status, [], response.headers.get("last-modified"));
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success, resetIn } = apiRateLimiter.check(session.user.id);
    if (!success) {
      return NextResponse.json({ error: `Rate limit. Warte ${resetIn}s.` }, { status: 429 });
    }

    const { domain, sampleUrls } = await request.json();

    if (!domain && (!sampleUrls || !Array.isArray(sampleUrls))) {
      return NextResponse.json({ error: "domain oder sampleUrls[] erforderlich" }, { status: 400 });
    }

    // Use provided URLs or generate sample from domain
    let urls: string[] = [];
    if (sampleUrls && sampleUrls.length > 0) {
      urls = sampleUrls.slice(0, 5);
    } else if (domain) {
      const baseUrl = domain.startsWith("http") ? domain : `https://${domain}`;
      urls = [baseUrl];

      // Try common paths to get a broader sample
      const commonPaths = ["/", "/blog", "/about", "/services", "/contact"];
      for (const path of commonPaths) {
        const testUrl = new URL(path, baseUrl).href;
        if (!urls.includes(testUrl)) urls.push(testUrl);
        if (urls.length >= 5) break;
      }
    }

    const results: UrlCheckResult[] = [];
    for (const url of urls) {
      const result = await fetchAndAnalyzeSafe(url);
      if (result) results.push(result);
    }

    if (results.length === 0) {
      return NextResponse.json({ error: "Keine Seiten konnten analysiert werden." }, { status: 400 });
    }

    // Calculate site-level aggregates (NSR analog)
    const avgOverall = Math.round(results.reduce((s, r) => s + r.overallScore, 0) / results.length);

    // Category averages
    const categoryAverages: Record<string, number> = {};
    const categoryScoreSums: Record<string, number[]> = {};
    for (const result of results) {
      for (const cat of result.categories) {
        if (!categoryScoreSums[cat.name]) categoryScoreSums[cat.name] = [];
        categoryScoreSums[cat.name].push(cat.score);
      }
    }
    for (const [name, scores] of Object.entries(categoryScoreSums)) {
      categoryAverages[name] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }

    // Variance (siteRadius analog)
    const scores = results.map(r => r.overallScore);
    const mean = avgOverall;
    const variance = Math.round(Math.sqrt(scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length));

    // Focus score (how consistent are categories across pages)
    const catVariances: Record<string, number> = {};
    for (const [name, scArr] of Object.entries(categoryScoreSums)) {
      const catMean = categoryAverages[name];
      catVariances[name] = Math.round(Math.sqrt(scArr.reduce((s, v) => s + Math.pow(v - catMean, 2), 0) / scArr.length));
    }

    const siteScore = {
      domain: domain || new URL(results[0].url).hostname,
      pagesAnalyzed: results.length,
      nsrScore: avgOverall,
      siteRadius: variance,
      siteFocusScore: Math.max(0, 100 - variance * 2),
      categoryAverages,
      categoryVariance: catVariances,
      weakestCategories: Object.entries(categoryAverages)
        .sort(([, a], [, b]) => a - b)
        .slice(0, 3)
        .map(([name, score]) => ({ name, score })),
      pages: results.map(r => ({ url: r.url, score: r.overallScore })),
    };

    return NextResponse.json(siteScore);
  } catch (error) {
    console.error("[url-checker/site-score]", error);
    return NextResponse.json({ error: "Fehler bei Site-Score-Berechnung." }, { status: 500 });
  }
}
