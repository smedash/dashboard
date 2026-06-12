import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { aiRateLimiter } from "@/lib/rate-limit";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CHANNEL_LABELS: Record<string, string> = {
  organic_seo: "Organic SEO",
  social_media: "Social Media",
  newsletter: "Newsletter",
  out_of_home: "Out of Home",
  cooperations: "Kooperationen & Sponsoring",
  tv_campaigns: "TV Kampagnen",
};

function buildRefineSystemPrompt(channelLabel: string): string {
  return `Du bist ein erfahrener Marketing-Stratege für einen Schweizer Finanzdienstleister (UBS).
Du arbeitest im Kanal "${channelLabel}" und verfeinerst eine bestehende Marketing-Strategie basierend auf dem Feedback eines Marketing-Experten.

Deine Aufgabe:
- Gehe konkret auf das Feedback ein
- Passe die bestehende Strategie gezielt an — NICHT komplett neu erstellen
- Erkläre kurz, welche Änderungen du vorschlägst und warum
- Behalte alle Teile bei, die nicht vom Feedback betroffen sind

Wenn der Experte nach Änderungen an der Strategie fragt, antworte mit einer natürlichen Antwort UND einem JSON-Block mit den Änderungen.

Formatiere deine Antwort so:
1. Zuerst eine natürliche Erklärung deiner vorgeschlagenen Änderungen
2. Dann ein JSON-Block (mit \`\`\`json ... \`\`\` Markdown-Fencing) mit den aktualisierten Feldern:

\`\`\`json
{
  "updatedFields": {
    "title": "Nur wenn geändert",
    "summary": "Nur wenn geändert",
    "details": {
      "goals": ["Nur wenn geändert"],
      "targetAudience": "Nur wenn geändert",
      "keyInsights": ["Nur wenn geändert"],
      "recommendations": ["Nur wenn geändert"],
      "timeline": "Nur wenn geändert",
      "kpis": ["Nur wenn geändert"]
    },
    "addActions": [
      {
        "title": "Neue Massnahme",
        "description": "Beschreibung",
        "priority": "high|medium|low",
        "effort": "low|medium|high",
        "impact": "low|medium|high"
      }
    ],
    "removeActionTitles": ["Titel einer zu entfernenden Massnahme"],
    "updateActions": [
      {
        "title": "Bestehender Titel",
        "newTitle": "Neuer Titel (optional)",
        "newDescription": "Neue Beschreibung (optional)",
        "newPriority": "high|medium|low (optional)"
      }
    ]
  }
}
\`\`\`

Lasse Felder im JSON weg, die nicht geändert werden sollen. Wenn das Feedback nur eine Frage oder Diskussion ist und keine Änderungen erfordert, antworte nur mit Text ohne JSON-Block.

Verwende Schweizer Schreibweise (ss statt ß).`;
}

