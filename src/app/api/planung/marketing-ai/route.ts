import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { aiRateLimiter } from "@/lib/rate-limit";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CHANNELS = [
  "organic_seo",
  "social_media",
  "newsletter",
  "out_of_home",
  "cooperations",
  "tv_campaigns",
] as const;

type Channel = (typeof CHANNELS)[number];

const CHANNEL_LABELS: Record<Channel, string> = {
  organic_seo: "Organic SEO",
  social_media: "Social Media",
  newsletter: "Newsletter",
  out_of_home: "Out of Home",
  cooperations: "Kooperationen & Sponsoring",
  tv_campaigns: "TV Kampagnen",
};

const CHANNEL_INSTRUCTIONS: Record<Channel, string> = {
  organic_seo: `Erstelle eine detaillierte Organic-SEO-Strategie. Fokussiere auf:
- Keyword-Priorisierung basierend auf Suchvolumen, Difficulty, Trend-Richtung UND aktueller GSC-Position
- Content-Cluster und Topic-Empfehlungen basierend auf den Topic-Graphen
- Quick Wins: Keywords mit durchschnittlicher Position zwischen 4 und 10, hohen Impressionen aber wenigen Clicks
- Long-Tail-Keyword-Strategien aus den generierten Fragen
- Technische SEO-Empfehlungen basierend auf den Daten

WICHTIGE REGELN für Keyword-Optimierungsempfehlungen:
- Empfehle NIEMALS die Optimierung von Keywords, die bereits eine durchschnittliche Position von 1 bis 3 haben. Diese ranken bereits optimal.
- Fokussiere Optimierungsempfehlungen NUR auf Keywords mit durchschnittlicher Position zwischen 4 und 15 — dort liegt das grösste Verbesserungspotenzial.
- Die "Bereits gut rankende Keywords" (Position 1-3) aus den GSC-Daten dienen nur als Kontext, NICHT als Optimierungsziel.
- Die "Optimierungschancen" (Position 4-15) sind die primären Kandidaten für Keyword-Optimierungen.
- "Low Hanging Fruits" (Position 4-10 mit hohen Impressionen) sollten höchste Priorität bekommen.
- Empfehle NUR Keywords mit mindestens 50 Suchanfragen pro Monat (Suchvolumen ≥ 50). Keywords unter diesem Schwellenwert sind nicht relevant genug.

PFLICHT — Konkrete Keywords in Empfehlungen:
- Jede Empfehlung (recommendation) MUSS konkrete Keywords mit Daten enthalten, z.B.: "Keyword 'hypothek schweiz' optimieren (Ø Position: 7.2, SV: 1'200/Monat, 890 Impressionen) — Potenzial: +500 Clicks/Monat bei Verbesserung auf Position 3"
- Jede Massnahme (action) MUSS die konkreten Ziel-Keywords benennen und das geschätzte Traffic-Potenzial quantifizieren.
- Nenne in den Empfehlungen und Massnahmen IMMER: das Keyword, die aktuelle Ø-Position, das monatliche Suchvolumen, und das geschätzte Potenzial bei Ranking-Verbesserung.
- Vermeide generische Empfehlungen ohne Keyword-Bezug. Jede Empfehlung muss an echten Daten verankert sein.`,

  social_media: `Erstelle eine Social-Media-Strategie. Fokussiere auf:
- Content-Ideen abgeleitet aus den Top-Keywords und Trending-Themen
- Empfohlene Content-Formate (Reels, Karussell, Stories, Infografiken)
- Themen-Serien basierend auf den Topic-Clustern
- Häufig gestellte Fragen als Basis für Educational Content
- Posting-Frequenz und Content-Mix-Empfehlungen`,

  newsletter: `Erstelle eine Newsletter-Strategie. Fokussiere auf:
- Themen-Vorschläge basierend auf den häufigsten Nutzer-Fragen
- Content-Serien aus den Topic-Clustern
- Segmentierungs-Empfehlungen nach Themenkategorien
- Call-to-Action-Strategien basierend auf kommerziellen Keywords
- Frequenz und optimale Versandzeiten`,

  out_of_home: `Erstelle eine Out-of-Home-Kampagnen-Strategie. Fokussiere auf:
- Kampagnen-Konzepte basierend auf den stärksten Brand-Keywords und Trending-Topics
- Standort-Empfehlungen für die Schweiz
- Saisonale Kampagnen basierend auf Trend-Daten
- Crossmedia-Verknüpfung mit digitalen Kanälen
- Plakat-Sujets und Messaging-Empfehlungen`,

  cooperations: `Erstelle eine Kooperations- und Sponsoring-Strategie. Fokussiere auf:
- Partnerschafts-Möglichkeiten basierend auf den Themen-Clustern
- Branchen und Influencer im Finanzbereich Schweiz
- Content-Kooperationen basierend auf Top-Keywords
- Event-Sponsoring-Ideen passend zu den Themen
- Co-Branding-Möglichkeiten`,

  tv_campaigns: `Erstelle eine TV-Kampagnen-Strategie. Fokussiere auf:
- Kampagnen-Konzepte basierend auf den meistgesuchten Themen und Keywords
- Storytelling-Ansätze aus den häufigsten Nutzerfragen
- Zielgruppen-Targeting basierend auf den Keyword-Kategorien
- Saisonale Timing-Empfehlungen aus Trend-Daten
- Integration mit digitalen Kanälen (Second-Screen-Strategien)`,
};

