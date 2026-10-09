import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cleanupStatusFromKillBand } from "./cleanup-status";
import { computeKillScore } from "./kill-score";
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
}> {
  const [settings, total] = await Promise.all([getKillSettings(), prisma.urlInventory.count()]);
  const rows = await prisma.urlInventory.findMany({
    take: BATCH,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { id: "asc" },
    select: SCORE_SELECT,
  });
  if (rows.length === 0) {
    return { done: true, batchUpdated: 0, nextCursor: null, total };
  }
  await applyBatch(rows, settings);
  const nextCursor = rows[rows.length - 1].id;
  const done = rows.length < BATCH;
  return { done, batchUpdated: rows.length, nextCursor: done ? null : nextCursor, total };
}

export async function recomputeKillScores(options?: { ids?: string[] }): Promise<{ updated: number }> {
  const settings = await getKillSettings();

  if (options?.ids?.length) {
    const rows = await prisma.urlInventory.findMany({
      where: { id: { in: options.ids } },
      select: SCORE_SELECT,
    });
    await applyBatch(rows, settings);
    return { updated: rows.length };
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
