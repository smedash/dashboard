import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

interface RankingKeywordInfo {
  keyword: string;
  position: number | null;
  delta?: number | null;
  deltaLast?: number | null;
  deltaStart?: number | null;
  category: string | null;
  searchVolume: number | null;
  url?: string | null;
}

interface TrafficReportInput {
  period: { startDate: string; endDate: string };
  previousPeriod: { startDate: string; endDate: string };
  current: { clicks: number; impressions: number; ctr: number; position: number };
  previous: { clicks: number; impressions: number; ctr: number; position: number };
  changes: { clicks: number; impressions: number; ctr: number; position: number };
  topKeywords: Array<{
    keyword: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  topPages: Array<{
    url: string;
    pathname: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  devices: Array<{
    device: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  directories: Array<{
    path: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    pageCount: number;
  }>;
}

interface RankingReportInput {
  stats: {
    total: number;
    top3: number;
    top10: number;
    top20: number;
    top50: number;
    top100: number;
    notRanking: number;
    avgPosition: number;
    improved: number;
    declined: number;
    unchanged: number;
  };
  categoryStats: Array<{
    category: string;
    total: number;
    ranking: number;
    top10: number;
    avgPosition: number | null;
  }>;
  topImprovers: RankingKeywordInfo[];
  topDecliners: RankingKeywordInfo[];
  topKeywords: RankingKeywordInfo[];
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, rankingData, trafficData } = body as {
      type?: string;
      rankingData?: RankingReportInput;
      trafficData?: TrafficReportInput;
    };

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API Key nicht konfiguriert" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Ranking Report
    if (type === "ranking" && rankingData) {
      return await generateRankingReport(openai, rankingData);
    }

    // Traffic Report
    if (type === "traffic" && trafficData) {
      return await generateTrafficReport(openai, trafficData);
    }

    return NextResponse.json(
      { error: "Ungültiger Report-Typ. Verwende type: 'ranking' oder 'traffic'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error generating AI report:", error);

    return NextResponse.json(
      {
        error: "Failed to generate AI report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function generateRankingReport(
  openai: OpenAI,
  data: RankingReportInput
) {
  const { stats, categoryStats, topImprovers, topDecliners, topKeywords } = data;

  const prompt = `Du bist ein SEO-Experte. Analysiere die folgenden Ranking-Daten aus unserem Ranktracker und erstelle einen umfassenden Ranking-Report auf Deutsch.

**Ranking-Übersicht:**
- Keywords gesamt: ${stats.total}
- Durchschnittliche Position: ${stats.avgPosition}
- Top 3: ${stats.top3} Keywords
- Top 4-10: ${stats.top10} Keywords  
- Top 11-20: ${stats.top20} Keywords
- Top 21-50: ${stats.top50} Keywords
- Top 51-100: ${stats.top100} Keywords
- Nicht rankend: ${stats.notRanking} Keywords

**Entwicklung seit letztem Update:**
- Verbessert: ${stats.improved} Keywords
- Verschlechtert: ${stats.declined} Keywords
- Unverändert: ${stats.unchanged} Keywords

**Performance nach Kategorie:**
${categoryStats.map((cat) => `- ${cat.category}: ${cat.total} Keywords, davon ${cat.ranking} rankend, ${cat.top10} in Top 10, Ø Position: ${cat.avgPosition ?? "n/a"}`).join("\n")}

**Top 20 Keywords (beste Positionen):**
${topKeywords.map((kw, i) => `${i + 1}. "${kw.keyword}" - Position ${kw.position}${kw.deltaLast !== null && kw.deltaLast !== undefined ? ` (Δ ${kw.deltaLast > 0 ? "+" : ""}${kw.deltaLast})` : ""}${kw.searchVolume ? `, SV: ${kw.searchVolume}` : ""}${kw.category ? ` [${kw.category}]` : ""}${kw.url ? ` → ${kw.url}` : ""}`).join("\n")}

**Top Gewinner (grösste Verbesserungen):**
${topImprovers.length > 0 ? topImprovers.map((kw, i) => `${i + 1}. "${kw.keyword}" - Position ${kw.position}, +${kw.delta || kw.deltaLast} Plätze verbessert${kw.searchVolume ? `, SV: ${kw.searchVolume}` : ""}${kw.category ? ` [${kw.category}]` : ""}`).join("\n") : "Keine Verbesserungen"}

**Top Verlierer (grösste Verschlechterungen):**
${topDecliners.length > 0 ? topDecliners.map((kw, i) => `${i + 1}. "${kw.keyword}" - Position ${kw.position}, ${kw.delta || kw.deltaLast} Plätze verschlechtert${kw.searchVolume ? `, SV: ${kw.searchVolume}` : ""}${kw.category ? ` [${kw.category}]` : ""}`).join("\n") : "Keine Verschlechterungen"}

**Aufgabe:**
Erstelle einen strukturierten Ranking-Report mit folgenden Abschnitten:
1. **Executive Summary** - Kurze Zusammenfassung der Ranking-Situation (2-3 Sätze)
2. **Ranking-Verteilung** - Analyse der Positions-Verteilung und was das für die Sichtbarkeit bedeutet
3. **Kategorie-Analyse** - Welche Kategorien performen gut, welche haben Potenzial?
4. **Gewinner & Verlierer** - Analyse der grössten Bewegungen und mögliche Ursachen
5. **Top-Keywords Bewertung** - Bewertung der wichtigsten Keywords und Quick Wins
6. **Handlungsempfehlungen** - 5-7 konkrete, priorisierte Massnahmen zur Verbesserung der Rankings
7. **Gesamtbewertung** - Ranking-Gesundheit auf einer Skala von 1-10 mit Begründung

Der Report soll professionell, datenbasiert und handlungsorientiert sein. Fokussiere auf actionable Insights.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Du bist ein erfahrener SEO-Experte, spezialisiert auf Ranking-Analysen und Keyword-Strategien. Du erstellst detaillierte und handlungsorientierte Ranking-Reports auf Deutsch.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 3000,
  });

  const aiReport =
    completion.choices[0]?.message?.content ||
    "Fehler beim Generieren des Reports";

  return NextResponse.json({
    report: aiReport,
  });
}

async function generateTrafficReport(
  openai: OpenAI,
  data: TrafficReportInput
) {
  const { period, previousPeriod, current, previous, changes, topKeywords, topPages, devices, directories } = data;

  const formatPct = (val: number) => `${val >= 0 ? "+" : ""}${val.toFixed(1)}%`;
  const deviceNames: Record<string, string> = { DESKTOP: "Desktop", MOBILE: "Mobile", TABLET: "Tablet" };

  const prompt = `Du bist ein SEO-Experte. Analysiere die folgenden Traffic-Daten aus der Google Search Console und erstelle einen umfassenden Traffic-Report auf Deutsch.

**Zeitraum:**
- Aktuell: ${period.startDate} bis ${period.endDate}
- Vorperiode: ${previousPeriod.startDate} bis ${previousPeriod.endDate}

**Traffic-Übersicht (aktuell vs. Vorperiode):**
- Klicks: ${current.clicks.toLocaleString("de-DE")} (${formatPct(changes.clicks)}, Vorperiode: ${previous.clicks.toLocaleString("de-DE")})
- Impressionen: ${current.impressions.toLocaleString("de-DE")} (${formatPct(changes.impressions)}, Vorperiode: ${previous.impressions.toLocaleString("de-DE")})
- CTR: ${(current.ctr * 100).toFixed(2)}% (${formatPct(changes.ctr)}, Vorperiode: ${(previous.ctr * 100).toFixed(2)}%)
- Ø Position: ${current.position.toFixed(1)} (${formatPct(changes.position)}, Vorperiode: ${previous.position.toFixed(1)})

**Geräte-Verteilung:**
${devices.map((d) => `- ${deviceNames[d.device] || d.device}: ${d.clicks.toLocaleString("de-DE")} Klicks, ${d.impressions.toLocaleString("de-DE")} Impr., CTR ${(d.ctr * 100).toFixed(1)}%, Pos. ${d.position.toFixed(1)}`).join("\n")}

**Top 20 Keywords:**
${topKeywords.slice(0, 20).map((kw, i) => `${i + 1}. "${kw.keyword}" - ${kw.clicks} Klicks, ${kw.impressions} Impr., CTR ${(kw.ctr * 100).toFixed(1)}%, Pos. ${kw.position.toFixed(1)}`).join("\n")}

**Top 20 Seiten:**
${topPages.slice(0, 20).map((p, i) => `${i + 1}. ${p.pathname} - ${p.clicks} Klicks, ${p.impressions} Impr., CTR ${(p.ctr * 100).toFixed(1)}%, Pos. ${p.position.toFixed(1)}`).join("\n")}

**Top Verzeichnisse:**
${directories.slice(0, 15).map((d, i) => `${i + 1}. ${d.path} - ${d.clicks} Klicks, ${d.pageCount} Seiten, CTR ${(d.ctr * 100).toFixed(1)}%, Pos. ${d.position.toFixed(1)}`).join("\n")}

**Aufgabe:**
Erstelle einen strukturierten Traffic-Report mit folgenden Abschnitten:
1. **Executive Summary** - Kurze Zusammenfassung der Traffic-Situation und Entwicklung (2-3 Sätze)
2. **Performance-Analyse** - Detaillierte Analyse der KPIs mit Vergleich zur Vorperiode, Trends bewerten
3. **Geräte-Analyse** - Wie verteilt sich der Traffic auf Geräte? Mobile-Optimierungsbedarf?
4. **Top-Content Bewertung** - Welche Seiten/Verzeichnisse performen gut? Wo gibt es Potenzial?
5. **Keyword-Analyse** - Bewertung der Top-Keywords, CTR-Potenziale und Quick Wins
6. **Handlungsempfehlungen** - 5-7 konkrete, priorisierte Massnahmen zur Traffic-Steigerung
7. **Gesamtbewertung** - Traffic-Gesundheit auf einer Skala von 1-10 mit Begründung

Der Report soll professionell, datenbasiert und handlungsorientiert sein. Fokussiere auf actionable Insights.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Du bist ein erfahrener SEO-Experte, spezialisiert auf Traffic-Analysen und organische Suchmaschinenoptimierung. Du erstellst detaillierte und handlungsorientierte Traffic-Reports auf Deutsch.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 3000,
  });

  const aiReport =
    completion.choices[0]?.message?.content ||
    "Fehler beim Generieren des Reports";

  return NextResponse.json({
    report: aiReport,
  });
}
