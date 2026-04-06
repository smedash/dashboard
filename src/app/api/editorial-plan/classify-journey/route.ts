import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 300;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const JOURNEY_PHASE_DESCRIPTIONS = `
Die 5 Phasen der Customer Journey:

1. "awareness" – Bewusstsein: Emotionaler Einstieg, erster Impuls. Der Nutzer hat noch kein konkretes Ziel, sondern stößt auf ein Thema.
   Beispiele: "Miete vs. Kauf – lohnt sich Eigentum?", "Bedeutung der HHV in der Schweiz", "Warum Vorsorge wichtig ist", "Was ist ein ETF?", allgemeine Einführungsthemen, Lifestyle-Content.

2. "orientation" – Orientierung: Wissensaufbau, Grundbegriffe verstehen. Der Nutzer will das Thema verstehen.
   Beispiele: "Was ist Eigenkapital?", "Maximalbeitrag Säule 3a", "Testament erstellen", "Zinsen erklärt", "Tilgung Definition", "KfW Förderung", Glossar- und Lexikon-Inhalte, Grundlagen-Guides.

3. "planning" – Planung: Konkrete Zahlen, Rendite, Modelle, Budget & Förderung prüfen. Der Nutzer plant aktiv.
   Beispiele: "Hypothek berechnen", "Budget für Hauskauf", "Rendite berechnen", "Vorsorgelücke berechnen", "Steueroptimierung 3a", Rechner, Checklisten, Planungstools.

4. "product_search" – Produkt & Objektsuche: Immobilie suchen, bewerten, besichtigen, Vorsorgemöglichkeiten und Produkte vergleichen.
   Beispiele: "Immobilie bewerten", "Fondsvergleich", "Beste Vorsorgeprodukte", "Haus besichtigen Tipps", "ETF vs. Aktien", Produktvergleiche, Bewertungskriterien.

5. "closing" – Abschluss: Banken vergleichen, Hypotheken vergleichen, Kredit beantragen, Notar, Kauf, Wertpapierhandel.
   Beispiele: "Hypothek beantragen", "Banken vergleichen Schweiz", "Notar Hauskauf", "Depot eröffnen", "Konto eröffnen", Abschluss-Prozesse, Antragsthemen.
`;

const VALID_PHASES = ["awareness", "orientation", "planning", "product_search", "closing"];
const CLAUDE_BATCH_SIZE = 100;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [total, unclassified] = await Promise.all([
      prisma.editorialPlanArticle.count(),
      prisma.editorialPlanArticle.count({ where: { journeyPhase: null } }),
    ]);

    return NextResponse.json({ total, unclassified });
  } catch (error) {
    console.error("Error getting classification stats:", error);
    return NextResponse.json({ error: "Failed to get stats" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { articleIds, overwrite = false, limit = 500, offset = 0 } = body as {
      articleIds?: string[];
      overwrite?: boolean;
      limit?: number;
      offset?: number;
    };

    const where: Record<string, unknown> = {};
    if (articleIds && articleIds.length > 0) {
      where.id = { in: articleIds };
    }
    if (!overwrite) {
      where.journeyPhase = null;
    }

    const remaining = await prisma.editorialPlanArticle.count({ where });

    const articles = await prisma.editorialPlanArticle.findMany({
      where,
      select: { id: true, title: true, category: true, description: true, url: true, metaDescription: true, h1: true },
      orderBy: { createdAt: "asc" },
      take: Math.min(limit, 500),
      skip: offset,
    });

    if (articles.length === 0) {
      return NextResponse.json({
        classified: 0,
        remaining: 0,
        message: "Keine Artikel zur Klassifizierung gefunden.",
        results: [],
      });
    }

    const allResults: Array<{ id: string; phase: string; confidence: number; reason: string }> = [];

    for (let i = 0; i < articles.length; i += CLAUDE_BATCH_SIZE) {
      const batch = articles.slice(i, i + CLAUDE_BATCH_SIZE);

      const articleList = batch
        .map(
          (a, idx) =>
            `${idx + 1}. [ID: ${a.id}] Titel: "${a.title}"${a.category ? ` | Kategorie: ${a.category}` : ""}${a.h1 ? ` | H1: ${a.h1}` : ""}${a.metaDescription ? ` | Meta: ${a.metaDescription.substring(0, 150)}` : ""}${a.url ? ` | URL: ${a.url}` : ""}`
        )
        .join("\n");

      try {
        const message = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
          messages: [
            {
              role: "user",
              content: `Du bist ein SEO- und Content-Strategie-Experte für Finanzthemen (Hypotheken, Vorsorge, Investing, Banking) in der Schweiz.

${JOURNEY_PHASE_DESCRIPTIONS}

Klassifiziere die folgenden ${batch.length} Artikel in die passende Customer Journey Phase. Berücksichtige dabei den Titel, die Kategorie und die Beschreibung.

Artikel:
${articleList}

Konfidenz-Score (0-100):
- 85-100: Sehr eindeutig
- 65-84: Ziemlich klar
- 45-64: Grenzfall
- 0-44: Sehr unklar

Antworte NUR mit einem JSON-Array (keine weiteren Erklärungen):
[
  {"id": "...", "phase": "awareness|orientation|planning|product_search|closing", "confidence": 75, "reason": "Max 10 Wörter"}
]`,
            },
          ],
        });

        const textContent = message.content.find((c) => c.type === "text");
        if (!textContent || textContent.type !== "text") continue;

        const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) continue;

        const results = JSON.parse(jsonMatch[0]) as Array<{
          id: string;
          phase: string;
          confidence: number;
          reason: string;
        }>;

        const validResults = results.filter(
          (r) => VALID_PHASES.includes(r.phase) && batch.find((a) => a.id === r.id)
        );

        if (validResults.length > 0) {
          await prisma.$transaction(
            validResults.map((r) =>
              prisma.editorialPlanArticle.update({
                where: { id: r.id },
                data: {
                  journeyPhase: r.phase,
                  journeyConfidence: Math.max(0, Math.min(100, Math.round(Number(r.confidence) || 0))),
                },
              })
            )
          );

          allResults.push(
            ...validResults.map((r) => ({
              ...r,
              confidence: Math.max(0, Math.min(100, Math.round(Number(r.confidence) || 0))),
            }))
          );
        }
      } catch (batchError) {
        console.error(`Failed to classify batch at offset ${i}:`, batchError);
      }
    }

    const newRemaining = remaining - allResults.length;

    return NextResponse.json({
      classified: allResults.length,
      total: articles.length,
      remaining: Math.max(0, newRemaining),
      results: allResults.slice(0, 20),
    });
  } catch (error) {
    console.error("Error classifying articles:", error);
    return NextResponse.json(
      { error: "Klassifizierung fehlgeschlagen" },
      { status: 500 }
    );
  }
}
