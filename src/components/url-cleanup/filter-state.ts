export type InventoryFilters = {
  q: string;
  country: string;
  language: string;
  sitemapId: string;
  gscHasData: string;
  aaHasData: string;
  aaSegment: string;
  hasFocusKeywords: string;
  inEditorialPlan: string;
  labsHasData: string;
  cleanupStatus: string;
  killBand: string;
  preset: string;
  minKillConfidence: string;
  maxKillConfidence: string;
  minGscClicks: string;
  maxGscClicks: string;
  minAaVisits: string;
  maxAaVisits: string;
  minAaFormSuccess: string;
  sort: string;
  sortDir: string;
};

export const EMPTY_FILTERS: InventoryFilters = {
  q: "",
  country: "",
  language: "",
  sitemapId: "",
  gscHasData: "",
  aaHasData: "",
  aaSegment: "",
  hasFocusKeywords: "",
  inEditorialPlan: "",
  labsHasData: "",
  cleanupStatus: "",
  killBand: "",
  preset: "",
  minKillConfidence: "",
  maxKillConfidence: "",
  minGscClicks: "",
  maxGscClicks: "",
  minAaVisits: "",
  maxAaVisits: "",
  minAaFormSuccess: "",
  sort: "killConfidence",
  sortDir: "desc",
};

export function filtersToParams(f: InventoryFilters, page: number, pageSize = 25): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v !== "") p.set(k, v);
  }
  p.set("page", String(page));
  p.set("pageSize", String(pageSize));
  return p;
}

export function filtersFromSearchParams(sp: URLSearchParams): InventoryFilters {
  const next = { ...EMPTY_FILTERS };
  (Object.keys(EMPTY_FILTERS) as Array<keyof InventoryFilters>).forEach((k) => {
    const v = sp.get(k);
    if (v != null && v !== "") next[k] = v;
  });
  return next;
}
