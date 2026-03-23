import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";
import Anthropic from "@anthropic-ai/sdk";

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
    const { articleIds, overwrite = false } = body as {
      articleIds?: string[];
      overwrite?: boolean;
    };

    const where: Record<string, unknown> = {};
    if (articleIds && articleIds.length > 0) {
      where.id = { in: articleIds };
    }
    if (!overwrite) {
      where.journeyPhase = null;
    }

    const articles = await prisma.editorialPlanArticle.findMany({
      where,
      select: { id: true, title: true, category: true, description: true, url: true, metaDescription: true, h1: true },
      orderBy: { createdAt: "asc" },
    });

    if (articles.length === 0) {
      return NextResponse.json({
        classified: 0,
        message: "Keine Artikel zur Klassifizierung gefunden.",
        results: [],
      });
    }

    const BATCH_SIZE = 50;
    const allResults: Array<{ id: string; phase: string; confidence: number; reason: string }> = [];

    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE);

      const articleList = batch
        .map(
          (a, idx) =>
            `${idx + 1}. [ID: ${a.id}] Titel: "${a.title}"${a.category ? ` | Kategorie: ${a.category}` : ""}${a.h1 ? ` | H1: ${a.h1}` : ""}${a.metaDescription ? ` | Meta-Description: ${a.metaDescription.substring(0, 200)}` : ""}${a.description ? ` | Beschreibung: ${a.description.substring(0, 150)}` : ""}${a.url ? ` | URL: ${a.url}` : ""}`
        )
        .join("\n");

      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `Du bist ein SEO- und Content-Strategie-Experte für Finanzthemen (Hypotheken, Vorsorge, Investing, Banking) in der Schweiz.

${JOURNEY_PHASE_DESCRIPTIONS}

Klassifiziere die folgenden Artikel in die passende Customer Journey Phase. Berücksichtige dabei den Titel, die Kategorie und die Beschreibung.

Artikel:
${articleList}

Wichtig: Viele Themen liegen an der Grenze zwischen zwei Phasen. Gib deshalb einen numerischen Konfidenz-Score (0-100) an, der widerspiegelt, wie eindeutig die Zuordnung ist:
- 85-100: Sehr eindeutig, passt klar in eine Phase
- 65-84: Ziemlich klar, aber mit leichten Überschneidungen zu einer Nachbarphase
- 45-64: Grenzfall, könnte auch in eine andere Phase passen
- 0-44: Sehr unklar, fast willkürliche Zuordnung

Antworte NUR mit einem JSON-Array im folgenden Format (keine weiteren Erklärungen):
[
  {"id": "...", "phase": "awareness|orientation|planning|product_search|closing", "confidence": 75, "reason": "Kurze Begründung (max 10 Wörter)"}
]`,
          },
        ],
      });

      const textContent = message.content.find((c) => c.type === "text");
      if (!textContent || textContent.type !== "text") continue;

      const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;

      try {
        const results = JSON.parse(jsonMatch[0]) as Array<{
          id: string;
          phase: string;
          confidence: number;
          reason: string;
        }>;

        const validPhases = ["awareness", "orientation", "planning", "product_search", "closing"];

        for (const result of results) {
          if (!validPhases.includes(result.phase)) continue;

          const articleExists = batch.find((a) => a.id === result.id);
          if (!articleExists) continue;

          const confidenceScore = Math.max(0, Math.min(100, Math.round(Number(result.confidence) || 0)));

          await prisma.editorialPlanArticle.update({
            where: { id: result.id },
            data: {
              journeyPhase: result.phase,
              journeyConfidence: confidenceScore,
            },
          });

          allResults.push({ ...result, confidence: confidenceScore });
        }
      } catch {
        console.error("Failed to parse Claude response for batch", i / BATCH_SIZE);
      }
    }

    return NextResponse.json({
      classified: allResults.length,
      total: articles.length,
      results: allResults,
    });
  } catch (error) {
    console.error("Error classifying articles:", error);
    return NextResponse.json(
      { error: "Klassifizierung fehlgeschlagen" },
      { status: 500 }
    );
  }
}