function serializeStrategy(
  strategy: {
    title: string;
    summary: string;
    details: unknown;
    actions: { title: string; description: string; priority: string; effort: string | null; impact: string | null }[];
  }
): string {
  const details = strategy.details as Record<string, unknown>;
  let text = `# Aktuelle Strategie\n\n`;
  text += `**Titel:** ${strategy.title}\n`;
  text += `**Zusammenfassung:** ${strategy.summary}\n\n`;

  if (details.targetAudience) text += `**Zielgruppe:** ${details.targetAudience}\n\n`;

  if (Array.isArray(details.goals) && details.goals.length > 0) {
    text += `**Ziele:**\n`;
    for (const g of details.goals) text += `- ${g}\n`;
    text += "\n";
  }

  if (Array.isArray(details.keyInsights) && details.keyInsights.length > 0) {
    text += `**Key Insights:**\n`;
    for (const i of details.keyInsights) text += `- ${i}\n`;
    text += "\n";
  }

  if (Array.isArray(details.recommendations) && details.recommendations.length > 0) {
    text += `**Empfehlungen:**\n`;
    for (const r of details.recommendations) text += `- ${r}\n`;
    text += "\n";
  }

  if (details.timeline) text += `**Timeline:** ${details.timeline}\n`;
  if (Array.isArray(details.kpis)) text += `**KPIs:** ${details.kpis.join(", ")}\n`;

  text += `\n**Massnahmen:**\n`;
  for (const a of strategy.actions) {
    text += `- [${a.priority}] ${a.title}: ${a.description}`;
    if (a.effort) text += ` (Aufwand: ${a.effort})`;
    if (a.impact) text += ` (Impact: ${a.impact})`;
    text += "\n";
  }

  return text;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const strategyId = searchParams.get("strategyId");

    if (!strategyId) {
      return NextResponse.json({ error: "strategyId ist erforderlich" }, { status: 400 });
    }

    const refinements = await prisma.marketingRefinement.findMany({
      where: { strategyId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(refinements);
  } catch (error) {
    console.error("Refine GET error:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
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
    const { strategyId, message } = body;

    if (!strategyId || !message?.trim()) {
      return NextResponse.json(
        { error: "strategyId und message sind erforderlich" },
        { status: 400 }
      );
    }

    const strategy = await prisma.marketingStrategy.findUnique({
      where: { id: strategyId },
      include: { actions: true, refinements: { orderBy: { createdAt: "asc" } } },
    });

    if (!strategy) {
      return NextResponse.json({ error: "Strategie nicht gefunden" }, { status: 404 });
    }

    const channelLabel = CHANNEL_LABELS[strategy.channel] || strategy.channel;
    const strategyContext = serializeStrategy(strategy);

    const conversationMessages: Anthropic.MessageParam[] = [];

    conversationMessages.push({
      role: "user",
      content: `Hier ist die aktuelle ${channelLabel}-Strategie, die wir gemeinsam verfeinern:\n\n${strategyContext}`,
    });

    conversationMessages.push({
      role: "assistant",
      content: `Ich habe die aktuelle ${channelLabel}-Strategie gelesen. Ich bin bereit, sie basierend auf deinem Feedback zu verfeinern. Was möchtest du anpassen oder verbessern?`,
    });

    for (const ref of strategy.refinements) {
      conversationMessages.push({
        role: ref.role as "user" | "assistant",
        content: ref.content,
      });
    }

    conversationMessages.push({
      role: "user",
      content: message.trim(),
    });

    await prisma.marketingRefinement.create({
      data: {
        strategyId,
        role: "user",
        content: message.trim(),
      },
    });

    const aiResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: buildRefineSystemPrompt(channelLabel),
      messages: conversationMessages,
    });

    const textContent = aiResponse.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json(
        { error: "Keine Antwort von der KI erhalten" },
        { status: 500 }
      );
    }

    const responseText = textContent.text;

    let appliedDiff: Record<string, unknown> | null = null;
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)```/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        const updated = parsed.updatedFields;

        if (updated) {
          const strategyUpdate: Record<string, unknown> = {};

          if (updated.title) strategyUpdate.title = updated.title;
          if (updated.summary) strategyUpdate.summary = updated.summary;

          if (updated.details) {
            const currentDetails = (strategy.details || {}) as Record<string, unknown>;
            strategyUpdate.details = { ...currentDetails, ...updated.details };
          }

          if (Object.keys(strategyUpdate).length > 0) {
            await prisma.marketingStrategy.update({
              where: { id: strategyId },
              data: strategyUpdate as Parameters<typeof prisma.marketingStrategy.update>[0]["data"],
            });
          }

          if (updated.addActions && Array.isArray(updated.addActions)) {
            for (const action of updated.addActions) {
              await prisma.marketingAction.create({
                data: {
                  strategyId,
                  title: action.title,
                  description: action.description,
                  priority: action.priority || "medium",
                  effort: action.effort || null,
                  impact: action.impact || null,
                },
              });
            }
          }

          if (updated.removeActionTitles && Array.isArray(updated.removeActionTitles)) {
            for (const title of updated.removeActionTitles) {
              const existing = strategy.actions.find(
                (a) => a.title.toLowerCase() === title.toLowerCase()
              );
              if (existing) {
                await prisma.marketingAction.delete({ where: { id: existing.id } });
              }
            }
          }

          if (updated.updateActions && Array.isArray(updated.updateActions)) {
            for (const upd of updated.updateActions) {
              const existing = strategy.actions.find(
                (a) => a.title.toLowerCase() === upd.title.toLowerCase()
              );
              if (existing) {
                const actionUpdate: Record<string, string> = {};
                if (upd.newTitle) actionUpdate.title = upd.newTitle;
                if (upd.newDescription) actionUpdate.description = upd.newDescription;
                if (upd.newPriority) actionUpdate.priority = upd.newPriority;
                if (Object.keys(actionUpdate).length > 0) {
                  await prisma.marketingAction.update({
                    where: { id: existing.id },
                    data: actionUpdate,
                  });
                }
              }
            }
          }

          appliedDiff = updated;
        }
      } catch {
        // JSON parsing failed — treat as text-only response
      }
    }

    const savedResponse = await prisma.marketingRefinement.create({
      data: {
        strategyId,
        role: "assistant",
        content: responseText,
        appliedDiff: (appliedDiff ?? undefined) as Parameters<typeof prisma.marketingRefinement.create>[0]["data"]["appliedDiff"],
      },
    });

    const updatedStrategy = await prisma.marketingStrategy.findUnique({
      where: { id: strategyId },
      include: {
        actions: { orderBy: [{ priority: "asc" }, { createdAt: "asc" }] },
      },
    });

    return NextResponse.json({
      refinement: savedResponse,
      updatedStrategy,
      hasChanges: appliedDiff !== null,
    });
  } catch (error) {
    console.error("Refine POST error:", error);
    return NextResponse.json(
      { error: "Fehler bei der Verfeinerung" },
      { status: 500 }
    );
  }
}
