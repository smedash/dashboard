import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const JOURNEY_PHASE_INFO: Record<string, { label: string; description: string }> = {
  awareness: {
    label: "Bewusstsein (Awareness)",
    description:
      "Emotionaler Einstieg, erster Impuls. Der Nutzer hat noch kein konkretes Ziel, sondern stößt auf ein Thema. Typisch: Lifestyle-Content, allgemeine Einführungen, emotionale Trigger.",
  },
  orientation: {
    label: "Orientierung (Consideration)",
    description:
      "Wissensaufbau, Grundbegriffe verstehen. Der Nutzer will das Thema verstehen. Typisch: Glossar, Lexikon, Grundlagen-Guides, Erklärungen.",
  },
  planning: {
    label: "Planung (Intent)",
    description:
      "Konkrete Zahlen, Rendite, Modelle, Budget & Förderung prüfen. Der Nutzer plant aktiv. Typisch: Rechner, Checklisten, Planungstools, Steueroptimierung.",
  },
  product_search: {
    label: "Produkt & Objektsuche (Evaluation)",
    description:
      "Immobilie suchen, bewerten, besichtigen, Produkte vergleichen. Typisch: Produktvergleiche, Bewertungskriterien, Testberichte.",
  },
  closing: {
    label: "Abschluss (Decision)",
    description:
      "Banken vergleichen, beantragen, kaufen. Typisch: Abschluss-Prozesse, Antragsthemen, Anbietvergleiche.",
  },
};

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
    const { phase, category } = body as { phase: string; category: string };

    if (!phase || !category) {
      return NextResponse.json(
        { error: "Phase und Kategorie sind erforderlich" },
        { status: 400 }
      );
    }

    const phaseInfo = JOURNEY_PHASE_INFO[phase];
    if (!phaseInfo) {
      return NextResponse.json({ error: "Ungültige Phase" }, { status: 400 });
    }

    const existingArticles = await prisma.editorialPlanArticle.findMany({
      where: {
        category,
        journeyPhase: phase,
      },
      select: { title: true, h1: true, metaDescription: true },
      orderBy: { createdAt: "asc" },
    });

    const existingTitles = existingArticles
      .map(
        (a, i) =>
          `${i + 1}. "${a.title}"${a.h1 ? ` (H1: ${a.h1})` : ""}${a.metaDescription ? ` – ${a.metaDescription.substring(0, 120)}` : ""}`
      )
      .join("\n");

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `Du bist ein SEO- und Content-Strategie-Experte für Finanzthemen in der Schweiz. Du arbeitest für eine Schweizer Bank/Finanzplattform.

Kategorie: ${category}
Customer-Journey-Phase: ${phaseInfo.label}
Phase-Beschreibung: ${phaseInfo.description}

${existingArticles.length > 0 ? `Wir haben bereits folgende ${existingArticles.length} Artikel in dieser Phase und Kategorie:
${existingTitles}

Schlage 8–12 NEUE Artikeltitel vor, die wir noch NICHT abgedeckt haben. Die Titel sollen Themen behandeln, die Besucher in der Phase "${phaseInfo.label}" für die Kategorie "${category}" typischerweise beschäftigen.` : `Wir haben noch KEINE Artikel in dieser Phase und Kategorie. Schlage 8–12 Artikeltitel vor, die Besucher in der Phase "${phaseInfo.label}" für die Kategorie "${category}" typischerweise beschäftigen.`}

Anforderungen:
- Jeder Titel soll SEO-optimiert sein (suchmaschinenfreundlich, mit relevantem Keyword)
- Die Titel sollen für den Schweizer Markt passen (CHF, Schweizer Begriffe, Schweizer Gesetze/Produkte)
- Vermeide Duplikate oder Überschneidungen mit bestehenden Titeln
- Gib zu jedem Titel eine kurze Begründung, warum er in diese Phase gehört

Antworte NUR mit einem JSON-Array im folgenden Format (keine weiteren Erklärungen):
[
  {"title": "Artikeltitel", "reason": "Kurze Begründung (1 Satz, warum dieses Thema in diese Phase gehört und relevant ist)"}
]`,
        },
      ],
    });

    const textContent = message.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json(
        { error: "Keine Antwort von der KI erhalten" },
        { status: 500 }
      );
    }

    const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "KI-Antwort konnte nicht verarbeitet werden" },
        { status: 500 }
      );
    }

    const suggestions = JSON.parse(jsonMatch[0]) as Array<{
      title: string;
      reason: string;
    }>;

    return NextResponse.json({
      suggestions,
      phase,
      category,
      existingCount: existingArticles.length,
    });
  } catch (error) {
    console.error("Error generating title suggestions:", error);
    return NextResponse.json(
      { error: "Titelvorschläge konnten nicht generiert werden" },
      { status: 500 }
    );
  }
}
