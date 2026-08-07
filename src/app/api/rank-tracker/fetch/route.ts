import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TARGET_DOMAIN, runRankingFetch } from "@/lib/rank-tracker";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 800; // Maximum mit Fluid Compute (ohne Fluid Compute: 300)

// POST - Rankings für alle oder ein einzelnes Keyword abrufen
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Prüfe ob nur ein bestimmtes Keyword aktualisiert werden soll
    const { searchParams } = new URL(request.url);
    const keywordId = searchParams.get("keywordId");

    // Hole Tracker mit Keywords (teamweiter Zugriff - alle User teilen sich einen Tracker)
    let tracker = await prisma.rankTracker.findFirst({
      include: {
        keywords: keywordId
          ? { where: { id: keywordId } }
          : true,
      },
    });

    if (!tracker || tracker.keywords.length === 0) {
      return NextResponse.json(
        { error: keywordId ? "Keyword nicht gefunden" : "Keine Keywords zum Tracken vorhanden" },
        { status: 400 }
      );
    }

    // Stelle sicher, dass Location auf Switzerland gesetzt ist
    if (tracker.location !== "Switzerland") {
      console.log(`[rank-tracker/fetch] Aktualisiere Location von "${tracker.location}" auf "Switzerland"`);
      tracker = await prisma.rankTracker.update({
        where: { id: tracker.id },
        data: { location: "Switzerland" },
        include: {
          keywords: keywordId
            ? { where: { id: keywordId } }
            : true,
        },
      });
    }

    console.log(`[rank-tracker/fetch] Starte Ranking-Abruf für ${tracker.keywords.length} Keywords`);
    console.log(
      `[rank-tracker/fetch] Keywords:`,
      tracker.keywords.map((k) => ({
        keyword: k.keyword,
        targetUrl: k.targetUrl || `${DEFAULT_TARGET_DOMAIN} (Standard)`,
      }))
    );

    const { savedRankings, errors } = await runRankingFetch(tracker.keywords, {
      location: tracker.location,
      language: tracker.language,
    });

    return NextResponse.json({
      success: true,
      rankings: savedRankings,
      errors: errors.length > 0 ? errors : undefined,
      message: `${savedRankings.length} Rankings erfolgreich abgerufen`,
    });
  } catch (error) {
    console.error("Error fetching rankings:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch rankings",
      },
      { status: 500 }
    );
  }
}
