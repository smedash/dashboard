import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiRateLimiter } from "@/lib/rate-limit";
import { proxyFetch, DEFAULT_SCRAPE_HEADERS } from "@/lib/proxy-fetch";
import { analyzeUrl } from "@/lib/url-checker";
import { UrlCheckResult } from "@/lib/url-checker/types";

async function fetchAndAnalyze(
  targetUrl: string,
  keyword?: string
): Promise<UrlCheckResult> {
  const redirectChain: string[] = [];
  let finalUrl = targetUrl;

  let response: Response;
  try {
    response = await proxyFetch(finalUrl, {
      headers: DEFAULT_SCRAPE_HEADERS,
      timeoutMs: 20000,
    });
  } catch (proxyError: unknown) {
    const errCode = proxyError instanceof Error && 'code' in proxyError ? (proxyError as { code?: string }).code : '';
    const errMsg = proxyError instanceof Error ? proxyError.message : String(proxyError);
    console.warn(`[url-checker] Proxy failed for ${finalUrl}: ${errCode || errMsg}`);
    console.warn(`[url-checker] Falling back to direct fetch...`);
    response = await fetch(finalUrl, {
      headers: DEFAULT_SCRAPE_HEADERS,
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });
  }

  const statusCode = response.status;
  const lastModifiedHeader = response.headers.get("last-modified");

  if (response.url && response.url !== finalUrl) {
    redirectChain.push(finalUrl);
    finalUrl = response.url;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();

  if (html.length > 0 && html.charCodeAt(0) > 127 && !html.includes("<")) {
    throw new Error("Response ist kein valides HTML");
  }

  return analyzeUrl(html, finalUrl, statusCode, redirectChain, lastModifiedHeader, keyword || undefined);
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { success, resetIn } = apiRateLimiter.check(session.user.id);
    if (!success) {
      return NextResponse.json(
        { error: `Rate limit erreicht. Bitte warte ${resetIn} Sekunden.` },
        { status: 429, headers: { "Retry-After": String(resetIn), "X-RateLimit-Remaining": "0" } }
      );
    }

    const body = await request.json();
    const { url, urls, keyword } = body;

    // Batch mode
    if (urls && Array.isArray(urls) && urls.length > 0) {
      const batchUrls = urls.slice(0, 10); // Max 10 URLs
      const results: (UrlCheckResult | { url: string; error: string })[] = [];

      for (const batchUrl of batchUrls) {
        try {
          let parsedUrl: URL;
          try {
            parsedUrl = new URL(batchUrl);
            if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("Invalid");
          } catch {
            results.push({ url: batchUrl, error: "Ungültige URL" });
            continue;
          }
          const result = await fetchAndAnalyze(parsedUrl.href, keyword);
          results.push(result);
        } catch (err) {
          results.push({
            url: batchUrl,
            error: err instanceof Error ? err.message : "Fehler bei der Analyse",
          });
        }
      }

      return NextResponse.json({ batch: true, results, keyword: keyword || null });
    }

    // Single URL mode
    if (!url) {
      return NextResponse.json(
        { error: "URL ist erforderlich" },
        { status: 400 }
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return NextResponse.json(
        { error: "Ungültige URL. Bitte gib eine vollständige URL mit http:// oder https:// an." },
        { status: 400 }
      );
    }

    const result = await fetchAndAnalyze(parsedUrl.href, keyword);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[url-checker] Error:", error);
    return NextResponse.json(
      { error: "Fehler bei der Analyse. Bitte überprüfe die URL und versuche es erneut." },
      { status: 500 }
    );
  }
}
