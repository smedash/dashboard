import { createHash } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import type { Prisma, TopicGraph } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { proxyFetch, DEFAULT_SCRAPE_HEADERS } from "@/lib/proxy-fetch";
import { fetchRawHtml } from "@/lib/dataforseo";
import { parseHtml } from "@/lib/url-checker/parser";
import { createTopicGraph, getTopicGraph, type TopicGraphNode } from "@/lib/topicloops";
import type { TopicCoverageStatus, TopicGapItem } from "./shared";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** Grosse Topic-Graphen werden auf die oberen Ebenen begrenzt, damit Prompt und Antwort handhabbar bleiben */
const MAX_TOPICS = 150;
const MAX_CONTENT_CHARS = 40_000;

function countTopics(node: TopicGraphNode): number {
  return 1 + (node.children ?? []).reduce((sum, c) => sum + countTopics(c), 0);
}

/** Flacht den Graphen breitensuche-artig ab (Ebene 1 vor Ebene 2 …), ohne den Wurzelknoten. */
export function flattenTopics(root: TopicGraphNode): Array<{ topic: string; path: string[] }> {
  const out: Array<{ topic: string; path: string[] }> = [];
  const queue: Array<{ node: TopicGraphNode; path: string[] }> = (root.children ?? []).map((n) => ({ node: n, path: [] }));
  const seen = new Set<string>();
  while (queue.length > 0 && out.length < MAX_TOPICS) {
    const { node, path } = queue.shift()!;
    const label = node.label?.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ topic: label, path });
    }
    for (const child of node.children ?? []) queue.push({ node: child, path: [...path, label] });
  }
  return out;
}

/** Liefert den (gecachten) TopicLoops-Graphen zum Keyword oder startet einen neuen Job. */
export async function ensureTopicGraph(params: {
  keyword: string;
  countryCode: string;
  languageCode: string;
  userId: string;
  category?: string | null;
  force?: boolean;
}): Promise<TopicGraph> {
  const keyword = params.keyword.trim().toLowerCase();
  const where = {
    keyword_countryCode_languageCode: { keyword, countryCode: params.countryCode, languageCode: params.languageCode },
  };
  const existing = await prisma.topicGraph.findUnique({ where });
  if (existing && !params.force && (existing.status === "processing" || (existing.status === "succeeded" && existing.topicGraph))) {
    return existing;
  }

  const job = await createTopicGraph(keyword, { country_code: params.countryCode, language_code: params.languageCode });
  return prisma.topicGraph.upsert({
    where,
    create: {
      userId: params.userId,
      keyword,
      countryCode: params.countryCode,
      languageCode: params.languageCode,
      topicloopsId: job.id,
      status: "processing",
      category: params.category || null,
    },
    update: { topicloopsId: job.id, status: "processing", topicGraph: null, totalTopics: 0 },
  });
}

/** Fragt einen laufenden TopicLoops-Job einmal ab und aktualisiert den Cache. */
export async function refreshTopicGraph(graph: TopicGraph): Promise<TopicGraph> {
  if (graph.status !== "processing") return graph;
  const api = await getTopicGraph(graph.topicloopsId);
  if (api.status === "succeeded" && api.topic_graph) {
    return prisma.topicGraph.update({
      where: { id: graph.id },
      data: { status: "succeeded", topicGraph: JSON.stringify(api.topic_graph), totalTopics: countTopics(api.topic_graph) },
    });
  }
  if (api.status === "failed") {
    return prisma.topicGraph.update({ where: { id: graph.id }, data: { status: "failed" } });
  }
  return graph;
}

export interface PageContent {
  title: string;
  h1: string | null;
  headings: { level: number; text: string }[];
  text: string;
  hash: string;
}

