import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

const MAX_SECTION_CHARS = 2000;
const BATCH_SIZE = 100;

let client: OpenAI | null = null;
function openai(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY fehlt");
  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

/** pgvector-Literal für `$queryRaw` (`${toVectorLiteral(v)}::vector`). */
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map((t) => t.trim() || "-");
    const res = await openai().embeddings.create({ model: EMBEDDING_MODEL, input: batch });
    const sorted = [...res.data].sort((a, b) => a.index - b.index);
    out.push(...sorted.map((d) => d.embedding));
  }
  return out;
}

interface PendingSection {
  id: string;
  title: string | null;
  heading: string | null;
  headingPath: string[];
  text: string;
}

function sectionInput(s: PendingSection): string {
  const trail = [...s.headingPath, s.heading].filter(Boolean).join(" > ");
  return [s.title, trail, s.text.slice(0, MAX_SECTION_CHARS)].filter(Boolean).join("\n");
}

async function embedSections(sections: PendingSection[]): Promise<number> {
  if (sections.length === 0) return 0;
  const vectors = await embedTexts(sections.map(sectionInput));
  const ids = sections.map((s) => s.id);
  const literals = vectors.map(toVectorLiteral);
  await prisma.$executeRaw`
    UPDATE "UrlContentSection" AS s SET "embedding" = v."embedding"::vector
    FROM unnest(${ids}::text[], ${literals}::text[]) AS v("id", "embedding")
    WHERE s."id" = v."id"
  `;
  return sections.length;
}

/** Bettet alle noch nicht eingebetteten Abschnitte einer Seite ein. */
export async function embedContentSections(contentId: string): Promise<number> {
  const sections = await prisma.$queryRaw<PendingSection[]>`
    SELECT s."id", c."title", s."heading", s."headingPath", s."text"
    FROM "UrlContentSection" s
    JOIN "UrlContent" c ON c."id" = s."contentId"
    WHERE s."contentId" = ${contentId} AND s."embedding" IS NULL
  `;
  return embedSections(sections);
}

export async function countPendingSections(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT count(*)::int AS "count"
    FROM "UrlContentSection" s
    JOIN "UrlContent" c ON c."id" = s."contentId"
    WHERE s."embedding" IS NULL AND c."status" = 'succeeded'
  `;
  return rows[0]?.count ?? 0;
}

/** Bettet bis zu `limit` offene Abschnitte erfolgreich gecrawlter Seiten ein. */
export async function embedPendingSections({ limit = 500 }: { limit?: number } = {}): Promise<number> {
  const sections = await prisma.$queryRaw<PendingSection[]>`
    SELECT s."id", c."title", s."heading", s."headingPath", s."text"
    FROM "UrlContentSection" s
    JOIN "UrlContent" c ON c."id" = s."contentId"
    WHERE s."embedding" IS NULL AND c."status" = 'succeeded'
    ORDER BY s."contentId", s."position"
    LIMIT ${limit}
  `;
  return embedSections(sections);
}
