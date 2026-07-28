import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain");

    // Find the website (by domain match or just get first)
    const whereClause = domain
      ? { domain: { contains: domain } }
      : {};

    const website = await prisma.conductorWebsite.findFirst({
      where: whereClause,
      orderBy: { lastSyncAt: "desc" },
    });

    if (!website) {
      return NextResponse.json({ pages: {}, lastSyncAt: null });
    }

    const pages = await prisma.conductorPage.findMany({
      where: { websiteId: website.id },
      select: {
        url: true,
        health: true,
        statusCode: true,
        type: true,
        isIndexable: true,
        isInSitemap: true,
        isDisallowedInRobotsTxt: true,
        isLinked: true,
        lighthousePerformance: true,
        lighthouseLcp: true,
        lighthouseCls: true,
        lfaGoogleFrequency: true,
        lfaGoogleLastVisit: true,
        relevance: true,
        incomingInternalLinks: true,
        timeDocumentDownload: true,
        dataCapturedAt: true,
      },
    });

    // Build a URL -> data map for fast client-side lookup
    const pageMap: Record<string, (typeof pages)[number]> = {};
    for (const page of pages) {
      pageMap[page.url] = page;
    }

    return NextResponse.json({
      pages: pageMap,
      lastSyncAt: website.lastSyncAt,
      websiteName: website.name || website.domain,
    });
  } catch (error) {
    console.error("[Conductor Pages Enrichment]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fehler beim Laden der Conductor-Daten" },
      { status: 500 }
    );
  }
}
