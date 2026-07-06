import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiRateLimiter } from "@/lib/rate-limit";

const DATAFORSEO_API_URL = "https://api.dataforseo.com/v3";

function getAuthHeader(): string {
  const login = process.env.DATAFORSEO_USERNAME;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) throw new Error("DataForSEO credentials not configured");
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
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
        { status: 429 }
      );
    }

    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL ist erforderlich" }, { status: 400 });
    }

    if (!process.env.DATAFORSEO_USERNAME || !process.env.DATAFORSEO_PASSWORD) {
      return NextResponse.json(
        { error: "DataForSEO nicht konfiguriert. Setze DATAFORSEO_USERNAME und DATAFORSEO_PASSWORD." },
        { status: 500 }
      );
    }

    const parsedUrl = new URL(url);
    const target = parsedUrl.hostname.replace(/^www\./, '');

    // Fetch backlinks summary for the target domain
    const summaryResponse = await fetch(`${DATAFORSEO_API_URL}/backlinks/summary/live`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{
        target,
        include_subdomains: true,
      }]),
    });

    if (!summaryResponse.ok) {
      throw new Error(`DataForSEO API error: ${summaryResponse.status}`);
    }

    const summaryData = await summaryResponse.json();
    const task = summaryData.tasks?.[0];

    if (!task || task.status_code !== 20000 || !task.result?.[0]) {
      return NextResponse.json(
        { error: "Keine Backlink-Daten verfügbar." },
        { status: 400 }
      );
    }

    const result = task.result[0];

    // Also get page-level data if URL is a specific page
    let pageData = null;
    if (parsedUrl.pathname && parsedUrl.pathname !== '/') {
      try {
        const pageResponse = await fetch(`${DATAFORSEO_API_URL}/backlinks/summary/live`, {
          method: "POST",
          headers: {
            Authorization: getAuthHeader(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify([{
            target: url,
            include_subdomains: false,
          }]),
        });

        if (pageResponse.ok) {
          const pageResult = await pageResponse.json();
          const pageTask = pageResult.tasks?.[0];
          if (pageTask?.status_code === 20000 && pageTask.result?.[0]) {
            pageData = pageTask.result[0];
          }
        }
      } catch {
        // Page-level data is optional
      }
    }

    return NextResponse.json({
      domain: {
        target,
        totalBacklinks: result.backlinks || 0,
        referringDomains: result.referring_domains || 0,
        referringIps: result.referring_ips || 0,
        domainRank: result.rank || 0,
        dofollowBacklinks: result.backlinks_nofollow ? (result.backlinks - result.backlinks_nofollow) : result.backlinks,
        nofollowBacklinks: result.backlinks_nofollow || 0,
      },
      page: pageData ? {
        totalBacklinks: pageData.backlinks || 0,
        referringDomains: pageData.referring_domains || 0,
        domainRank: pageData.rank || 0,
      } : null,
    });
  } catch (error) {
    console.error("[url-checker/backlinks] Error:", error);
    return NextResponse.json(
      { error: "Fehler beim Abruf der Backlink-Daten." },
      { status: 500 }
    );
  }
}
