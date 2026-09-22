import { fetchRankedKeywordsForPageTargets } from "@/lib/dataforseo";
import { prisma } from "@/lib/prisma";
import { applyLabsToInventory, labsKeywordsFromCacheJson, type LabsKw } from "./keyword-join";
import { canonicalUbsUrl, normalizeUbsPageUrl } from "./normalize";

const FETCH_LIMIT = 24;
const SCAN_CAP = 800;
const BACKFILL_LIMIT = 100;

function cacheUrlForRow(url: string, urlKey: string): string | null {
  return normalizeUbsPageUrl(url) ?? (urlKey ? canonicalUbsUrl(urlKey) : null);
}

export async function rankedKeywordsSyncStatus(): Promise<{
  inventoryCount: number;
  cacheCount: number;
  withRankings: number;
  missing: number;
}> {
  const [inventoryCount, cacheCount, withRankings, fetched] = await Promise.all([
    prisma.urlInventory.count(),
    prisma.rankedKeywordsCache.count(),
    prisma.urlInventory.count({ where: { labsHasData: true } }),
    prisma.urlInventory.count({ where: { labsFetchedAt: { not: null } } }),
  ]);
  return {
    inventoryCount,
    cacheCount,
    withRankings,
    missing: Math.max(0, inventoryCount - fetched),
  };
}

export async function rankedKeywordsSyncChunk(cursor?: string): Promise<{
  done: boolean;
  nextCursor: string | null;
  fetched: number;
  skipped: number;
  backfilled: number;
  withKeywords: number;
  errors: number;
  missing: number;
  inventoryCount: number;
}> {
  if (!process.env.DATAFORSEO_USERNAME?.trim() || !process.env.DATAFORSEO_PASSWORD?.trim()) {
    const err = new Error("DataForSEO API-Zugangsdaten fehlen");
    (err as Error & { code?: string }).code = "needsCredentials";
    throw err;
  }

  const toFetch: Array<{ id: string; url: string; cacheUrl: string }> = [];
  const toBackfill: Array<{ id: string; keywords: LabsKw[]; error: string | null; fetchedAt: Date }> = [];
  let skipped = 0;
  let lastId: string | null = cursor ?? null;
  let scanned = 0;
  let exhausted = false;

  while (toFetch.length < FETCH_LIMIT && toBackfill.length < BACKFILL_LIMIT && scanned < SCAN_CAP) {
    const rows = await prisma.urlInventory.findMany({
      take: 100,
      where: {
        labsFetchedAt: null,
        ...(lastId ? { id: { gt: lastId } } : {}),
      },
      orderBy: { id: "asc" },
      select: { id: true, url: true, urlKey: true, labsFetchedAt: true },
    });
    if (rows.length === 0) {
      exhausted = true;
      break;
    }

    const candidates = rows.map((row) => ({
      id: row.id,
      url: row.url,
      cacheUrl: cacheUrlForRow(row.url, row.urlKey),
    }));
    const urls = candidates.map((c) => c.cacheUrl).filter((u): u is string => Boolean(u));
    const cached = urls.length
      ? await prisma.rankedKeywordsCache.findMany({
          where: { url: { in: urls } },
          select: { url: true, keywords: true, error: true, fetchedAt: true },
        })
      : [];
    const cachedByUrl = new Map(cached.map((c) => [c.url, c]));

    let stoppedEarly = false;
    for (const row of candidates) {
      const hit = row.cacheUrl ? cachedByUrl.get(row.cacheUrl) : undefined;
      const isBackfill = !row.cacheUrl || Boolean(hit);
      if (isBackfill) {
        if (toBackfill.length >= BACKFILL_LIMIT) {
          stoppedEarly = true;
          break;
        }
        lastId = row.id;
        scanned += 1;
        toBackfill.push({
          id: row.id,
          keywords: hit ? labsKeywordsFromCacheJson(hit.keywords) : [],
          error: hit?.error ?? (!row.cacheUrl ? "Ungültige oder nicht-UBS-URL" : null),
          fetchedAt: hit?.fetchedAt ?? new Date(),
        });
        continue;
      }
      if (toFetch.length >= FETCH_LIMIT) {
        stoppedEarly = true;
        break;
      }
      lastId = row.id;
      scanned += 1;
      toFetch.push({ id: row.id, url: row.url, cacheUrl: row.cacheUrl as string });
    }

    if (!stoppedEarly && rows.length < 100) {
      exhausted = true;
      break;
    }
    if (stoppedEarly) break;
  }

  if (toBackfill.length > 0) {
    await applyLabsToInventory(toBackfill);
  }

  let withKeywords = 0;
  let errors = 0;

  if (toFetch.length > 0) {
    const now = new Date();
    const locationName = process.env.DATAFORSEO_LABS_LOCATION_NAME?.trim() || null;
    const languageName = process.env.DATAFORSEO_LABS_LANGUAGE_NAME?.trim() || null;
    const map = await fetchRankedKeywordsForPageTargets(
      toFetch.map((t) => ({ tag: t.id, target: t.cacheUrl })),
      { limit: 5, concurrency: 4 }
    );

    const inventoryWrites: Array<{
      id: string;
      keywords: LabsKw[];
      error?: string | null;
      fetchedAt: Date;
    }> = [];
    const upserts = toFetch.map((t) => {
      const result = map.get(t.id);
      const keywords = (result?.keywords ?? []) as LabsKw[];
      const error = result?.error ?? null;
      if (error) errors += 1;
      if (keywords.length > 0 && !error) withKeywords += 1;
      inventoryWrites.push({ id: t.id, keywords, error, fetchedAt: now });
      return prisma.rankedKeywordsCache.upsert({
        where: { url: t.cacheUrl },
        update: {
          keywords: JSON.stringify(keywords),
          error,
          location: locationName,
          language: languageName,
          fetchedAt: now,
        },
        create: {
          url: t.cacheUrl,
          keywords: JSON.stringify(keywords),
          error,
          location: locationName,
          language: languageName,
          fetchedAt: now,
        },
      });
    });

    await prisma.$transaction(upserts);
    await applyLabsToInventory(inventoryWrites);
  }

  const [inventoryCount, fetchedCount] = await Promise.all([
    prisma.urlInventory.count(),
    prisma.urlInventory.count({ where: { labsFetchedAt: { not: null } } }),
  ]);

  const done = exhausted;
  return {
    done,
    nextCursor: done ? null : lastId,
    fetched: toFetch.length,
    skipped,
    backfilled: toBackfill.length,
    withKeywords,
    errors,
    missing: Math.max(0, inventoryCount - fetchedCount),
    inventoryCount,
  };
}