function buildSystemPrompt(): string {
  const now = new Date();
  const currentYear = now.getFullYear();
  const nextYear = currentYear + 1;

  return `Du bist ein erfahrener Marketing-Stratege für einen Schweizer Finanzdienstleister (UBS). 
Du analysierst SEO- und Marketing-Daten und erstellst daraus konkrete, umsetzbare Marketing-Strategien.

Heute ist der ${now.toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric" })}. Alle Strategien sind zukunftsgerichtet und beziehen sich auf den Zeitraum ${currentYear}/${nextYear}. Verwende NIEMALS ein vergangenes Jahr im Titel oder in Empfehlungen.

Deine Strategien sind:
- Spezifisch für den Schweizer Markt (DE/FR/IT)
- Datengetrieben und basierend auf den bereitgestellten Keyword- und Trend-Daten
- Praxisnah mit konkreten Massnahmen
- Priorisiert nach Impact und Aufwand

Antworte AUSSCHLIESSLICH mit validem JSON im folgenden Format:
{
  "title": "Kurzer, prägnanter Strategie-Titel",
  "summary": "2-3 Sätze Zusammenfassung der Kernstrategie",
  "details": {
    "goals": ["Ziel 1", "Ziel 2", "Ziel 3"],
    "targetAudience": "Beschreibung der Zielgruppe",
    "keyInsights": ["Insight aus den Daten 1", "Insight 2", "Insight 3"],
    "recommendations": ["Für SEO-Strategien: Jede Empfehlung MUSS konkrete Keywords mit Daten enthalten, z.B. 'Keyword X optimieren (Ø Pos: 7, SV: 800/Mt) — Potenzial: +300 Clicks/Mt'", "Empfehlung 2", "Empfehlung 3", "Empfehlung 4", "Empfehlung 5"],
    "timeline": "Empfohlener Umsetzungszeitraum",
    "kpis": ["KPI 1", "KPI 2", "KPI 3"]
  },
  "actions": [
    {
      "title": "Massnahme-Titel",
      "description": "Detaillierte Beschreibung der Massnahme",
      "priority": "high|medium|low",
      "effort": "low|medium|high",
      "impact": "low|medium|high"
    }
  ]
}

Generiere 5-8 konkrete Massnahmen pro Strategie. Verwende Schweizer Schreibweise (ss statt ß).`;
}

