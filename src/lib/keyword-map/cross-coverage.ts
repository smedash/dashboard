import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { embedTexts, toVectorLiteral } from "@/lib/content-mapping/embeddings";
import { toUrlKey } from "@/lib/url-cleanup/normalize";
import type { TopicGapItem, TopicOtherUrl } from "./shared";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** Kosinus-Ähnlichkeit, ab der ein Abschnitt als Kandidat gilt */
export const MIN_SIMILARITY = 0.45;
const SECTIONS_PER_TOPIC = 20;
const URLS_PER_TOPIC = 5;
const SNIPPET_CHARS = 500;
const TOPICS_PER_PROMPT = 25;
const QUERY_CONCURRENCY = 5;

interface SectionHit {
  inventoryId: string;
  url: string;
  title: string | null;
  heading: string | null;
  snippet: string;
  similarity: number;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function searchSections(params: {
  vector: number[];
  ownUrlKey: string;
  ownUrlKeyNoHtml: string;
  languageCode: string;
  countryCode: string;
}): Promise<SectionHit[]> {
  const v = toVectorLiteral(params.vector);
  // Gefilterte HNSW-Suche: ohne höheres ef_search fallen nach dem Filtern zu viele Treffer weg
  const [, rows] = await prisma.$transaction([
    prisma.$queryRaw`SELECT set_config('hnsw.ef_search', '200', true)`,
    prisma.$queryRaw<SectionHit[]>`
      SELECT i."id" AS "inventoryId", i."url", c."title", s."heading",
             left(s."text", ${SNIPPET_CHARS}) AS "snippet",
             (1 - (s."embedding" <=> ${v}::vector))::float AS "similarity"
      FROM "UrlContentSection" s
      JOIN "UrlContent" c ON c."id" = s."contentId"
      JOIN "UrlInventory" i ON i."id" = c."inventoryId"
      WHERE s."embedding" IS NOT NULL
        AND c."status" = 'succeeded'
        AND (c."robots" IS NULL OR c."robots" NOT ILIKE '%noindex%')
        AND i."urlKey" <> ${params.ownUrlKey}
        AND i."urlKeyNoHtml" <> ${params.ownUrlKeyNoHtml}
        AND lower(i."language") = ${params.languageCode.toLowerCase()}
        AND lower(i."country") = ${params.countryCode.toLowerCase()}
      ORDER BY s."embedding" <=> ${v}::vector
      LIMIT ${SECTIONS_PER_TOPIC}
    `,
  ]);
  return rows;
}

/** Bester Abschnitt je URL, nur oberhalb des Schwellwerts. */
function bestPerUrl(hits: SectionHit[]): SectionHit[] {
  const byUrl = new Map<string, SectionHit>();
  for (const h of hits) {
    if (h.similarity < MIN_SIMILARITY) continue;
    const prev = byUrl.get(h.inventoryId);
    if (!prev || h.similarity > prev.similarity) byUrl.set(h.inventoryId, h);
  }
  return [...byUrl.values()].sort((a, b) => b.similarity - a.similarity).slice(0, URLS_PER_TOPIC);
}

interface TopicCandidates {
  index: number;
  label: string;
  candidates: SectionHit[];
}

async function verifyCandidates(keyword: string, topics: TopicCandidates[]): Promise<Map<number, TopicOtherUrl[]>> {
  const block = topics
    .map((t, ti) => {
      const cands = t.candidates
        .map(
          (c, ci) =>
            `  [${ti + 1}.${ci + 1}] ${c.url}\n      Title: ${c.title ?? "-"}\n      Abschnitt: ${c.heading ?? "(Intro)"}\n      Text: ${c.snippet.replace(/\s+/g, " ").trim()}`
        )
        .join("\n");
      return `Topic ${ti + 1}: ${t.label}\n${cands}`;
    })
    .join("\n\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8_000,
    messages: [
      {
        role: "user",
        content: `Du bist ein erfahrener SEO-Content-Analyst für Finanzthemen in der Schweiz.

Zu Subtopics des Fokus-Keywords "${keyword}" wurden per semantischer Suche Abschnitte anderer Seiten derselben Website gefunden. Prüfe für jeden Kandidaten, ob der Abschnitt das Topic tatsächlich behandelt:
- "covered": Das Topic wird inhaltlich behandelt (eigener Abschnitt oder mehrere konkrete Sätze), ein interner Link dorthin wäre sinnvoll.
- "partial": Das Topic wird nur am Rande erwähnt.
- "none": Der Abschnitt passt nur oberflächlich oder gar nicht.
Bewerte nach Bedeutung, nicht nach exakter Wortübereinstimmung.

${block}

Antworte NUR mit JSON in diesem Format (keine weiteren Erklärungen):
{"results": [{"id": "1.1", "status": "covered|partial|none"}]}
Gib für jeden Kandidaten genau einen Eintrag zurück.`,
      },
    ],
  });

  const textBlock = message.content.find((c) => c.type === "text");
  const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("KI-Antwort enthielt kein JSON");
  const parsed = JSON.parse(jsonMatch[0]) as { results?: Array<{ id: string; status: string }> };
  const statusById = new Map((parsed.results ?? []).map((r) => [String(r.id).trim(), r.status]));

