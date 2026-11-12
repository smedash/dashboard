import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";
import {
  type DropdownOptions,
  type KeywordSource,
  type MapCta,
  type MapKeywordDto,
  type MapUrlDto,
  type TopicGapItem,
  computeScore,
  effectiveRank,
  normalizeKeyword,
  totalSearchVolume,
} from "./shared";

export const mapUrlInclude = {
  keywords: { orderBy: [{ type: "asc" }, { position: "asc" }, { createdAt: "asc" }] },
  topicGaps: { orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.KeywordMapUrlInclude;

export type MapUrlWithRelations = Prisma.KeywordMapUrlGetPayload<{ include: typeof mapUrlInclude }>;

type SessionUser = { id: string; role?: string | null };

/** Prüft Login (und optional Schreibrechte); liefert entweder den User oder eine fertige Fehler-Response. */
export async function requireUser(options?: { write?: boolean }): Promise<
  { user: SessionUser; error?: undefined } | { user?: undefined; error: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (options?.write && !canEdit(session.user.role)) {
    return { error: NextResponse.json({ error: "Keine Berechtigung zum Bearbeiten" }, { status: 403 }) };
  }
  return { user: { id: session.user.id, role: session.user.role } };
}

function toKeywordDto(k: MapUrlWithRelations["keywords"][number]): MapKeywordDto {
  return { id: k.id, keyword: k.keyword, searchVolume: k.searchVolume, source: k.source as KeywordSource };
}

function subVolume(row: MapUrlWithRelations): number | null {
  const subs = row.keywords.filter((k) => k.type === "sub");
  const known = subs.filter((k) => typeof k.searchVolume === "number");
  if (known.length > 0) return known.reduce((sum, k) => sum + (k.searchVolume ?? 0), 0);
  return row.subSearchVolume ?? null;
}

function toUrlDtoWithoutScore(row: MapUrlWithRelations): MapUrlDto {
  const focus = row.keywords.find((k) => k.type === "focus");
  const gap = row.topicGaps[0];
  const gapResults = Array.isArray(gap?.results) ? (gap.results as unknown as TopicGapItem[]) : [];
  return {
    id: row.id,
    url: row.url,
    h1: row.h1,
    noindex: row.noindex,
    statusCode: row.statusCode,
    navigationType: row.navigationType,
    pageType: row.pageType,
    funnel: row.funnel,
    targetGroup: row.targetGroup,
    topicAuthority: row.topicAuthority,
    ctas: Array.isArray(row.ctas) ? (row.ctas as unknown as MapCta[]) : [],
    furtherLinks: Array.isArray(row.furtherLinks) ? (row.furtherLinks as unknown as string[]) : [],
    dfsTopKeyword: row.dfsTopKeyword,
    dfsSearchVolume: row.dfsSearchVolume,
    dfsRank: row.dfsRank,
    dfsFetchedAt: row.dfsFetchedAt?.toISOString() ?? null,
    manualRank: row.manualRank,
    gscClicks: row.gscClicks,
    comment: row.comment,
    kvpUrlId: row.kvpUrlId,
    focusKeyword: focus ? toKeywordDto(focus) : null,
    subKeywords: row.keywords.filter((k) => k.type === "sub").map(toKeywordDto),
    subSearchVolume: subVolume(row),
    latestTopicGap: gap
      ? {
          id: gap.id,
          status: gap.status,
          coverageScore: gap.coverageScore,
          missingCount: gapResults.filter((r) => r.status === "missing").length,
          partialCount: gapResults.filter((r) => r.status === "partial").length,
          focusKeyword: gap.focusKeyword,
          createdAt: gap.createdAt.toISOString(),
        }
      : null,
    score: null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Score braucht das Suchvolumen-Maximum des Projekts, daher immer alle URLs des Projekts übergeben, wenn verfügbar. */
export function serializeUrls(rows: MapUrlWithRelations[], maxTotalSv?: number): MapUrlDto[] {
  const dtos = rows.map(toUrlDtoWithoutScore);
  const max = maxTotalSv ?? dtos.reduce((m, u) => Math.max(m, totalSearchVolume(u)), 0);
  for (const u of dtos) {
    u.score = computeScore(totalSearchVolume(u), effectiveRank(u), max);
  }
  return dtos;
}

export async function getProjectMaxTotalSv(projectId: string): Promise<number> {
  const rows = await prisma.keywordMapUrl.findMany({ where: { projectId }, include: mapUrlInclude });
  return serializeUrls(rows).reduce((m, u) => Math.max(m, totalSearchVolume(u)), 0);
}

export async function loadUrlDto(id: string): Promise<MapUrlDto | null> {
  const row = await prisma.keywordMapUrl.findUnique({ where: { id }, include: mapUrlInclude });
  if (!row) return null;
  const max = await getProjectMaxTotalSv(row.projectId);
  return serializeUrls([row], max)[0];
}

export function parseDropdownOptions(value: Prisma.JsonValue | null): DropdownOptions {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as DropdownOptions;
}

/** Setzt (oder entfernt bei leerem Keyword) das Fokus-Keyword einer URL. */
export async function setFocusKeyword(
  urlId: string,
  keyword: string | null,
  searchVolume: number | null,
  source: KeywordSource
) {
  const kw = keyword ? normalizeKeyword(keyword) : "";
  await prisma.$transaction(async (tx) => {
    await tx.keywordMapKeyword.deleteMany({ where: { urlId, type: "focus" } });
    if (!kw) return;
    // Falls das Keyword bisher Subkeyword war, wird es zum Fokus befördert
    await tx.keywordMapKeyword.deleteMany({ where: { urlId, keyword: kw } });
    await tx.keywordMapKeyword.create({
      data: { urlId, keyword: kw, type: "focus", searchVolume, source, position: 0 },
    });
  });
}

/** Fügt Subkeywords hinzu; bereits vorhandene Keywords (auch das Fokus-Keyword) werden übersprungen. */
export async function addSubKeywords(
  urlId: string,
  items: Array<{ keyword: string; searchVolume?: number | null }>,
  source: KeywordSource
) {
  const existing = await prisma.keywordMapKeyword.findMany({ where: { urlId } });
  const seen = new Set(existing.map((k) => k.keyword));
  let position = existing.filter((k) => k.type === "sub").reduce((m, k) => Math.max(m, k.position), 0);
  const data: Prisma.KeywordMapKeywordCreateManyInput[] = [];
  for (const item of items) {
    const kw = normalizeKeyword(item.keyword);
    if (!kw || seen.has(kw)) continue;
    seen.add(kw);
    data.push({ urlId, keyword: kw, type: "sub", searchVolume: item.searchVolume ?? null, source, position: ++position });
  }
  if (data.length > 0) {
    await prisma.keywordMapKeyword.createMany({ data, skipDuplicates: true });
  }
  return data.length;
}
