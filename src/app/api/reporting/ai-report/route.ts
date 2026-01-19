import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGSCSearchAnalytics, getDateRange, getPreviousPeriodRange } from "@/lib/gsc";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { siteUrl, period } = body;

    if (!siteUrl) {
      return NextResponse.json({ error: "siteUrl is required" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API Key nicht konfiguriert" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 1. GSC Daten sammeln
    const { startDate, endDate } = getDateRange(period || "28d");
    const prevPeriod = getPreviousPeriodRange(startDate, endDate);

    // GSC Stats
    const [currentStats, previousStats] = await Promise.all([
      getGSCSearchAnalytics(session.user.id, siteUrl, {
        startDate,
        endDate,
        dimensions: ["date"],
        rowLimit: 1000,
      }),
      getGSCSearchAnalytics(session.user.id, siteUrl, {
        startDate: prevPeriod.startDate,
        endDate: prevPeriod.endDate,
        dimensions: ["date"],
        rowLimit: 1000,
      }),
    ]);

    // Top Pages
    const topPages = await getGSCSearchAnalytics(session.user.id, siteUrl, {
      startDate,
      endDate,
      dimensions: ["page"],
      rowLimit: 20,
    });

    // Top Queries
    const topQueries = await getGSCSearchAnalytics(session.user.id, siteUrl, {
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: 20,
    });

    // Berechne Totals
    const currentTotals = currentStats.rows.reduce(
      (acc, row) => ({
        clicks: acc.clicks + row.clicks,
        impressions: acc.impressions + row.impressions,
        ctr: 0,
        position: acc.position + row.position,
        count: acc.count + 1,
      }),
      { clicks: 0, impressions: 0, ctr: 0, position: 0, count: 0 }
    );

    const previousTotals = previousStats.rows.reduce(
      (acc, row) => ({
        clicks: acc.clicks + row.clicks,
        impressions: acc.impressions + row.impressions,
        ctr: 0,
        position: acc.position + row.position,
        count: acc.count + 1,
      }),
      { clicks: 0, impressions: 0, ctr: 0, position: 0, count: 0 }
    );

    const avgCurrentPosition = currentTotals.count > 0 ? currentTotals.position / currentTotals.count : 0;
    const avgPreviousPosition = previousTotals.count > 0 ? previousTotals.position / previousTotals.count : 0;
    const currentCTR = currentTotals.impressions > 0 ? currentTotals.clicks / currentTotals.impressions : 0;
    const previousCTR = previousTotals.impressions > 0 ? previousTotals.clicks / previousTotals.impressions : 0;

    // 2. Rank Tracker Daten sammeln
    const tracker = await prisma.rankTracker.findFirst({
      include: {
        keywords: {
          include: {
            rankings: {
              orderBy: { date: "desc" },
              take: 1, // Neuestes Ranking pro Keyword
            },
          },
        },
      },
    });

    let rankStats = {
      totalKeywords: 0,
      top10: 0,
      top30: 0,
      top50: 0,
      top100: 0,
      noRanking: 0,
    };

    if (tracker) {
      rankStats.totalKeywords = tracker.keywords.length;
      tracker.keywords.forEach((keyword) => {
        const latestRanking = keyword.rankings[0];
        if (!latestRanking || latestRanking.position === null) {
          rankStats.noRanking++;
        } else if (latestRanking.position <= 10) {
          rankStats.top10++;
        } else if (latestRanking.position <= 30) {
          rankStats.top30++;
        } else if (latestRanking.position <= 50) {
          rankStats.top50++;
        } else if (latestRanking.position <= 100) {
          rankStats.top100++;
        } else {
          rankStats.noRanking++;
        }
      });
    }

    // 3. KVP Daten sammeln (neue KVPs im aktuellen Monat)
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const newKVPs = await prisma.kVPUrl.count({
      where: {
        createdAt: {
          gte: firstDayOfMonth,
          lte: lastDayOfMonth,
        },
      },
    });

    const totalKVPs = await prisma.kVPUrl.count();

    // 4. Bereite Daten für OpenAI vor
    const reportData = {
      periode: {
        aktuell: {
          startDate,
          endDate,
          clicks: currentTotals.clicks,
          impressions: currentTotals.impressions,
          ctr: currentCTR,
          avgPosition: avgCurrentPosition,
        },
        vorherig: {
          startDate: prevPeriod.startDate,
          endDate: prevPeriod.endDate,
          clicks: previousTotals.clicks,
          impressions: previousTotals.impressions,
          ctr: previousCTR,
          avgPosition: avgPreviousPosition,
        },
      },
      topPages: topPages.rows.slice(0, 10).map((row) => ({
        url: row.keys[0] || "",
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })),
      topQueries: topQueries.rows.slice(0, 10).map((row) => ({
        keyword: row.keys[0] || "",
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })),
      rankTracker: rankStats,
      kvps: {
        neuDieserMonat: newKVPs,
        gesamt: totalKVPs,
      },
    };

    // 5. Generiere Prompt für OpenAI
    const prompt = `Du bist ein SEO-Experte. Analysiere die folgenden Daten und erstelle einen umfassenden SEO-Report auf Deutsch.

**Zeitraum:**
- Aktuell: ${startDate} bis ${endDate}
- Vorherig: ${prevPeriod.startDate} bis ${prevPeriod.endDate}

**Google Search Console Performance:**
- Klicks: ${currentTotals.clicks.toLocaleString("de-DE")} (Vorperiode: ${previousTotals.clicks.toLocaleString("de-DE")})
- Impressionen: ${currentTotals.impressions.toLocaleString("de-DE")} (Vorperiode: ${previousTotals.impressions.toLocaleString("de-DE")})
- CTR: ${(currentCTR * 100).toFixed(2)}% (Vorperiode: ${(previousCTR * 100).toFixed(2)}%)
- Durchschnittliche Position: ${avgCurrentPosition.toFixed(1)} (Vorperiode: ${avgPreviousPosition.toFixed(1)})

**Top-Performing URLs:**
${reportData.topPages.map((page, i) => `${i + 1}. ${page.url} - ${page.clicks} Klicks, ${page.impressions} Impressionen, Position ${page.position.toFixed(1)}`).join("\n")}

**Top-Performing Keywords:**
${reportData.topQueries.map((query, i) => `${i + 1}. ${query.keyword} - ${query.clicks} Klicks, ${query.impressions} Impressionen, Position ${query.position.toFixed(1)}`).join("\n")}

**Rank Tracker Statistiken:**
- Gesamt Keywords getrackt: ${rankStats.totalKeywords}
- Top 10 Rankings: ${rankStats.top10}
- Top 30 Rankings: ${rankStats.top30}
- Top 50 Rankings: ${rankStats.top50}
- Top 100 Rankings: ${rankStats.top100}
- Kein Ranking: ${rankStats.noRanking}

**KVP (Kontinuierlicher Verbesserungsprozess):**
- Neue KVPs diesen Monat: ${newKVPs}
- Gesamt KVPs: ${totalKVPs}

**Aufgabe:**
Erstelle einen strukturierten SEO-Report mit folgenden Abschnitten:
1. **Executive Summary** - Kurze Zusammenfassung der wichtigsten Erkenntnisse
2. **Performance-Analyse** - Detaillierte Analyse der GSC-Daten mit Vergleich zur Vorperiode
3. **Top-Performing Assets** - Analyse der besten URLs und Keywords
4. **Ranking-Status** - Bewertung der Ranking-Situation
5. **SEO-Empfehlungen** - Konkrete Handlungsempfehlungen basierend auf den Daten
6. **Bewertung** - Gesamtbewertung der SEO-Performance (1-10 Skala mit Begründung)

Der Report soll professionell, präzise und handlungsorientiert sein.`;

    // 6. Rufe OpenAI API auf
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Du bist ein erfahrener SEO-Experte, der detaillierte und handlungsorientierte SEO-Reports erstellt.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const aiReport = completion.choices[0]?.message?.content || "Fehler beim Generieren des Reports";

    return NextResponse.json({
      report: aiReport,
      data: reportData,
    });
  } catch (error) {
    console.error("Error generating AI report:", error);
    
    if (error instanceof Error && error.message === "No Google account connected") {
      return NextResponse.json(
        { error: "Google account not connected", needsConnection: true },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate AI report", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