  const out = new Map<number, TopicOtherUrl[]>();
  topics.forEach((t, ti) => {
    const urls: TopicOtherUrl[] = [];
    t.candidates.forEach((c, ci) => {
      const status = statusById.get(`${ti + 1}.${ci + 1}`);
      if (status !== "covered" && status !== "partial") return;
      urls.push({
        inventoryId: c.inventoryId,
        url: c.url,
        title: c.title,
        status,
        heading: c.heading,
        similarity: Math.round(c.similarity * 1000) / 1000,
      });
    });
    urls.sort((a, b) => (a.status === b.status ? b.similarity - a.similarity : a.status === "covered" ? -1 : 1));
    out.set(t.index, urls);
  });
  return out;
}

/**
 * Sucht für fehlende und teilweise abgedeckte Topics andere URLs aus dem Content-Mapping,
 * die das Topic bereits behandeln, und setzt `otherUrls` an den betroffenen Items.
 */
export async function findCrossCoverage(params: {
  keyword: string;
  url: string;
  languageCode: string;
  countryCode: string;
  items: TopicGapItem[];
}): Promise<TopicGapItem[]> {
  const open = params.items.map((item, index) => ({ item, index })).filter(({ item }) => item.status !== "covered");
  if (open.length === 0) return params.items;

  const embedded = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (SELECT 1 FROM "UrlContentSection" WHERE "embedding" IS NOT NULL) AS "exists"
  `;
  if (!embedded[0]?.exists) throw new Error("Im Content-Mapping sind noch keine Abschnitte eingebettet (npm run embed-content)");

  const keys = toUrlKey(params.url);
  if (!keys) throw new Error("URL konnte nicht normalisiert werden");

  const labels = open.map(({ item }) => [params.keyword, ...item.path, item.topic].join(" > "));
  const vectors = await embedTexts(labels);
  const queries = open.map(({ index }, pos) => ({ index, pos }));
  const candidates: TopicCandidates[] = await mapLimit(queries, QUERY_CONCURRENCY, async ({ index, pos }) => {
    const hits = await searchSections({
      vector: vectors[pos],
      ownUrlKey: keys.urlKey,
      ownUrlKeyNoHtml: keys.urlKeyNoHtml,
      languageCode: params.languageCode,
      countryCode: params.countryCode,
    });
    return { index, label: labels[pos], candidates: bestPerUrl(hits) };
  });

  const withCandidates = candidates.filter((c) => c.candidates.length > 0);
  const chunks: TopicCandidates[][] = [];
  for (let i = 0; i < withCandidates.length; i += TOPICS_PER_PROMPT) chunks.push(withCandidates.slice(i, i + TOPICS_PER_PROMPT));
  const verified = new Map<number, TopicOtherUrl[]>();
  for (const result of await Promise.all(chunks.map((chunk) => verifyCandidates(params.keyword, chunk)))) {
    for (const [index, urls] of result) verified.set(index, urls);
  }

  return params.items.map((item, index) => (item.status === "covered" ? item : { ...item, otherUrls: verified.get(index) ?? [] }));
}

/**
 * Führt den Abgleich für eine erfolgreiche Gap-Analyse aus und speichert `otherUrls` bzw. den Fehler.
 * Die Ergebnisse werden vor dem Speichern neu gelesen, damit zwischenzeitliche Änderungen
 * (KVP-Auswahl, Redaktionsplan) nicht überschrieben werden.
 */
export async function runCrossCoverage(gapId: string): Promise<void> {
  const gap = await prisma.keywordMapTopicGap.findUnique({
    where: { id: gapId },
    include: { url: { include: { project: { select: { languageCode: true, countryCode: true } } } } },
  });
  if (!gap || gap.status !== "succeeded" || !Array.isArray(gap.results)) return;

  try {
    const items = await findCrossCoverage({
      keyword: gap.focusKeyword,
      url: gap.url.url,
      languageCode: gap.url.project.languageCode,
      countryCode: gap.url.project.countryCode,
      items: gap.results as unknown as TopicGapItem[],
    });
    const otherByKey = new Map(items.map((i) => [`${i.path.join(" > ")} > ${i.topic}`, i.otherUrls]));
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.$queryRaw<Array<{ results: unknown }>>`
        SELECT "results" FROM "KeywordMapTopicGap" WHERE "id" = ${gapId} FOR UPDATE
      `;
      const current = Array.isArray(fresh[0]?.results) ? (fresh[0].results as TopicGapItem[]) : [];
      const merged = current.map((i) => {
        const otherUrls = otherByKey.get(`${i.path.join(" > ")} > ${i.topic}`);
        return otherUrls ? { ...i, otherUrls } : i;
      });
      await tx.keywordMapTopicGap.update({
        where: { id: gapId },
        data: { results: merged as unknown as Prisma.InputJsonValue, crossCoverageError: null },
      });
    });
  } catch (e) {
    console.error("[keyword-map/cross-coverage] Abgleich fehlgeschlagen", e);
    await prisma.keywordMapTopicGap.update({
      where: { id: gapId },
      data: { crossCoverageError: e instanceof Error ? e.message : "Abgleich fehlgeschlagen" },
    });
  }
}