function buildUserPrompt(
  channel: Channel,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
): string {
  const channelLabel = CHANNEL_LABELS[channel];
  const instructions = CHANNEL_INSTRUCTIONS[channel];

  let dataContext = `# Datenkontext für ${channelLabel}\n\n`;

  if (data.summary) {
    dataContext += `## Übersicht\n`;
    dataContext += `- ${data.summary.totalTopicGraphs} Topic-Graphen analysiert\n`;
    dataContext += `- ${data.summary.totalQuestionSets} Fragen-Sets generiert\n`;
    dataContext += `- ${data.summary.totalKeywordVolumes} Keyword-Volumen gecacht\n`;
    dataContext += `- ${data.summary.totalTrends} Trend-Datenpunkte\n`;
    dataContext += `- ${data.summary.totalIntents} Search-Intent-Datenpunkte\n`;
    dataContext += `- Kategorien: ${data.summary.categories?.join(", ") || "keine"}\n\n`;
  }

  if (data.keywords?.topByVolume?.length > 0) {
    dataContext += `## Top Keywords nach Suchvolumen (nur SV ≥ 50)\n`;
    const filtered = data.keywords.topByVolume.filter((kw: { searchVolume: number }) => kw.searchVolume >= 50);
    const top20 = filtered.slice(0, 20);
    for (const kw of top20) {
      dataContext += `- "${kw.keyword}" (SV: ${kw.searchVolume}/Monat, CPC: ${kw.cpc || "n/a"}, Competition: ${kw.competition || "n/a"})\n`;
    }
    dataContext += "\n";
  }

  if (data.gscPositions?.alreadyRanking?.length > 0) {
    dataContext += `## Bereits gut rankende Keywords (Position 1-3) — NICHT optimieren!\n`;
    dataContext += `Diese Keywords ranken bereits optimal. Keine Optimierung empfehlen.\n`;
    for (const kw of data.gscPositions.alreadyRanking) {
      const svInfo = kw.searchVolume ? `, SV: ${kw.searchVolume}/Monat` : "";
      dataContext += `- "${kw.keyword}" (Ø Position: ${kw.position}, Clicks: ${kw.clicks}, Impressionen: ${kw.impressions}${svInfo})\n`;
    }
    dataContext += "\n";
  }

  if (data.gscPositions?.lowHangingFruit?.length > 0) {
    dataContext += `## Low Hanging Fruits (Position 4-10, SV ≥ 50, hohe Impressionen) — HÖCHSTE PRIORITÄT für Optimierung\n`;
    dataContext += `Diese Keywords haben das grösste Optimierungspotenzial. Nutze diese für konkrete Empfehlungen mit Keyword, Position, SV und geschätztem Traffic-Potenzial.\n`;
    for (const kw of data.gscPositions.lowHangingFruit) {
      const svInfo = kw.searchVolume ? `SV: ${kw.searchVolume}/Monat, ` : "";
      const cpcInfo = kw.cpc ? `CPC: CHF ${kw.cpc}, ` : "";
      dataContext += `- "${kw.keyword}" (Ø Position: ${kw.position}, ${svInfo}${cpcInfo}Clicks: ${kw.clicks}, Impressionen: ${kw.impressions})\n`;
    }
    dataContext += "\n";
  }

  if (data.gscPositions?.optimizationOpportunities?.length > 0) {
    dataContext += `## Weitere Optimierungschancen (Position 4-15, SV ≥ 50) — hier optimieren\n`;
    dataContext += `Nutze diese Keywords für konkrete Empfehlungen. Nenne immer das Keyword, die Ø-Position, das SV und das geschätzte Potenzial.\n`;
    for (const kw of data.gscPositions.optimizationOpportunities) {
      const svInfo = kw.searchVolume ? `SV: ${kw.searchVolume}/Monat, ` : "";
      const cpcInfo = kw.cpc ? `CPC: CHF ${kw.cpc}, ` : "";
      dataContext += `- "${kw.keyword}" (Ø Position: ${kw.position}, ${svInfo}${cpcInfo}Clicks: ${kw.clicks}, Impressionen: ${kw.impressions})\n`;
    }
    dataContext += "\n";
  }

  if (data.gscInsights?.intentDistribution?.length > 0) {
    dataContext += `## Search Intent Verteilung\n`;
    for (const intent of data.gscInsights.intentDistribution) {
      dataContext += `- ${intent.label}: ${intent.count} Keywords\n`;
    }
    dataContext += "\n";
  }

  if (data.gscInsights?.trendDistribution?.length > 0) {
    dataContext += `## Trend-Richtungen\n`;
    for (const trend of data.gscInsights.trendDistribution) {
      dataContext += `- ${trend.direction}: ${trend.count} Keywords\n`;
    }
    dataContext += "\n";
  }

  if (data.topics?.length > 0) {
    dataContext += `## Topic-Cluster (Top 10)\n`;
    const topTopics = data.topics.slice(0, 10);
    for (const topic of topTopics) {
      dataContext += `- "${topic.keyword}" (${topic.totalTopics} Subtopics)`;
      if (topic.topSubtopics?.length > 0) {
        dataContext += `: ${topic.topSubtopics.join(", ")}`;
      }
      dataContext += "\n";
    }
    dataContext += "\n";
  }

  if (data.questions?.length > 0) {
    dataContext += `## Häufig gestellte Fragen (Auswahl)\n`;
    const topQuestions = data.questions.slice(0, 10);
    for (const q of topQuestions) {
      if (q.topQuestions?.length > 0) {
        dataContext += `### ${q.keyword}\n`;
        for (const question of q.topQuestions.slice(0, 3)) {
          dataContext += `- ${question}\n`;
        }
      }
    }
    dataContext += "\n";
  }

  if (data.seedKeywords?.length > 0) {
    dataContext += `## Seed-Keywords nach Kategorie\n`;
    for (const cat of data.seedKeywords) {
      dataContext += `- ${cat.category}: ${cat.keywords.length} Keywords (z.B. ${cat.keywords.slice(0, 5).join(", ")})\n`;
    }
    dataContext += "\n";
  }

  return `${instructions}\n\n${dataContext}\nErstelle jetzt die ${channelLabel}-Strategie basierend auf diesen Daten. Antworte ausschliesslich mit validem JSON.`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel");

    const where = channel ? { channel } : {};

    const strategies = await prisma.marketingStrategy.findMany({
      where,
      include: {
        actions: {
          orderBy: [
            { priority: "asc" },
            { createdAt: "asc" },
          ],
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const latestByChannel = new Map<string, typeof strategies[0]>();
    for (const strategy of strategies) {
      if (!latestByChannel.has(strategy.channel)) {
        latestByChannel.set(strategy.channel, strategy);
      }
    }

    return NextResponse.json({
      strategies: Array.from(latestByChannel.values()),
      allStrategies: strategies,
    });
  } catch (error) {
    console.error("Marketing AI GET error:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Strategien" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = aiRateLimiter.check(session.user.id);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: `Rate limit erreicht. Bitte warte ${rateLimit.resetIn} Sekunden.` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { channel, period } = body;

    if (!channel || !CHANNELS.includes(channel)) {
      return NextResponse.json(
        { error: `Ungültiger Kanal. Erlaubt: ${CHANNELS.join(", ")}` },
        { status: 400 }
      );
    }

    const dataResponse = await fetch(
      new URL("/api/planung/marketing-ai/data", request.url),
      {
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      }
    );

    if (!dataResponse.ok) {
      return NextResponse.json(
        { error: "Fehler beim Laden der Daten für die Analyse" },
        { status: 500 }
      );
    }

    const data = await dataResponse.json();

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16384,
      messages: [
        {
          role: "user",
          content: buildUserPrompt(channel as Channel, data),
        },
      ],
      system: buildSystemPrompt(),
    });

    if (message.stop_reason === "max_tokens") {
      console.error("Marketing AI: Response was truncated (max_tokens reached)");
    }

    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      console.error("Marketing AI: No text content in response. Content types:", message.content.map((c) => c.type));
      return NextResponse.json(
        { error: "Keine Antwort von der KI erhalten" },
        { status: 500 }
      );
    }

    let parsed: {
      title: string;
      summary: string;
      details: Record<string, unknown>;
      actions: {
        title: string;
        description: string;
        priority?: string;
        effort?: string;
        impact?: string;
      }[];
    };

    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Kein JSON-Objekt gefunden");
      }
      parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.title || !parsed.summary || !parsed.actions) {
        throw new Error("Unvollständige Strategie-Struktur");
      }
    } catch (parseErr) {
      console.error("Marketing AI JSON parse error:", parseErr);
      console.error("Marketing AI raw response (first 500 chars):", textContent.text.substring(0, 500));
      console.error("Marketing AI stop_reason:", message.stop_reason);
      return NextResponse.json(
        { error: "KI-Antwort konnte nicht verarbeitet werden", raw: textContent.text.substring(0, 1000) },
        { status: 500 }
      );
    }

    const strategy = await prisma.marketingStrategy.create({
      data: {
        channel,
        title: parsed.title,
        summary: parsed.summary,
        details: parsed.details as Record<string, unknown> as Parameters<typeof prisma.marketingStrategy.create>[0]["data"]["details"],
        period: period || null,
        dataContext: {
          generatedAt: new Date().toISOString(),
          dataPoints: {
            topicGraphs: data.summary?.totalTopicGraphs || 0,
            questionSets: data.summary?.totalQuestionSets || 0,
            keywordVolumes: data.summary?.totalKeywordVolumes || 0,
            trends: data.summary?.totalTrends || 0,
            intents: data.summary?.totalIntents || 0,
          },
        },
        actions: {
          create: parsed.actions.map((action) => ({
            title: action.title,
            description: action.description,
            priority: action.priority || "medium",
            effort: action.effort || null,
            impact: action.impact || null,
          })),
        },
      },
      include: {
        actions: true,
      },
    });

    return NextResponse.json(strategy);
  } catch (error) {
    console.error("Marketing AI POST error:", error);
    return NextResponse.json(
      { error: "Interner Serverfehler bei der Strategie-Generierung" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { actionId, completed } = body;

    if (!actionId || typeof completed !== "boolean") {
      return NextResponse.json(
        { error: "actionId und completed sind erforderlich" },
        { status: 400 }
      );
    }

    const action = await prisma.marketingAction.update({
      where: { id: actionId },
      data: { completed },
    });

    return NextResponse.json(action);
  } catch (error) {
    console.error("Marketing AI PATCH error:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren" },
      { status: 500 }
    );
  }
}
