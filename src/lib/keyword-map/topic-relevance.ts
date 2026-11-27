import { createHash } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { embedTexts } from "@/lib/content-mapping/embeddings";
import { TOPIC_RELEVANCE_TIERS, type TopicRelevanceTier } from "./shared";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const LLM_BATCH = 60;
const MAX_PROFILE_KEYWORDS = 150;
const MAX_PROFILE_H1S = 80;

export interface CoreProfile {
  /** Für den Prompt: Projektdaten samt Fokus-Keywords und H1s */
  text: string;
  /** Für das Embedding: Kernthema ohne lange H1-Liste */
  embedText: string;
  /**
   * Nur über Name, Kategorie, Beschreibung und Locale, damit neue URLs oder Keywords
   * nicht jedes Mal eine komplette Neubewertung auslösen.
   */
  hash: string;
}

export interface RelevanceTopic {
  key: string;
  topic: string;
  path: string[];
}

export interface TopicRelevanceRow {
  llmScore: number | null;
  tier: TopicRelevanceTier | null;
  reason: string | null;
  similarity: number | null;
}

export async function buildCoreProfile(projectId: string): Promise<CoreProfile> {
  const project = await prisma.keywordMapProject.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      name: true,
      category: true,
      coreDescription: true,
      countryCode: true,
      languageCode: true,
      urls: {
        select: { h1: true, keywords: { where: { type: "focus" }, orderBy: { position: "asc" }, take: 1, select: { keyword: true } } },
        orderBy: { url: "asc" },
      },
    },
  });
  const keywords = [...new Set(project.urls.map((u) => u.keywords[0]?.keyword.trim().toLowerCase()).filter((k): k is string => Boolean(k)))].slice(
    0,
    MAX_PROFILE_KEYWORDS
  );
  const h1s = [...new Set(project.urls.map((u) => u.h1?.trim()).filter((h): h is string => Boolean(h)))].slice(0, MAX_PROFILE_H1S);
  const description = project.coreDescription?.trim() ?? "";

  const head = [
    `Projekt: ${project.name}`,
    project.category ? `Kategorie: ${project.category}` : null,
    `Markt: ${project.countryCode.toUpperCase()}, Sprache: ${project.languageCode}`,
    description ? `Kernthema und Abgrenzung: ${description}` : null,
  ].filter(Boolean);

  return {
    text: [...head, keywords.length ? `Fokus-Keywords der Projekt-Seiten: ${keywords.join(", ")}` : null, h1s.length ? `H1 der Projekt-Seiten:\n- ${h1s.join("\n- ")}` : null]
      .filter(Boolean)
      .join("\n"),
    embedText: [...head, keywords.length ? `Themen: ${keywords.join(", ")}` : null].filter(Boolean).join("\n"),
    hash: createHash("sha256")
      .update(JSON.stringify([project.name, project.category, description, project.countryCode, project.languageCode]))
      .digest("hex")
      .slice(0, 32),
  };
}

