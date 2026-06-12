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
- Keyword-Priorisierung basierend auf Suchvolumen, Difficulty und Trend-Richtung
- Content-Cluster und Topic-Empfehlungen basierend auf den Topic-Graphen
- Quick Wins (niedrige Difficulty, hohes Volumen)
- Long-Tail-Keyword-Strategien aus den generierten Fragen
- Technische SEO-Empfehlungen basierend auf den Daten`,

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
  return `Du bist ein erfahrener Marketing-Stratege für einen Schweizer Finanzdienstleister (UBS). 
Du analysierst SEO- und Marketing-Daten und erstellst daraus konkrete, umsetzbare Marketing-Strategien.

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
    "recommendations": ["Empfehlung 1", "Empfehlung 2", "Empfehlung 3", "Empfehlung 4", "Empfehlung 5"],
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
    dataContext += `## Top Keywords nach Suchvolumen\n`;
    const top20 = data.keywords.topByVolume.slice(0, 20);
    for (const kw of top20) {
      dataContext += `- "${kw.keyword}" (SV: ${kw.searchVolume}, CPC: ${kw.cpc || "n/a"}, Competition: ${kw.competition || "n/a"})\n`;
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
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: buildUserPrompt(channel as Channel, data),
        },
      ],
      system: buildSystemPrompt(),
    });

    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
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
    } catch {
      return NextResponse.json(
        { error: "KI-Antwort konnte nicht verarbeitet werden", raw: textContent.text },
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
