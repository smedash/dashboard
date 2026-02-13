import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Historische Rankings abrufen
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keywordId = searchParams.get("keywordId");
    const days = parseInt(searchParams.get("days") || "30");

    // Berechne Datum
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Hole Tracker (teamweiter Zugriff - alle User teilen sich einen Tracker)
    const tracker = await prisma.rankTracker.findFirst({
      include: {
        keywords: keywordId
          ? {
              where: { id: keywordId },
            }
          : true,
      },
    });

    if (!tracker) {
      return NextResponse.json(
        { error: "Tracker nicht gefunden" },
        { status: 404 }
      );
    }

    // Hole Rankings
    const keywordIds = tracker.keywords.map((k) => k.id);
    const rankings = await prisma.rankTrackerRanking.findMany({
      where: {
        keywordId: { in: keywordIds },
        date: { gte: startDate },
      },
      include: {
        keyword: {
          select: {
            id: true,
            keyword: true,
            targetUrl: true,
          },
        },
      },
      orderBy: [{ keywordId: "asc" }, { date: "desc" }],
    });

    return NextResponse.json({ rankings });
  } catch (error) {
    console.error("Error fetching rankings:", error);
    return NextResponse.json(
      { error: "Failed to fetch rankings" },
      { status: 500 }
    );
  }
}
