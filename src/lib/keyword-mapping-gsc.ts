/**
 * Keyword Mapping: feste GSC-Property (URL-Präfix ubs.com).
 * Abgleich Editorial-URLs ↔ GSC-Seitenreport über normalisierten URL-Pfad.
 */

export const KEYWORD_MAPPING_GSC_SITE_URL = "https://www.ubs.com/";

export type GscPageMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscPageRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

function normalizePathname(pathname: string): string {
  let p = pathname.trim();
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p.toLowerCase();
}

/** Pfad aus GSC-Zeile (volle Seiten-URL). */
export function pathnameFromGscPageKey(pageKey: string): string | null {
  try {
    const u = new URL(pageKey);
    return normalizePathname(u.pathname);
  } catch {
    return null;
  }
}

const EDITORIAL_URL_ORIGIN_FALLBACK = "https://www.ubs.com";

/** Pfad aus Redaktions-URL (absolut oder relativ zur ubs-Domain). */
export function pathnameFromEditorialUrl(url: string): string | null {
  const t = url.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    return normalizePathname(u.pathname);
  } catch {
    try {
      const base = EDITORIAL_URL_ORIGIN_FALLBACK.endsWith("/")
        ? EDITORIAL_URL_ORIGIN_FALLBACK
        : `${EDITORIAL_URL_ORIGIN_FALLBACK}/`;
      const u = new URL(t, base);
      return normalizePathname(u.pathname);
    } catch {
      return null;
    }
  }
}

function mergeMetrics(a: GscPageMetrics, b: GscPageMetrics): GscPageMetrics {
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

export function buildGscMetricsByPathname(rows: GscPageRow[]): Map<string, GscPageMetrics> {
  const map = new Map<string, GscPageMetrics>();
  for (const row of rows) {
    const key = row.keys[0];
    if (!key) continue;
    const path = pathnameFromGscPageKey(key);
    if (!path) continue;
    const next: GscPageMetrics = {
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    };
    const existing = map.get(path);
    map.set(path, existing ? mergeMetrics(existing, next) : next);
  }
  return map;
}

export function lookupGscMetrics(
  map: Map<string, GscPageMetrics>,
  url: string | null | undefined
): GscPageMetrics | null {
  if (!url?.trim()) return null;
  const path = pathnameFromEditorialUrl(url);
  if (!path) return null;
  const direct = map.get(path);
  if (direct) return direct;
  try {
    const decoded = decodeURIComponent(path);
    if (decoded !== path) {
      const n = normalizePathname(decoded);
      return map.get(n) ?? null;
    }
  } catch {
    /* ignore */
  }
  return null;
}