/** Holt das HTML direkt bzw. über den Proxy und weicht bei Bot-Schutz auf den DataForSEO-Crawler aus. */
async function loadHtml(url: string): Promise<{ html: string; status: number; lastModified: string | null }> {
  let directError: string;
  let res: Response | null = null;
  try {
    res = await proxyFetch(url, { headers: DEFAULT_SCRAPE_HEADERS, timeoutMs: 20_000 });
    directError = `HTTP ${res.status}`;
  } catch (err) {
    directError = err instanceof Error ? err.message : String(err);
  }
  if (res?.ok) return { html: await res.text(), status: res.status, lastModified: res.headers.get("last-modified") };
  if (res && (res.status === 404 || res.status === 410)) {
    throw new Error(`Seite konnte nicht geladen werden: HTTP ${res.status}`);
  }

  if (!process.env.DATAFORSEO_USERNAME?.trim() || !process.env.DATAFORSEO_PASSWORD?.trim()) {
    throw new Error(`Seite konnte nicht geladen werden: ${directError}`);
  }
  console.warn(`[topic-gap] ${url}: ${directError}, lade über DataForSEO`);
  const page = await fetchRawHtml(url);
  if (page.status < 200 || page.status >= 300 || !page.html) {
    throw new Error(`Seite konnte nicht geladen werden: ${directError} (DataForSEO: HTTP ${page.status})`);
  }
  return { html: page.html, status: page.status, lastModified: null };
}

export async function fetchPageContent(url: string): Promise<PageContent> {
  const { html, status, lastModified } = await loadHtml(url);
  const page = parseHtml(html, url, status, [], lastModified);
  const text = page.textContent.slice(0, MAX_CONTENT_CHARS);
  return {
    title: page.title,
    h1: page.headings.find((h) => h.level === 1)?.text ?? null,
    headings: page.headings,
    text,
    hash: createHash("sha256").update(text).digest("hex").slice(0, 32),
  };
}

const STATUSES: TopicCoverageStatus[] = ["covered", "partial", "missing"];

export async function analyzeCoverage(params: {
  keyword: string;
  url: string;
  page: PageContent;
  topics: Array<{ topic: string; path: string[] }>;
}): Promise<{ items: TopicGapItem[]; coverageScore: number; summary: string }> {
  const { keyword, url, page, topics } = params;
  const topicList = topics
    .map((t, i) => `${i + 1}. ${t.path.length ? `${t.path.join(" > ")} > ` : ""}${t.topic}`)
    .join("\n");
  const headingOutline = page.headings
    .slice(0, 80)
    .map((h) => `${"  ".repeat(Math.max(0, h.level - 1))}H${h.level}: ${h.text}`)
    .join("\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16_000,
    messages: [
      {
        role: "user",
        content: `Du bist ein erfahrener SEO-Content-Analyst für Finanzthemen in der Schweiz.

Prüfe, welche Subtopics zum Fokus-Keyword "${keyword}" der Inhalt der folgenden Seite abdeckt. Die Topics stammen aus einer Topic-Analyse (TopicLoops) der Suchergebnisse.

Bewertung je Topic:
- "covered": Das Topic wird inhaltlich behandelt (eigener Abschnitt oder mehrere konkrete Sätze).
- "partial": Das Topic wird nur am Rande erwähnt, ohne nennenswerte Erklärung.
- "missing": Das Topic kommt im Inhalt nicht vor.
Bewerte nach Bedeutung, nicht nach exakter Wortübereinstimmung (Synonyme und Schweizer Begriffe zählen).

URL: ${url}
Title: ${page.title}
H1: ${page.h1 ?? "-"}

Überschriften-Struktur:
${headingOutline || "-"}

Seiteninhalt:
"""
${page.text}
"""

Topics:
${topicList}

Antworte NUR mit JSON in diesem Format (keine weiteren Erklärungen):
{
  "summary": "2-3 Sätze: wie gut deckt die Seite das Thema ab und welche Lücken sind am wichtigsten",
  "topics": [{"n": 1, "status": "covered|partial|missing", "reason": "max. 15 Wörter", "evidence": "kurzes wörtliches Zitat oder Überschrift aus dem Inhalt, bei missing null"}]
}
Gib für jedes der ${topics.length} Topics genau einen Eintrag zurück.`,
      },
    ],
  });

  const textBlock = message.content.find((c) => c.type === "text");
  const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("KI-Antwort enthielt kein JSON");
  const parsed = JSON.parse(jsonMatch[0]) as {
    summary?: string;
    topics?: Array<{ n: number; status: string; reason?: string; evidence?: string | null }>;
  };
  const byIndex = new Map((parsed.topics ?? []).map((t) => [t.n, t]));

  const items: TopicGapItem[] = topics.map((t, i) => {
    const r = byIndex.get(i + 1);
    const status = STATUSES.includes(r?.status as TopicCoverageStatus) ? (r!.status as TopicCoverageStatus) : "missing";
    return {
      topic: t.topic,
      path: t.path,
      status,
      reason: r?.reason?.trim() || (r ? "" : "Keine Bewertung erhalten"),
      evidence: status === "missing" ? null : r?.evidence?.trim() || null,
    };
  });
  const covered = items.filter((i) => i.status === "covered").length;
  const partial = items.filter((i) => i.status === "partial").length;
  const coverageScore = items.length ? Math.round((100 * (covered + 0.5 * partial)) / items.length) : 0;

  return { items, coverageScore, summary: parsed.summary?.trim() ?? "" };
}

