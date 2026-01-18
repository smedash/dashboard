import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Rankings für eine KVP URL abrufen
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Hole KVP URL mit Subkeywords
    const kvpUrl = await prisma.kVPUrl.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        subkeywords: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!kvpUrl) {
      return NextResponse.json({ error: "KVP URL not found" }, { status: 404 });
    }

    // Hole Rank Tracker
    const tracker = await prisma.rankTracker.findFirst({
      where: { userId: session.user.id },
      include: {
        keywords: {
          where: {
            targetUrl: kvpUrl.url,
          },
        },
      },
    });

    if (!tracker) {
      return NextResponse.json({ rankings: [] });
    }

    // Sammle alle Keywords (Fokuskeyword + Subkeywords)
    const keywords = [kvpUrl.focusKeyword, ...kvpUrl.subkeywords.map(s => s.keyword)];
    
    // Finde die entsprechenden RankTrackerKeywords
    const rankKeywords = tracker.keywords.filter(k => 
      keywords.includes(k.keyword)
    );

    if (rankKeywords.length === 0) {
      return NextResponse.json({ rankings: [] });
    }

    const keywordIds = rankKeywords.map(k => k.id);

    // Hole die neuesten Rankings für diese Keywords
    const latestRankings = await Promise.all(
      keywordIds.map(async (keywordId) => {
        const ranking = await prisma.rankTrackerRanking.findFirst({
          where: { keywordId },
          orderBy: { date: "desc" },
          include: {
            keyword: {
              select: {
                keyword: true,
              },
            },
          },
        });
        return ranking;
      })
    );

    // Formatiere die Rankings
    const rankings = latestRankings
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((ranking) => ({
        keyword: ranking.keyword.keyword,
        position: ranking.position,
        url: ranking.url,
        date: ranking.date,
      }));

    return NextResponse.json({ rankings });
  } catch (error) {
    console.error("Error fetching KVP rankings:", error);
    return NextResponse.json(
      { error: "Failed to fetch rankings" },
      { status: 500 }
    );
  }
}
