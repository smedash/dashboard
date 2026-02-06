import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const categoryFilter = searchParams.get("category") || "";
    const days = parseInt(searchParams.get("days") || "90");

    // Hole den Tracker mit allen Keywords und Rankings
    const tracker = await prisma.rankTracker.findFirst({
      include: {
        keywords: {
          include: {
            rankings: {
              orderBy: { date: "desc" },
            },
          },
        },
      },
    });

    if (!tracker) {
      return NextResponse.json({
        keywords: [],
        stats: {
          total: 0,
          top3: 0,
          top10: 0,
          top20: 0,
          top50: 0,
          top100: 0,
          notRanking: 0,
          avgPosition: 0,
          improved: 0,
          declined: 0,
          unchanged: 0,
        },
        categoryStats: [],
        historicalTrend: [],
        topImprovers: [],
        topDecliners: [],
      });
    }

    // Filtere nach Kategorie wenn gewünscht
    let keywords = tracker.keywords;
    if (categoryFilter) {
      keywords = keywords.filter((k) => k.category === categoryFilter);
    }

    // Berechne Datum-Grenzen
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Hole erstes Ranking pro Keyword für Delta-Berechnung
    const keywordIds = keywords.map((k) => k.id);
    let firstRankings: Array<{
      keywordId: string;
      position: number | null;
      date: Date;
    }> = [];

    if (keywordIds.length > 0) {
      firstRankings = await prisma.$queryRaw<
        Array<{
          keywordId: string;
          position: number | null;
          date: Date;
        }>
      >`
        SELECT DISTINCT ON ("keywordId") "keywordId", position, date
        FROM "RankTrackerRanking"
        WHERE "keywordId" = ANY(${keywordIds})
        ORDER BY "keywordId", date ASC
      `;
    }

    const firstRankingMap = new Map(
      firstRankings.map((r) => [r.keywordId, r])
    );

    // Verarbeite Keywords
    let top3 = 0,
      top10 = 0,
      top20 = 0,
      top50 = 0,
      top100 = 0,
      notRanking = 0;
    let totalPosition = 0,
      rankingCount = 0;
    let improved = 0,
      declined = 0,
      unchanged = 0;

    const processedKeywords = keywords.map((keyword) => {
      const latestRanking = keyword.rankings[0] || null;
      const previousRanking = keyword.rankings[1] || null;
      const firstRanking = firstRankingMap.get(keyword.id) || null;

      const currentPosition = latestRanking?.position ?? null;
      const previousPosition = previousRanking?.position ?? null;
      const firstPosition = firstRanking?.position ?? null;

      // Position-Buckets
      if (currentPosition === null) {
        notRanking++;
      } else if (currentPosition <= 3) {
        top3++;
        totalPosition += currentPosition;
        rankingCount++;
      } else if (currentPosition <= 10) {
        top10++;
        totalPosition += currentPosition;
        rankingCount++;
      } else if (currentPosition <= 20) {
        top20++;
        totalPosition += currentPosition;
        rankingCount++;
      } else if (currentPosition <= 50) {
        top50++;
        totalPosition += currentPosition;
        rankingCount++;
      } else if (currentPosition <= 100) {
        top100++;
        totalPosition += currentPosition;
        rankingCount++;
      } else {
        notRanking++;
      }

      // Veränderung berechnen (niedrigere Position = besser)
      let deltaLast: number | null = null;
      let deltaStart: number | null = null;

      if (currentPosition !== null && previousPosition !== null) {
        deltaLast = previousPosition - currentPosition; // positiv = verbessert
        if (deltaLast > 0) improved++;
        else if (deltaLast < 0) declined++;
        else unchanged++;
      } else if (currentPosition !== null && previousPosition === null) {
        improved++; // Neu im Ranking
      } else if (currentPosition === null && previousPosition !== null) {
        declined++; // Aus dem Ranking gefallen
      } else {
        unchanged++;
      }

      if (currentPosition !== null && firstPosition !== null) {
        deltaStart = firstPosition - currentPosition;
      }

      // Historische Rankings (nur innerhalb des Zeitraums)
      const recentRankings = keyword.rankings
        .filter((r) => new Date(r.date) >= startDate)
        .map((r) => ({
          date: r.date,
          position: r.position,
          url: r.url,
        }));

      return {
        id: keyword.id,
        keyword: keyword.keyword,
        category: keyword.category,
        targetUrl: keyword.targetUrl,
        searchVolume: (keyword as Record<string, unknown>).searchVolume as number | null,
        currentPosition,
        previousPosition,
        firstPosition,
        deltaLast,
        deltaStart,
        latestUrl: latestRanking?.url || null,
        latestDate: latestRanking?.date || null,
        recentRankings,
      };
    });

    // Kategorie-Statistiken
    const categoryMap = new Map<
      string,
      {
        total: number;
        ranking: number;
        top10: number;
        avgPosition: number;
        positionSum: number;
        positionCount: number;
      }
    >();

    processedKeywords.forEach((kw) => {
      const cat = kw.category || "Ohne Kategorie";
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, {
          total: 0,
          ranking: 0,
          top10: 0,
          avgPosition: 0,
          positionSum: 0,
          positionCount: 0,
        });
      }
      const stats = categoryMap.get(cat)!;
      stats.total++;
      if (kw.currentPosition !== null) {
        stats.ranking++;
        stats.positionSum += kw.currentPosition;
        stats.positionCount++;
        if (kw.currentPosition <= 10) stats.top10++;
      }
    });

    const categoryStats = Array.from(categoryMap.entries()).map(
      ([category, stats]) => ({
        category,
        total: stats.total,
        ranking: stats.ranking,
        top10: stats.top10,
        avgPosition:
          stats.positionCount > 0
            ? Math.round((stats.positionSum / stats.positionCount) * 10) / 10
            : null,
      })
    );

    // Historischer Trend (tägliche Durchschnittsposition)
    const dailyPositions = new Map<
      string,
      { sum: number; count: number }
    >();

    keywords.forEach((keyword) => {
      keyword.rankings
        .filter((r) => new Date(r.date) >= startDate && r.position !== null)
        .forEach((r) => {
          const dateStr = new Date(r.date).toISOString().split("T")[0];
          if (!dailyPositions.has(dateStr)) {
            dailyPositions.set(dateStr, { sum: 0, count: 0 });
          }
          const day = dailyPositions.get(dateStr)!;
          day.sum += r.position!;
          day.count++;
        });
    });

    const historicalTrend = Array.from(dailyPositions.entries())
      .map(([date, data]) => ({
        date,
        avgPosition: Math.round((data.sum / data.count) * 10) / 10,
        keywordsTracked: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top Improvers & Decliners (nach deltaLast sortiert)
    const withDelta = processedKeywords.filter((kw) => kw.deltaLast !== null);
    const topImprovers = [...withDelta]
      .sort((a, b) => (b.deltaLast || 0) - (a.deltaLast || 0))
      .slice(0, 10)
      .filter((kw) => (kw.deltaLast || 0) > 0);

    const topDecliners = [...withDelta]
      .sort((a, b) => (a.deltaLast || 0) - (b.deltaLast || 0))
      .slice(0, 10)
      .filter((kw) => (kw.deltaLast || 0) < 0);

    return NextResponse.json({
      keywords: processedKeywords,
      stats: {
        total: keywords.length,
        top3,
        top10,
        top20,
        top50,
        top100,
        notRanking,
        avgPosition:
          rankingCount > 0
            ? Math.round((totalPosition / rankingCount) * 10) / 10
            : 0,
        improved,
        declined,
        unchanged,
      },
      categoryStats,
      historicalTrend,
      topImprovers,
      topDecliners,
    });
  } catch (error) {
    console.error("Error fetching ranking report:", error);
    return NextResponse.json(
      { error: "Failed to fetch ranking report" },
      { status: 500 }
    );
  }
}