export const STALE_ANALYSIS_MS = 5 * 60 * 1000;

function topicKey(item: Pick<TopicGapItem, "topic" | "path">): string {
  return [...item.path, item.topic].join(" > ").trim().toLowerCase();
}

/** Zur KVP-Übernahme ausgewählte Topics der letzten erfolgreichen Analyse, damit eine Neuanalyse die Auswahl behält. */
async function selectedTopicKeys(urlId: string, excludeGapId: string): Promise<Set<string>> {
  const previous = await prisma.keywordMapTopicGap.findFirst({
    where: { urlId, status: "succeeded", id: { not: excludeGapId } },
    orderBy: { createdAt: "desc" },
    select: { results: true },
  });
  const items = Array.isArray(previous?.results) ? (previous.results as unknown as TopicGapItem[]) : [];
  return new Set(items.filter((i) => i.selected).map(topicKey));
}

/**
 * Bringt eine Gap-Analyse einen Schritt weiter: Topic-Graph abfragen und – sobald vorhanden –
 * Seite laden und mit Claude abgleichen. Mehrfache parallele Aufrufe starten die Analyse nur einmal.
 */
export async function advanceTopicGap(gapId: string) {
  let gap = await prisma.keywordMapTopicGap.findUnique({ where: { id: gapId }, include: { url: true } });
  if (!gap) return null;
  if (gap.status === "succeeded" || gap.status === "failed") return gap;
  if (gap.status === "analyzing" && Date.now() - gap.updatedAt.getTime() < STALE_ANALYSIS_MS) return gap;

  let graph = gap.topicGraphId ? await prisma.topicGraph.findUnique({ where: { id: gap.topicGraphId } }) : null;
  if (!graph) {
    return prisma.keywordMapTopicGap.update({
      where: { id: gapId },
      data: { status: "failed", error: "Topic-Graph nicht gefunden" },
      include: { url: true },
    });
  }
  graph = await refreshTopicGraph(graph);
  if (graph.status === "failed") {
    return prisma.keywordMapTopicGap.update({
      where: { id: gapId },
      data: {
        status: "failed",
        error: `TopicLoops hat den Job ohne Begründung abgebrochen (Job-ID ${graph.topicloopsId}). Bitte später erneut starten oder den TopicLoops-Support kontaktieren.`,
      },
      include: { url: true },
    });
  }
  if (graph.status !== "succeeded" || !graph.topicGraph) return gap;

  const claimed = await prisma.keywordMapTopicGap.updateMany({
    where: { id: gapId, status: gap.status, updatedAt: gap.updatedAt },
    data: { status: "analyzing" },
  });
  if (claimed.count === 0) return prisma.keywordMapTopicGap.findUnique({ where: { id: gapId }, include: { url: true } });

  try {
    const topics = flattenTopics(JSON.parse(graph.topicGraph) as TopicGraphNode);
    if (topics.length === 0) throw new Error("Topic-Graph enthält keine Topics");
    const page = await fetchPageContent(gap.url.url);
    const result = await analyzeCoverage({ keyword: gap.focusKeyword, url: gap.url.url, page, topics });
    const previouslySelected = await selectedTopicKeys(gap.urlId, gapId);
    for (const item of result.items) {
      if (previouslySelected.has(topicKey(item))) item.selected = true;
    }
    gap = await prisma.keywordMapTopicGap.update({
      where: { id: gapId },
      data: {
        status: "succeeded",
        results: result.items as unknown as Prisma.InputJsonValue,
        coverageScore: result.coverageScore,
        summary: result.summary,
        contentHash: page.hash,
        error: null,
      },
      include: { url: true },
    });
  } catch (e) {
    console.error("[keyword-map/topic-gap] Analyse fehlgeschlagen", e);
    gap = await prisma.keywordMapTopicGap.update({
      where: { id: gapId },
      data: { status: "failed", error: e instanceof Error ? e.message : "Analyse fehlgeschlagen" },
      include: { url: true },
    });
  }
  return gap;
}
