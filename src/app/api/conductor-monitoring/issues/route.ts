import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { findConductorWebsiteForDomain, getConductorIssues } from "@/lib/conductor-data";
import { getPageIssueCoverage } from "@/lib/conductor-page-issues";
import type { IssuesResponse } from "@/lib/technical-seo";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const domain = request.nextUrl.searchParams.get("domain");
    if (!domain) {
      return NextResponse.json({ error: "domain Parameter fehlt" }, { status: 400 });
    }

    const website = await findConductorWebsiteForDomain(domain);
    if (!website) {
      return NextResponse.json({ issues: [], coverage: null } satisfies IssuesResponse);
    }

    const [issues, coverage] = await Promise.all([
      getConductorIssues(website.id),
      getPageIssueCoverage(website.id),
    ]);
    return NextResponse.json({ issues, coverage } satisfies IssuesResponse);
  } catch (error) {
    console.error("[Conductor Issues]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fehler beim Laden der Conductor-Issues" },
      { status: 500 }
    );
  }
}
