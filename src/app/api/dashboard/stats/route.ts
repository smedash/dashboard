import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/dashboard/stats - Dashboard-Statistiken für die Startseite
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    // Alle Abfragen parallel ausführen für bessere Performance
    const [
      userCount,
      kvpCount,
      seoMaturityModels,
      briefingStats,
      rankTrackerStats,
    ] = await Promise.all([
      // Anzahl User
      prisma.user.count(),
      
      // Anzahl KVPs
      prisma.kVPUrl.count(),
      
      // Reifegradmodelle mit Details
      prisma.sEOMaturity.findMany({
        select: {
          id: true,
          name: true,
          _count: {
            select: { items: true }
          }
        },
        orderBy: { updatedAt: "desc" },
      }),
      
      // Briefing-Statistiken nach Status
      prisma.briefing.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      
      // Ranktracker Keywords mit aktuellen Rankings
      getRankTrackerStats(),
    ]);

    // Briefing-Status aufbereiten
    const briefings = {
      total: 0,
      ordered: 0,      // offen
      inProgress: 0,   // in Arbeit
      completed: 0,    // abgeschlossen
    };
    
    briefingStats.forEach((stat) => {
      const count = stat._count.status;
      briefings.total += count;
      if (stat.status === "ordered") briefings.ordered = count;
      else if (stat.status === "in_progress") briefings.inProgress = count;
      else if (stat.status === "completed") briefings.completed = count;
    });

    return NextResponse.json({
      users: {
        count: userCount,
      },
      kvp: {
        count: kvpCount,
      },
      seoMaturity: {
        count: seoMaturityModels.length,
        models: seoMaturityModels.map(m => ({
          id: m.id,
          name: m.name,
          itemCount: m._count.items,
        })),
      },
      briefings,
      rankTracker: rankTrackerStats,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Dashboard-Statistiken" },
      { status: 500 }
    );
  }
}

// Hilfsfunktion für Ranktracker-Statistiken
async function getRankTrackerStats() {
  // Hole alle Keywords mit dem neuesten Ranking
  const keywords = await prisma.rankTrackerKeyword.findMany({
    include: {
      rankings: {
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });

  const totalKeywords = keywords.length;
  
  // Positionsverteilung berechnen
  const positionBuckets = {
    top3: 0,      // Position 1-3
    top10: 0,     // Position 4-10
    top20: 0,     // Position 11-20
    top50: 0,     // Position 21-50
    beyond50: 0,  // Position > 50
    notRanking: 0, // Nicht gefunden
  };

  keywords.forEach((keyword) => {
    const latestRanking = keyword.rankings[0];
    if (!latestRanking || latestRanking.position === null) {
      positionBuckets.notRanking++;
    } else {
      const pos = latestRanking.position;
      if (pos <= 3) positionBuckets.top3++;
      else if (pos <= 10) positionBuckets.top10++;
      else if (pos <= 20) positionBuckets.top20++;
      else if (pos <= 50) positionBuckets.top50++;
      else positionBuckets.beyond50++;
    }
  });

  // Durchschnittsposition berechnen (nur für Keywords die ranken)
  const rankingKeywords = keywords.filter(
    k => k.rankings[0] && k.rankings[0].position !== null
  );
  
  const avgPosition = rankingKeywords.length > 0
    ? rankingKeywords.reduce((sum, k) => sum + (k.rankings[0].position || 0), 0) / rankingKeywords.length
    : null;

  return {
    totalKeywords,
    positionBuckets,
    avgPosition: avgPosition ? Math.round(avgPosition * 10) / 10 : null,
    rankingKeywords: rankingKeywords.length,
  };
}
