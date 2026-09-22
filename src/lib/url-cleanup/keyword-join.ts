import { prisma } from "@/lib/prisma";
import { lookupInventoryId, toUrlKey } from "./normalize";

export type LabsKw = {
  keyword: string;
  rankGroup: number;
  rankAbsolute: number | null;
  searchVolume: number | null;
};

export async function syncFocusKeywordsFromMapping(): Promise<{
  articles: number;
  matched: number;
}> {
  await prisma.urlInventory.updateMany({
    data: {
      hasFocusKeywords: false,
      focusKeywords: [],
      inEditorialPlan: false,
      editorialH1: null,
      editorialMeta: null,
      editorialCategory: null,
      editorialLocation: null,
    },
  });

  const articles = await prisma.editorialPlanArticle.findMany({
    where: { url: { not: null } },
    select: {
      id: true,
      url: true,
      h1: true,
      metaDescription: true,
      category: true,
      location: true,
    },
  });

  const run = await prisma.keywordMappingRun.findFirst({
    orderBy: { createdAt: "desc" },
    include: { results: true },
  });

  const kwByArticle = new Map<string, string[]>();
  if (run) {
    for (const r of run.results) {
      try {
        const parsed = JSON.parse(r.focusKeywords) as unknown;
        const arr = Array.isArray(parsed)
          ? parsed.map((x) => String(x).trim()).filter(Boolean)
          : [];
        kwByArticle.set(r.articleId, arr);
      } catch {
        /* ignore */
      }
    }
  }

  const inventory = await prisma.urlInventory.findMany({
    select: { id: true, urlKey: true, urlKeyNoHtml: true },
  });
  const byKey = new Map<string, string>();
  const byNoHtml = new Map<string, string>();
  for (const r of inventory) {
    byKey.set(r.urlKey, r.id);
    if (!byNoHtml.has(r.urlKeyNoHtml)) byNoHtml.set(r.urlKeyNoHtml, r.id);
  }

  type Patch = {
    id: string;
    focusKeywords: string[];
    h1: string | null;
    meta: string | null;
    category: string | null;
    location: string | null;
  };
  const patches = new Map<string, Patch>();

  for (const a of articles) {
    if (!a.url) continue;
    const keys = toUrlKey(a.url);
    if (!keys) continue;
    const id = lookupInventoryId(keys, byKey, byNoHtml);
    if (!id) continue;
    const kws = kwByArticle.get(a.id) ?? [];
    const prev = patches.get(id);
    if (!prev) {
      patches.set(id, {
        id,
        focusKeywords: kws,
        h1: a.h1,
        meta: a.metaDescription,
        category: a.category,
        location: a.location,
      });
    } else {
      const set = new Set([...prev.focusKeywords, ...kws]);
      prev.focusKeywords = [...set];
      prev.h1 = prev.h1 || a.h1;
      prev.meta = prev.meta || a.metaDescription;
      prev.category = prev.category || a.category;
      prev.location = prev.location || a.location;
    }
  }

  const list = [...patches.values()];
  const BATCH = 200;
  for (let i = 0; i < list.length; i += BATCH) {
    const slice = list.slice(i, i + BATCH);
    await prisma.$transaction(
      slice.map((p) =>
        prisma.urlInventory.update({
          where: { id: p.id },
          data: {
            inEditorialPlan: true,
            hasFocusKeywords: p.focusKeywords.length > 0,
            focusKeywords: p.focusKeywords,
            editorialH1: p.h1,
            editorialMeta: p.meta,
            editorialCategory: p.category,
            editorialLocation: p.location,
          },
        })
      )
    );
  }

  return { articles: articles.length, matched: list.length };
}

export async function syncLabsFromCache(): Promise<{ cache: number; matched: number }> {
  await prisma.urlInventory.updateMany({
    data: {
      labsHasData: false,
      labsKeywordCount: 0,
      labsBestRank: null,
      labsMaxSearchVolume: null,
      labsKeywords: [],
      labsFetchedAt: null,
    },
  });

  const cache = await prisma.rankedKeywordsCache.findMany();
  const inventory = await prisma.urlInventory.findMany({
    select: { id: true, urlKey: true, urlKeyNoHtml: true },
  });
  const byKey = new Map<string, string>();
  const byNoHtml = new Map<string, string>();
  for (const r of inventory) {
    byKey.set(r.urlKey, r.id);
    if (!byNoHtml.has(r.urlKeyNoHtml)) byNoHtml.set(r.urlKeyNoHtml, r.id);
  }

  type LabsPatch = {
    id: string;
    count: number;
    bestRank: number | null;
    maxVol: number | null;
    keywords: string[];
    fetchedAt: Date;
    has: boolean;
  };
  const patches = new Map<string, LabsPatch>();

  for (const c of cache) {
    const keys = toUrlKey(c.url);
    if (!keys) continue;
    const id = lookupInventoryId(keys, byKey, byNoHtml);
    if (!id) continue;
    let kws: LabsKw[] = [];
    try {
      kws = JSON.parse(c.keywords) as LabsKw[];
      if (!Array.isArray(kws)) kws = [];
    } catch {
      kws = [];
    }
    const fields = labsInventoryFields(kws, c.error, c.fetchedAt);
    patches.set(id, {
      id,
      count: fields.labsKeywordCount,
      bestRank: fields.labsBestRank,
      maxVol: fields.labsMaxSearchVolume,
      keywords: fields.labsKeywords,
      fetchedAt: fields.labsFetchedAt,
      has: fields.labsHasData,
    });
  }

  const list = [...patches.values()];
  const BATCH = 200;
  for (let i = 0; i < list.length; i += BATCH) {
    const slice = list.slice(i, i + BATCH);
    await prisma.$transaction(
      slice.map((p) =>
        prisma.urlInventory.update({
          where: { id: p.id },
          data: {
            labsHasData: p.has,
            labsKeywordCount: p.count,
            labsBestRank: p.bestRank,
            labsMaxSearchVolume: p.maxVol,
            labsKeywords: p.keywords,
            labsFetchedAt: p.fetchedAt,
          },
        })
      )
    );
  }

  return { cache: cache.length, matched: list.length };
}

export function labsInventoryFields(
  kws: LabsKw[],
  error: string | null | undefined,
  fetchedAt: Date
) {
  const has = kws.length > 0 && !error;
  const bestRank = has
    ? kws.reduce((m, k) => (m == null || k.rankGroup < m ? k.rankGroup : m), null as number | null)
    : null;
  const maxVol = has
    ? kws.reduce((m, k) => {
        const v = k.searchVolume ?? 0;
        return v > m ? v : m;
      }, 0)
    : null;
  return {
    labsHasData: has,
    labsKeywordCount: kws.length,
    labsBestRank: bestRank,
    labsMaxSearchVolume: maxVol === 0 ? 0 : maxVol,
    labsKeywords: kws.map((k) => k.keyword),
    labsFetchedAt: fetchedAt,
  };
}

export async function applyLabsToInventory(
  rows: Array<{ id: string; keywords: LabsKw[]; error?: string | null; fetchedAt: Date }>
) {
  if (rows.length === 0) return;
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    await prisma.$transaction(
      slice.map((p) =>
        prisma.urlInventory.update({
          where: { id: p.id },
          data: labsInventoryFields(p.keywords, p.error, p.fetchedAt),
        })
      )
    );
  }
}

export function labsKeywordsFromCacheJson(raw: string): LabsKw[] {
  try {
    const parsed = JSON.parse(raw) as LabsKw[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
