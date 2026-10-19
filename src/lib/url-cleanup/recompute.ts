import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cleanupStatusFromKillBand } from "./cleanup-status";
import { computeKillScore } from "./kill-score";
import {
  isLanguageInheritedKeep,
  languageVariantOf,
  planLanguageKeepUpdates,
  type LanguageKeepMember,
  type LanguageKeepUpdate,
} from "./language-keep";
import { getKillSettings } from "./settings";

const BATCH = 2000;

const SCORE_SELECT = {
  id: true,
  url: true,
  urlKey: true,
  gscClicks: true,
  gscImpressions: true,
  gscPeriod: true,
  aaVisits: true,
  aaFormSuccess: true,
  aaHasData: true,
  aaTimeSpentHasData: true,
  aaTimeSpentVisits: true,
  aaTimeSpentShortPct: true,
  aaTimeSpentEngagedPct: true,
  hasFocusKeywords: true,
  labsHasData: true,
  labsFetchedAt: true,
  labsBestRank: true,
  labsMaxSearchVolume: true,
  lastmod: true,
  cleanupStatus: true,
  killBand: true,
  killReason: true,
} as const;

const LANGUAGE_ROW_SELECT = {
  id: true,
  urlKey: true,
  urlKeyNoHtml: true,
  killBand: true,
  killReason: true,
  killConfidence: true,
  cleanupStatus: true,
} as const;

type ScoreRow = {
  id: string;
  url: string;
  urlKey: string;
  gscClicks: number;
  gscImpressions: number;
  gscPeriod: string | null;
  aaVisits: number;
  aaFormSuccess: number;
  aaHasData: boolean;
  aaTimeSpentHasData: boolean;
  aaTimeSpentVisits: number;
  aaTimeSpentShortPct: number;
  aaTimeSpentEngagedPct: number;
  hasFocusKeywords: boolean;
  labsHasData: boolean;
  labsFetchedAt: Date | null;
  labsBestRank: number | null;
  labsMaxSearchVolume: number | null;
  lastmod: Date | null;
  cleanupStatus: string;
  killBand: string;
  killReason: string;
};

export async function recomputeKillScoreChunk(cursor?: string): Promise<{
  done: boolean;
  batchUpdated: number;
  nextCursor: string | null;
  total: number;
  languageKeeps?: number;
}> {
  const [settings, total] = await Promise.all([getKillSettings(), prisma.urlInventory.count()]);
  const rows = await prisma.urlInventory.findMany({
    take: BATCH,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { id: "asc" },
    select: SCORE_SELECT,
  });
  if (rows.length === 0) {
    const languageKeeps = (await propagateLanguageKeeps()).updated;
    return { done: true, batchUpdated: 0, nextCursor: null, total, languageKeeps };
  }
  await applyBatch(rows, settings);
  const nextCursor = rows[rows.length - 1].id;
  return { done: false, batchUpdated: rows.length, nextCursor, total };
}

export async function recomputeKillScores(options?: {
  ids?: string[];
}): Promise<{ updated: number; languageKeptIds?: string[] }> {
  const settings = await getKillSettings();

  if (options?.ids?.length) {
    const rows = await prisma.urlInventory.findMany({
      where: { id: { in: options.ids } },
      select: SCORE_SELECT,
    });
    await applyBatch(rows, settings);
    const propagated = await propagateLanguageKeeps({ seedIds: options.ids });
    const seedSet = new Set(options.ids);
    return {
      updated: rows.length,
      languageKeptIds: propagated.updatedIds.filter((id) => seedSet.has(id)),
    };
  }

  let updated = 0;
  let cursor: string | undefined;
  for (;;) {
    const chunk = await recomputeKillScoreChunk(cursor);
    updated += chunk.batchUpdated;
    if (chunk.done || !chunk.nextCursor) break;
    cursor = chunk.nextCursor;
  }
  return { updated };
}

/** Setzt den Status aus dem aktuellen Kill-Band — analog zur 3D-Wolke. */
export async function syncCleanupStatusFromKillBand(): Promise<{ updated: number }> {
  const result = await prisma.$executeRaw`
    UPDATE "UrlInventory"
    SET "cleanupStatus" = CASE "killBand"
      WHEN 'protected' THEN 'mustKeep'
      WHEN 'keep' THEN 'keep'
      WHEN 'high' THEN 'kill'
      ELSE 'candidate'
    END
    WHERE "cleanupStatus" IS DISTINCT FROM CASE "killBand"
      WHEN 'protected' THEN 'mustKeep'
      WHEN 'keep' THEN 'keep'
      WHEN 'high' THEN 'kill'
      ELSE 'candidate'
    END
  `;
  return { updated: Number(result) };
}

/** Hebt Kill/Candidate an, wenn eine andere Sprachversion derselben Seite Keep ist. */
export async function propagateLanguageKeeps(options?: {
  seedIds?: string[];
}): Promise<{ updated: number; updatedIds: string[] }> {
  const seedIds = options?.seedIds?.filter(Boolean) ?? [];
  const rows =
    seedIds.length > 0 ? await loadLanguageGroupsForSeeds(seedIds) : await loadLanguageRows();
  const updates = planLanguageKeepUpdates(rows);
  await writeLanguageKeepUpdates(updates);
  return { updated: updates.length, updatedIds: updates.map((row) => row.id) };
}

