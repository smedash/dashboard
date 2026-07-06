import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiRateLimiter } from "@/lib/rate-limit";
import { proxyFetch, DEFAULT_SCRAPE_HEADERS } from "@/lib/proxy-fetch";
import { analyzeUrl } from "@/lib/url-checker";
import { UrlCheckResult } from "@/lib/url-checker/types";

async function fetchAndAnalyzeSafe(targetUrl: string, keyword?: string): Promise<UrlCheckResult | null> {
  try {
    let response: Response;
    try {
      response = await proxyFetch(targetUrl, { headers: DEFAULT_SCRAPE_HEADERS, timeoutMs: 15000 });
    } catch (proxyErr) {
      const errMsg = proxyErr instanceof Error ? proxyErr.message : String(proxyErr);
      const errCode = proxyErr instanceof Error && 'code' in proxyErr ? (proxyErr as { code?: string }).code : '';
      console.warn(`[url-checker/competitor] Proxy failed for ${targetUrl}: ${errCode || errMsg}`);
      response = await fetch(targetUrl, { headers: DEFAULT_SCRAPE_HEADERS, signal: AbortSignal.timeout(15000), redirect: "follow" });
    }
    if (!response.ok) {
      console.warn(`[url-checker/competitor] Non-OK status ${response.status} for ${targetUrl}`);
      return null;
    }
    const html = await response.text();
    if (!html.includes("<")) {
      console.warn(`[url-checker/competitor] Response for ${targetUrl} is not HTML (${html.length} bytes)`);
      return null;
    }
    const finalUrl = response.url || targetUrl;
    const lastMod = response.headers.get("last-modified");
    return analyzeUrl(html, finalUrl, response.status, [], lastMod, keyword);
  } catch (err) {
    console.error(`[url-checker/competitor] Unexpected error for ${targetUrl}:`, err);
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

    const { url, competitorUrls, keyword } = await request.json();

    if (!url || !competitorUrls || !Array.isArray(competitorUrls) || competitorUrls.length === 0) {
      return NextResponse.json({ error: "url und competitorUrls[] sind erforderlich" }, { status: 400 });
    }

    const competitors = competitorUrls.slice(0, 3);

    // Analyze own URL
    const ownResult = await fetchAndAnalyzeSafe(url, keyword);
    if (!ownResult) {
      return NextResponse.json({ error: "Eigene URL konnte nicht analysiert werden." }, { status: 400 });
    }

    // Analyze competitors
    const competitorResults: (UrlCheckResult | { url: string; error: string })[] = [];
    for (const compUrl of competitors) {
      const result = await fetchAndAnalyzeSafe(compUrl, keyword);
      if (result) {
        competitorResults.push(result);
      } else {
        competitorResults.push({ url: compUrl, error: "Konnte nicht analysiert werden" });
      }
    }

    // Build comparison
    const comparison = {
      own: {
        url: ownResult.url,
        overallScore: ownResult.overallScore,
        categories: ownResult.categories.map(c => ({ name: c.name, score: c.score })),
      },
      competitors: competitorResults.map(r => {
        if ('error' in r) return r;
        return {
          url: r.url,
          overallScore: r.overallScore,
          categories: r.categories.map(c => ({ name: c.name, score: c.score })),
        };
      }),
      gaps: [] as { category: string; ownScore: number; avgCompetitor: number; gap: number }[],
    };

    // Calculate gaps
    const validComps = competitorResults.filter((r): r is UrlCheckResult => 'overallScore' in r);
    if (validComps.length > 0) {
      for (const ownCat of ownResult.categories) {
        const compScores = validComps.map(c => c.categories.find(cc => cc.name === ownCat.name)?.score || 0);
        const avg = Math.round(compScores.reduce((a, b) => a + b, 0) / compScores.length);
        if (avg > ownCat.score) {
          comparison.gaps.push({
            category: ownCat.name,
            ownScore: ownCat.score,
            avgCompetitor: avg,
            gap: avg - ownCat.score,
          });
        }
      }
      comparison.gaps.sort((a, b) => b.gap - a.gap);
    }

    return NextResponse.json(comparison);
  } catch (error) {
    console.error("[url-checker/competitor]", error);
    return NextResponse.json({ error: "Fehler beim Vergleich." }, { status: 500 });
  }
}
