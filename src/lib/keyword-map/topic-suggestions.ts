import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { normalizeContentLanguage } from "@/lib/content-workflow";
import type { TopicArticleSuggestion, TopicGapItem } from "./shared";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_OCCURRENCES = 20;
const MAX_EXISTING_TITLES = 300;

const LANGUAGE_NAMES: Record<string, string> = { de: "Deutsch", en: "Englisch", fr: "Französisch", it: "Italienisch" };

export class TopicSuggestionError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Erzeugt KI-Artikelvorschläge für ein offenes Topic des Projekts. `occurrences` verweisen auf die
 * Gap-Analysen (`gapId` + Position in `results`), in denen das Topic fehlt.
 */
export async function suggestTopicArticles(
  projectId: string,
  occurrences: Array<{ gapId: string; index: number }>
): Promise<{ suggestions: TopicArticleSuggestion[]; existingCount: number }> {
  const project = await prisma.keywordMapProject.findUnique({
    where: { id: projectId },
    select: { name: true, category: true, countryCode: true, languageCode: true },
  });
  if (!project) throw new TopicSuggestionError(404, "Projekt nicht gefunden");

  const refs = occurrences.slice(0, MAX_OCCURRENCES);
  const gaps = await prisma.keywordMapTopicGap.findMany({
    where: { id: { in: [...new Set(refs.map((r) => r.gapId))] }, url: { projectId } },
    select: { id: true, status: true, focusKeyword: true, results: true, url: { select: { url: true, h1: true } } },
  });
  const byId = new Map(gaps.map((g) => [g.id, g]));
  const found = refs.flatMap((r) => {
    const gap = byId.get(r.gapId);
    const items = gap?.status === "succeeded" && Array.isArray(gap.results) ? (gap.results as unknown as TopicGapItem[]) : [];
    const item = items[r.index];
    return gap && item ? [{ gap, item }] : [];
  });
  if (found.length === 0) throw new TopicSuggestionError(404, "Topic nicht gefunden");

  const topic = found[0].item.topic;
  const language = normalizeContentLanguage(project.languageCode);
  const existing = await prisma.editorialPlanArticle.findMany({
    where: {
      language,
      OR: [{ title: { contains: topic, mode: "insensitive" } }, ...(project.category ? [{ category: project.category }] : [])],
    },
    select: { title: true },
    orderBy: { createdAt: "desc" },
    take: MAX_EXISTING_TITLES,
  });

  const coveredElsewhere = [...new Set(found.flatMap(({ item }) => (item.otherUrls ?? []).map((u) => u.url)))];
  const contextLines = found
    .map(({ gap, item }) =>
      [
        `- URL: ${gap.url.url}${gap.url.h1 ? ` (H1: ${gap.url.h1})` : ""}`,
        `  Fokus-Keyword: ${gap.focusKeyword}`,
        `  Abdeckung: ${item.status === "partial" ? "nur teilweise behandelt" : "fehlt"}`,
        item.path?.length ? `  Topic-Pfad: ${[...item.path, item.topic].join(" > ")}` : null,
        item.reason ? `  Begründung der Analyse: ${item.reason}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n");
  const existingBlock = existing.map((a, i) => `${i + 1}. "${a.title}"`).join("\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Du bist ein SEO- und Content-Strategie-Experte für Finanzthemen (Markt: ${project.countryCode.toUpperCase()}).

Projekt: ${project.name}${project.category ? `\nKategorie: ${project.category}` : ""}

Eine Topic-Gap-Analyse hat ergeben, dass das Topic "${topic}" auf folgenden Seiten unserer Website fehlt oder nur unzureichend behandelt wird:
${contextLines}
${coveredElsewhere.length > 0 ? `\nAuf diesen anderen Seiten wird das Topic bereits (teilweise) behandelt – die neuen Artikel sollen diese ergänzen, nicht duplizieren:\n${coveredElsewhere.map((u) => `- ${u}`).join("\n")}\n` : ""}
${existing.length > 0 ? `Im Redaktionsplan gibt es bereits folgende ${existing.length} Artikel:\n${existingBlock}\n\n` : ""}Schlage 5–8 Artikel vor, mit denen wir das Topic "${topic}" abdecken. Die Artikel sollen die Fokus-Keywords der genannten Seiten sinnvoll ergänzen, damit sie von dort intern verlinkt werden können.

Anforderungen:
- Titel auf ${LANGUAGE_NAMES[language] ?? language}, SEO-optimiert, mit relevantem Keyword
- Unterschiedliche Blickwinkel bzw. Suchintentionen (z.B. Grundlagen, Ratgeber, Vergleich, Rechner/Checkliste)
- Keine Duplikate oder starken Überschneidungen mit bestehenden Artikeln im Redaktionsplan
- Zu jedem Titel eine kurze Begründung (1 Satz: welche Suchintention, warum relevant)

Antworte NUR mit einem JSON-Array im folgenden Format (keine weiteren Erklärungen):
[
  {"title": "Artikeltitel", "reason": "Kurze Begründung"}
]`,
      },
    ],
  });

  const textBlock = message.content.find((c) => c.type === "text");
  const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("KI-Antwort konnte nicht verarbeitet werden");
  const parsed = JSON.parse(jsonMatch[0]) as Array<{ title?: unknown; reason?: unknown }>;
  const suggestions = parsed
    .filter((s) => typeof s.title === "string" && s.title.trim())
    .map((s) => ({ title: (s.title as string).trim(), reason: typeof s.reason === "string" ? s.reason.trim() : "" }));

  return { suggestions, existingCount: existing.length };
}
