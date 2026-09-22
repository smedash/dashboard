import type { Prisma } from "@prisma/client";

export type InventoryListQuery = {
  q?: string;
  country?: string;
  language?: string;
  sitemapId?: string;
  section?: string;
  gscHasData?: boolean;
  aaHasData?: boolean;
  aaSegment?: string;
  hasFocusKeywords?: boolean;
  inEditorialPlan?: boolean;
  labsHasData?: boolean;
  cleanupStatus?: string;
  killBand?: string;
  minKillConfidence?: number;
  maxKillConfidence?: number;
  minGscClicks?: number;
  maxGscClicks?: number;
  minGscImpressions?: number;
  maxGscImpressions?: number;
  minAaVisits?: number;
  maxAaVisits?: number;
  minAaFormSuccess?: number;
  maxAaFormSuccess?: number;
  lastmodBefore?: string;
  focusKeyword?: string;
  labsKeyword?: string;
  preset?: "high" | "zero" | "";
  page?: number;
  pageSize?: number;
  sort?: string;
  sortDir?: "asc" | "desc";
};

export function parseInventoryQuery(sp: URLSearchParams): InventoryListQuery {
  const bool = (k: string): boolean | undefined => {
    const v = sp.get(k);
    if (v === "true") return true;
    if (v === "false") return false;
    return undefined;
  };
  const num = (k: string): number | undefined => {
    const v = sp.get(k);
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const preset = sp.get("preset");
  return {
    q: sp.get("q")?.trim() || undefined,
    country: sp.get("country")?.trim() || undefined,
    language: sp.get("language")?.trim() || undefined,
    sitemapId: sp.get("sitemapId")?.trim() || undefined,
    section: sp.get("section")?.trim() || undefined,
    gscHasData: bool("gscHasData"),
    aaHasData: bool("aaHasData"),
    aaSegment: sp.get("aaSegment")?.trim() || undefined,
    hasFocusKeywords: bool("hasFocusKeywords"),
    inEditorialPlan: bool("inEditorialPlan"),
    labsHasData: bool("labsHasData"),
    cleanupStatus: sp.get("cleanupStatus")?.trim() || undefined,
    killBand: sp.get("killBand")?.trim() || undefined,
    minKillConfidence: num("minKillConfidence"),
    maxKillConfidence: num("maxKillConfidence"),
    minGscClicks: num("minGscClicks"),
    maxGscClicks: num("maxGscClicks"),
    minGscImpressions: num("minGscImpressions"),
    maxGscImpressions: num("maxGscImpressions"),
    minAaVisits: num("minAaVisits"),
    maxAaVisits: num("maxAaVisits"),
    minAaFormSuccess: num("minAaFormSuccess"),
    maxAaFormSuccess: num("maxAaFormSuccess"),
    lastmodBefore: sp.get("lastmodBefore")?.trim() || undefined,
    focusKeyword: sp.get("focusKeyword")?.trim() || undefined,
    labsKeyword: sp.get("labsKeyword")?.trim() || undefined,
    preset: preset === "high" || preset === "zero" ? preset : "",
    page: num("page") ?? 0,
    pageSize: Math.min(num("pageSize") ?? 25, 200),
    sort: sp.get("sort")?.trim() || "killConfidence",
    sortDir: sp.get("sortDir") === "asc" ? "asc" : "desc",
  };
}

export function buildInventoryWhere(q: InventoryListQuery): Prisma.UrlInventoryWhereInput {
  const and: Prisma.UrlInventoryWhereInput[] = [];

  if (q.preset === "high") {
    and.push({ killBand: "high" });
  } else if (q.preset === "zero") {
    and.push({ gscImpressions: 0, aaVisits: 0, aaFormSuccess: 0 });
  }

  if (q.q) {
    and.push({
      OR: [
        { url: { contains: q.q, mode: "insensitive" } },
        { urlKey: { contains: q.q.toLowerCase() } },
      ],
    });
  }
  if (q.country) and.push({ country: q.country });
  if (q.language) and.push({ language: q.language });
  if (q.section) and.push({ section: q.section });
  if (q.sitemapId) {
    and.push({ sitemaps: { some: { sitemapId: q.sitemapId } } });
  }
  if (q.gscHasData !== undefined) and.push({ gscHasData: q.gscHasData });
  if (q.aaHasData !== undefined) and.push({ aaHasData: q.aaHasData });
  if (q.aaSegment) and.push({ aaSegments: { has: q.aaSegment } });
  if (q.hasFocusKeywords !== undefined) and.push({ hasFocusKeywords: q.hasFocusKeywords });
  if (q.inEditorialPlan !== undefined) and.push({ inEditorialPlan: q.inEditorialPlan });
  if (q.labsHasData !== undefined) and.push({ labsHasData: q.labsHasData });
  if (q.cleanupStatus) and.push({ cleanupStatus: q.cleanupStatus });
  if (q.killBand) and.push({ killBand: q.killBand });
  if (q.minKillConfidence !== undefined) and.push({ killConfidence: { gte: q.minKillConfidence } });
  if (q.maxKillConfidence !== undefined) and.push({ killConfidence: { lte: q.maxKillConfidence } });
  if (q.minGscClicks !== undefined) and.push({ gscClicks: { gte: q.minGscClicks } });
  if (q.maxGscClicks !== undefined) and.push({ gscClicks: { lte: q.maxGscClicks } });
  if (q.minGscImpressions !== undefined) and.push({ gscImpressions: { gte: q.minGscImpressions } });
  if (q.maxGscImpressions !== undefined) and.push({ gscImpressions: { lte: q.maxGscImpressions } });
  if (q.minAaVisits !== undefined) and.push({ aaVisits: { gte: q.minAaVisits } });
  if (q.maxAaVisits !== undefined) and.push({ aaVisits: { lte: q.maxAaVisits } });
  if (q.minAaFormSuccess !== undefined) and.push({ aaFormSuccess: { gte: q.minAaFormSuccess } });
  if (q.maxAaFormSuccess !== undefined) and.push({ aaFormSuccess: { lte: q.maxAaFormSuccess } });
  if (q.lastmodBefore) {
    const d = new Date(q.lastmodBefore);
    if (!Number.isNaN(d.getTime())) and.push({ lastmod: { lt: d } });
  }
  if (q.focusKeyword) {
    and.push({ focusKeywords: { has: q.focusKeyword } });
  }
  if (q.labsKeyword) {
    and.push({ labsKeywords: { has: q.labsKeyword } });
  }

  return and.length ? { AND: and } : {};
}

const SORTABLE: Record<string, true> = {
  url: true,
  country: true,
  language: true,
  gscClicks: true,
  gscImpressions: true,
  gscPosition: true,
  aaVisits: true,
  aaFormSuccess: true,
  killConfidence: true,
  lastmod: true,
  cleanupStatus: true,
  labsBestRank: true,
  labsMaxSearchVolume: true,
};

export function buildInventoryOrderBy(
  sort?: string,
  sortDir?: "asc" | "desc"
): Prisma.UrlInventoryOrderByWithRelationInput {
  const field = sort && SORTABLE[sort] ? sort : "killConfidence";
  const dir = sortDir === "asc" ? "asc" : "desc";
  return { [field]: dir } as Prisma.UrlInventoryOrderByWithRelationInput;
}