/** Aktuelle Bewertungen eines Projekts; Einträge mit abweichendem Profil-Hash gelten als fehlend. */
export async function loadTopicRelevance(projectId: string, profileHash: string): Promise<Map<string, TopicRelevanceRow>> {
  const rows = await prisma.keywordMapTopicRelevance.findMany({
    where: { projectId, profileHash },
    select: { key: true, llmScore: true, tier: true, reason: true, similarity: true },
  });
  return new Map(
    rows.map((r) => [
      r.key,
      {
        llmScore: r.llmScore,
        tier: TOPIC_RELEVANCE_TIERS.includes(r.tier as TopicRelevanceTier) ? (r.tier as TopicRelevanceTier) : null,
        reason: r.reason,
        similarity: r.similarity,
      },
    ])
  );
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function topicLabel(t: RelevanceTopic): string {
  return [...t.path, t.topic].join(" > ");
}

async function topicSimilarities(profile: CoreProfile, topics: RelevanceTopic[]): Promise<Array<number | null>> {
  try {
    const [profileVector, ...vectors] = await embedTexts([profile.embedText, ...topics.map(topicLabel)]);
    return vectors.map((v) => Math.round(cosine(profileVector, v) * 1000) / 1000);
  } catch (e) {
    console.error("[keyword-map/topic-relevance] Embeddings fehlgeschlagen", e);
    return topics.map(() => null);
  }
}

async function rateBatch(profile: CoreProfile, topics: RelevanceTopic[]): Promise<Map<number, { score: number; tier: TopicRelevanceTier; reason: string }>> {
  const list = topics.map((t, i) => `${i + 1}. ${topicLabel(t)}`).join("\n");
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8_000,
    messages: [
      {
        role: "user",
        content: `Du bist ein erfahrener SEO-Stratege für Finanzinstitute in der Schweiz.

Bewerte für jedes der folgenden Topics, wie nah es am Kernthema des Projekts liegt, also wie sinnvoll es wäre, dazu Inhalte auf den Projekt-Seiten zu erstellen. Entscheidend ist die geschäftliche Relevanz für das Projekt und seine Zielgruppe, nicht bloss die sprachliche oder semantische Nähe. Die Topics stammen aus automatischen Topic-Graphen zu den Fokus-Keywords und driften teils weit ab (z. B. andere Länder, Gewerbe statt Privatkunden, andere Produkte, Allgemeinwissen, Personen, Marken).

Projekt:
${profile.text}

Stufen:
- "core" (Score 80–100): gehört direkt zum Kernthema, Nutzer der Projekt-Seiten erwarten es.
- "adjacent" (55–79): eng verwandt, sinnvolle Ergänzung oder Unterthema.
- "peripheral" (25–54): nur lose verbunden, allenfalls als Randnotiz oder auf anderen Seiten.
- "offtopic" (0–24): passt nicht zum Projekt oder widerspricht der Abgrenzung.

Topics (Pfad im Topic-Graphen > Topic):
${list}

Antworte NUR mit JSON in diesem Format (keine weiteren Erklärungen):
{"topics": [{"n": 1, "score": 0, "tier": "core|adjacent|peripheral|offtopic", "reason": "max. 12 Wörter"}]}
Gib für jedes der ${topics.length} Topics genau einen Eintrag zurück.`,
      },
    ],
  });

  const textBlock = message.content.find((c) => c.type === "text");
  const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("KI-Antwort enthielt kein JSON");
  const parsed = JSON.parse(jsonMatch[0]) as { topics?: Array<{ n: number; score: number; tier: string; reason?: string }> };

  const out = new Map<number, { score: number; tier: TopicRelevanceTier; reason: string }>();
  for (const r of parsed.topics ?? []) {
    const score = Number(r.score);
    if (!Number.isFinite(score) || !TOPIC_RELEVANCE_TIERS.includes(r.tier as TopicRelevanceTier)) continue;
    out.set(Number(r.n), { score: Math.max(0, Math.min(100, Math.round(score))), tier: r.tier as TopicRelevanceTier, reason: r.reason?.trim() ?? "" });
  }
  return out;
}

/**
 * Bewertet Topics gegen das Kernthema-Profil (Claude-Batches parallel, Embeddings in einem Durchgang)
 * und speichert die Ergebnisse. Topics ohne KI-Bewertung werden nicht gespeichert und beim nächsten Aufruf erneut versucht.
 */
export async function scoreTopicRelevance(projectId: string, topics: RelevanceTopic[]): Promise<{ fetched: number; failed: number; lastError?: string }> {
  if (topics.length === 0) return { fetched: 0, failed: 0 };
  const profile = await buildCoreProfile(projectId);
  const batches: RelevanceTopic[][] = [];
  for (let i = 0; i < topics.length; i += LLM_BATCH) batches.push(topics.slice(i, i + LLM_BATCH));

  const [similarities, ratings] = await Promise.all([topicSimilarities(profile, topics), Promise.allSettled(batches.map((b) => rateBatch(profile, b)))]);

  let fetched = 0;
  let failed = 0;
  let lastError: string | undefined;
  const writes = [];
  for (let b = 0; b < batches.length; b++) {
    const result = ratings[b];
    if (result.status === "rejected") {
      failed += batches[b].length;
      lastError = result.reason instanceof Error ? result.reason.message : String(result.reason);
      console.error("[keyword-map/topic-relevance] KI-Bewertung fehlgeschlagen", result.reason);
      continue;
    }
    for (let i = 0; i < batches[b].length; i++) {
      const topic = batches[b][i];
      const rating = result.value.get(i + 1);
      if (!rating) {
        failed++;
        continue;
      }
      const data = {
        llmScore: rating.score,
        tier: rating.tier,
        reason: rating.reason || null,
        similarity: similarities[b * LLM_BATCH + i],
        profileHash: profile.hash,
      };
      writes.push(
        prisma.keywordMapTopicRelevance.upsert({
          where: { projectId_key: { projectId, key: topic.key } },
          create: { projectId, key: topic.key, ...data },
          update: data,
        })
      );
      fetched++;
    }
  }
  if (writes.length > 0) await prisma.$transaction(writes);
  return { fetched, failed, lastError };
}