async function loadLanguageGroupsForSeeds(seedIds: string[]): Promise<LanguageKeepMember[]> {
  const seeds = await loadLanguageRows(seedIds);
  const groupKeys = new Set<string>();
  for (const row of seeds) {
    const variant = languageVariantOf(row.urlKeyNoHtml || row.urlKey);
    if (variant) groupKeys.add(variant.groupKey);
  }
  if (groupKeys.size === 0) return [];

  let rows = await loadRowsByGroupKeys([...groupKeys]);
  const hasSourceKeep = rows.some(
    (row) => row.killBand === "keep" && row.killReason.trim() !== "" && !isLanguageInheritedKeep(row.killReason)
  );
  if (hasSourceKeep) return rows;

  const inheritedIds = rows
    .filter((row) => row.killBand === "keep" && isLanguageInheritedKeep(row.killReason))
    .map((row) => row.id);
  if (inheritedIds.length === 0) return rows;
  await rescoreByIds(inheritedIds);
  rows = await loadLanguageRows(rows.map((row) => row.id));
  return rows;
}

function groupKeyToPattern(groupKey: string): string {
  const star = groupKey.indexOf("*");
  const before = groupKey.slice(0, star);
  const after = groupKey.slice(star + 1);
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `^${escape(before)}[a-z]{2}(?:-[a-z]{2})?${escape(after)}$`;
}

async function loadRowsByGroupKeys(groupKeys: string[]): Promise<LanguageKeepMember[]> {
  if (groupKeys.length === 0) return [];
  const rows: LanguageKeepMember[] = [];
  for (let i = 0; i < groupKeys.length; i += 100) {
    const patterns = groupKeys.slice(i, i + 100).map(groupKeyToPattern);
    const batch = await prisma.$queryRaw<LanguageKeepMember[]>`
      SELECT id, "urlKey", "urlKeyNoHtml", "killBand", "killReason", "killConfidence"::int, "cleanupStatus"
      FROM "UrlInventory"
      WHERE ${Prisma.join(
        patterns.map((pattern) => Prisma.sql`"urlKeyNoHtml" ~ ${pattern}`),
        " OR "
      )}
    `;
    rows.push(...batch);
  }
  return rows;
}

async function loadLanguageRows(ids?: string[]): Promise<LanguageKeepMember[]> {
  if (ids && ids.length === 0) return [];
  const rows: LanguageKeepMember[] = [];
  if (!ids) {
    let cursor: string | undefined;
    for (;;) {
      const batch = await prisma.urlInventory.findMany({
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
        select: LANGUAGE_ROW_SELECT,
      });
      rows.push(...batch);
      if (batch.length < BATCH) break;
      cursor = batch[batch.length - 1].id;
    }
    return rows;
  }

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = await prisma.urlInventory.findMany({
      where: { id: { in: ids.slice(i, i + BATCH) } },
      select: LANGUAGE_ROW_SELECT,
    });
    rows.push(...batch);
  }
  return rows;
}

async function rescoreByIds(ids: string[]) {
  const settings = await getKillSettings();
  for (let i = 0; i < ids.length; i += BATCH) {
    const scoreRows = await prisma.urlInventory.findMany({
      where: { id: { in: ids.slice(i, i + BATCH) } },
      select: SCORE_SELECT,
    });
    await applyBatch(scoreRows, settings);
  }
}

async function writeLanguageKeepUpdates(updates: LanguageKeepUpdate[]) {
  for (let i = 0; i < updates.length; i += BATCH) {
    const tuples = updates.slice(i, i + BATCH).map(
      (row) =>
        Prisma.sql`(${row.killConfidence}::int, ${row.killReason}::text, ${row.killBand}::text, ${row.cleanupStatus}::text, ${row.id}::text)`
    );
    await prisma.$executeRaw`
      UPDATE "UrlInventory" AS u SET
        "killConfidence" = v.confidence,
        "killReason" = v.reason,
        "killBand" = v.band,
        "cleanupStatus" = v.status
      FROM (VALUES ${Prisma.join(tuples)}) AS v(confidence, reason, band, status, id)
      WHERE u.id = v.id
    `;
  }
}

async function applyBatch(
  rows: ScoreRow[],
  settings: Awaited<ReturnType<typeof getKillSettings>>
) {
  if (rows.length === 0) return;

  const tuples = rows.map((row) => {
    const score = computeKillScore(row, settings);
    const status = cleanupStatusFromKillBand(score.killBand);
    return Prisma.sql`(${score.killConfidence}::int, ${score.killReason}::text, ${score.killBand}::text, ${status}::text, ${row.id}::text)`;
  });

  await prisma.$executeRaw`
    UPDATE "UrlInventory" AS u SET
      "killConfidence" = v.confidence,
      "killReason" = v.reason,
      "killBand" = v.band,
      "cleanupStatus" = v.status
    FROM (VALUES ${Prisma.join(tuples)}) AS v(confidence, reason, band, status, id)
    WHERE u.id = v.id
  `;
}
