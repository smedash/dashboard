import { prisma } from "@/lib/prisma";
import { getGSCSearchAnalytics, getDateRange, type GSCQueryRow } from "@/lib/gsc";
import { lookupInventoryId, toUrlKey } from "./normalize";

const PAGE_LIMIT = 25000;
const MAX_PAGES = 4;

function mergeRow(
  a: { clicks: number; impressions: number; ctr: number; position: number },
  b: { clicks: number; impressions: number; ctr: number; position: number }
) {
  const impressions = a.impressions + b.impressions;
  const clicks = a.clicks + b.clicks;
  const position =
    impressions > 0
      ? (a.position * a.impressions + b.position * b.impressions) / impressions
      : a.position;
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position,
  };
}

async function fetchPageChunk(
  userId: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  startRow: number,
  urlPathFilter?: string
): Promise<GSCQueryRow[]> {
  const data = await getGSCSearchAnalytics(userId, siteUrl, {
    startDate,
    endDate,
    dimensions: ["page"],
    rowLimit: PAGE_LIMIT,
    startRow,
    urlPathFilter,
  });
  return data.rows;
}

export async function listGscPrefixes(): Promise<string[]> {
  const sitemaps = await prisma.urlSitemap.findMany({
    where: { countryPath: { not: null } },
    select: { countryPath: true },
  });
  const set = new Set<string>();
  for (const s of sitemaps) {
    const p = s.countryPath?.trim().toLowerCase();
    if (!p) continue;
    set.add(`/${p.replace(/^\/+|\/+$/g, "")}/`);
  }
  return [...set].sort();
}

export async function resetGscOnInventory(period: string): Promise<{ reset: number }> {
  const r = await prisma.urlInventory.updateMany({
    data: {
      gscClicks: 0,
      gscImpressions: 0,
      gscCtr: 0,
      gscPosition: 0,
      gscHasData: false,
      gscPeriod: period,
      gscSyncedAt: new Date(),
    },
  });
  return { reset: r.count };
}

export async function applyGscRows(
  rows: GSCQueryRow[],
  period: string
): Promise<{ matched: number; unmatched: number }> {
  const inventory = await prisma.urlInventory.findMany({
    select: { id: true, urlKey: true, urlKeyNoHtml: true },
  });
  const byKey = new Map<string, string>();
  const byNoHtml = new Map<string, string>();
  for (const r of inventory) {
    byKey.set(r.urlKey, r.id);
    if (!byNoHtml.has(r.urlKeyNoHtml)) byNoHtml.set(r.urlKeyNoHtml, r.id);
  }

  const merged = new Map<
    string,
    { clicks: number; impressions: number; ctr: number; position: number }
  >();
  let unmatched = 0;

  for (const row of rows) {
    const page = row.keys[0];
    if (!page) continue;
    const keys = toUrlKey(page);
    if (!keys) {
      unmatched++;
      continue;
    }
    const id = lookupInventoryId(keys, byKey, byNoHtml);
    if (!id) {
      unmatched++;
      continue;
    }
    const next = {
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    };
    const prev = merged.get(id);
    merged.set(id, prev ? mergeRow(prev, next) : next);
  }

  const entries = [...merged.entries()];
  const BATCH = 200;
  const now = new Date();
  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH);
    await prisma.$transaction(
      slice.map(([id, m]) =>
        prisma.urlInventory.update({
          where: { id },
          data: {
            gscClicks: m.clicks,
            gscImpressions: m.impressions,
            gscCtr: m.ctr,
            gscPosition: m.position,
            gscHasData: m.impressions > 0 || m.clicks > 0,
            gscPeriod: period,
            gscSyncedAt: now,
          },
        })
      )
    );
  }

  return { matched: merged.size, unmatched };
}

export async function syncGscChunk(options: {
  userId: string;
  siteUrl: string;
  period: string;
  mode: "page" | "prefix";
  startRow?: number;
  prefix?: string;
}): Promise<{
  rows: number;
  matched: number;
  unmatched: number;
  hasMore: boolean;
  nextStartRow: number;
}> {
  const { startDate, endDate } = getDateRange(options.period);
  const startRow = options.startRow ?? 0;
  const rows = await fetchPageChunk(
    options.userId,
    options.siteUrl,
    startDate,
    endDate,
    startRow,
    options.mode === "prefix" ? options.prefix : undefined
  );
  const applied = await applyGscRows(rows, options.period);
  const nextStartRow = startRow + rows.length;
  const hasMore =
    options.mode === "page"
      ? rows.length >= PAGE_LIMIT && startRow / PAGE_LIMIT + 1 < MAX_PAGES
      : false;
  return {
    rows: rows.length,
    matched: applied.matched,
    unmatched: applied.unmatched,
    hasMore,
    nextStartRow,
  };
}
