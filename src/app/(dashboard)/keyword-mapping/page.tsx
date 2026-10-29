"use client";

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { downloadExcel } from "@/lib/excel-export";
import {
  KEYWORD_MAPPING_GSC_SITE_URL,
  type GscPageMetrics,
  type GscPageRow,
  buildGscMetricsByPathname,
  lookupGscMetrics,
} from "@/lib/keyword-mapping-gsc";
import { useLocale, useMessages } from "@/i18n/I18nProvider";
import { keywordMappingMessages } from "@/i18n/messages/keyword-mapping";

interface Article {
  id: string;
  title: string;
  url: string | null;
  language: string | null;
  metaDescription: string | null;
  h1: string | null;
  category: string | null;
  location: string | null;
}

interface KeywordResult {
  id: string;
  focusKeywords: string[];
  reasoning: string;
}

interface OverlapGroup {
  keyword: string;
  articles: Array<{ id: string; title: string; url: string | null; language?: string | null; location?: string | null }>;
}

type LabsRankedKeywordRow = {
  keyword: string;
  rankGroup: number;
  rankAbsolute: number | null;
  searchVolume: number | null;
};

type LabsKwArticleState =
  | { status: "loading" }
  | { status: "ok"; keywords: LabsRankedKeywordRow[]; apiError?: string }
  | { status: "error"; message: string; needsCredentials?: boolean };

interface AnalysisData {
  id?: string;
  analyzed: number;
  total: number;
  createdAt?: string;
  results: KeywordResult[];
  overlaps: OverlapGroup[];
}

let _cachedArticles: Article[] | null = null;
let _cachedAnalysisData: AnalysisData | null = null;
let _lastFetchTime = 0;
const CACHE_TTL = 60_000;
const PAGE_SIZE = 25;
/** Suche erst nach Pause auslösen, damit große Datenmengen nicht bei jedem Tastendruck filtern. */
const SEARCH_DEBOUNCE_MS = 350;
/** Einzelne Zeichen matchen fast alles und sind extrem teuer — erst ab dieser Länge filtern. */
const MIN_SEARCH_CHARS = 2;

function useDisplayLocale(): string {
  const { locale, intlLocale } = useLocale();
  return locale === "de" ? "de-CH" : intlLocale;
}

function isCacheFresh(): boolean {
  return Date.now() - _lastFetchTime < CACHE_TTL;
}

function Pagination({ page, totalItems, pageSize, onChange }: {
  page: number;
  totalItems: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const t = useMessages(keywordMappingMessages);
  const { intlLocale } = useLocale();
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
      <span className="text-sm text-slate-500 dark:text-slate-400">
        {t.pagination.range(start.toLocaleString(intlLocale), end.toLocaleString(intlLocale), totalItems.toLocaleString(intlLocale))}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(0)}
          disabled={page === 0}
          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
        </button>
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 0}
          className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {t.pagination.back}
        </button>
        <span className="px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">
          {page + 1} / {totalPages}
        </span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages - 1}
          className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {t.pagination.next}
        </button>
        <button
          onClick={() => onChange(totalPages - 1)}
          disabled={page >= totalPages - 1}
          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
        </button>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-7 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="mt-2 h-4 w-80 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="h-10 w-52 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="h-7 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="mt-2 h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50">
          <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="px-4 py-4 border-t border-slate-200 dark:border-slate-700 flex gap-6">
            <div className="h-4 w-1/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-4 w-1/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-4 w-1/6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-4 w-1/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  Mortgages: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "Accounts&Cards": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  Investing: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  Pension: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "Digital Banking": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
};

/** Gleiche Werte wie im Location-Filter — für Location-Overlap-Sortierung und Dropdown. */
const EDITORIAL_LOCATIONS = [
  "Guide",
  "Insights",
  "CH Market",
  "Global",
  "Microsites",
  "Minisites",
] as const;

const LOCATION_OVERLAP_COLUMN_STYLES = [
  { dot: "bg-blue-500", border: "border-blue-100 dark:border-blue-900/30", icon: "text-blue-400" },
  { dot: "bg-emerald-500", border: "border-emerald-100 dark:border-emerald-900/30", icon: "text-emerald-400" },
  { dot: "bg-amber-500", border: "border-amber-100 dark:border-amber-900/30", icon: "text-amber-400" },
  { dot: "bg-rose-500", border: "border-rose-100 dark:border-rose-900/30", icon: "text-rose-400" },
  { dot: "bg-cyan-500", border: "border-cyan-100 dark:border-cyan-900/30", icon: "text-cyan-400" },
  { dot: "bg-indigo-500", border: "border-indigo-100 dark:border-indigo-900/30", icon: "text-indigo-400" },
  { dot: "bg-violet-500", border: "border-violet-100 dark:border-violet-900/30", icon: "text-violet-400" },
  { dot: "bg-orange-500", border: "border-orange-100 dark:border-orange-900/30", icon: "text-orange-400" },
] as const;

function sortLocationsForOverlapDisplay(locations: Iterable<string>): string[] {
  const order = new Map<string, number>(
    EDITORIAL_LOCATIONS.map((loc, i) => [loc, i])
  );
  return [...locations].sort((a, b) => {
    const ia = order.has(a) ? order.get(a)! : 1000;
    const ib = order.has(b) ? order.get(b)! : 1000;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b, "de");
  });
}

const OVERLAP_SEVERITY_COLORS = [
  "",
  "",
  "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800",
  "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800",
  "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800",
];

function getSeverityColor(count: number): string {
  if (count >= 4) return OVERLAP_SEVERITY_COLORS[4];
  return OVERLAP_SEVERITY_COLORS[count] || OVERLAP_SEVERITY_COLORS[2];
}

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Erste zwei Pfadsegmente nach der Domain, z. B. https://www.ubs.com/us/en/foo → us/en */
function getFirstTwoPathSegments(urlStr: string | null | undefined): string | null {
  if (!urlStr?.trim()) return null;
  let pathname = urlStr.trim();
  try {
    if (/^https?:\/\//i.test(pathname)) {
      pathname = new URL(pathname).pathname;
    } else {
      pathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
    }
  } catch {
    return null;
  }
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return `${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`;
}

/** Nutzereingabe (Zeile oder volle URL) in normalisiertes Präfix seg1/seg2 */
function normalizeUserPathPrefixLine(line: string): string | null {
  const s = line.trim();
  if (!s) return null;
  let pathname = s;
  try {
    if (/^https?:\/\//i.test(s)) {
      pathname = new URL(s).pathname;
    } else {
      pathname = s.startsWith("/") ? s : `/${s}`;
    }
  } catch {
    return null;
  }
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return `${parts[0].toLowerCase()}/${parts[1].toLowerCase()}`;
}

const URL_PREFIX_OVERLAP_COLUMN_STYLES = [
  { dot: "bg-teal-500", border: "border-teal-100 dark:border-teal-900/30", icon: "text-teal-400" },
  { dot: "bg-sky-500", border: "border-sky-100 dark:border-sky-900/30", icon: "text-sky-400" },
  { dot: "bg-fuchsia-500", border: "border-fuchsia-100 dark:border-fuchsia-900/30", icon: "text-fuchsia-400" },
  { dot: "bg-lime-500", border: "border-lime-100 dark:border-lime-900/30", icon: "text-lime-400" },
  { dot: "bg-pink-500", border: "border-pink-100 dark:border-pink-900/30", icon: "text-pink-400" },
  { dot: "bg-cyan-500", border: "border-cyan-100 dark:border-cyan-900/30", icon: "text-cyan-400" },
] as const;

const URL_PREFIX_CARD_URL_COL_OTHER = "__other__";
const URL_PREFIX_CARD_URL_COL_NONE = "__none__";
/** Sichtbare Artikel in der Karte: zuerst 10, dann in 20er-Schritten */
const URL_PREFIX_OVERLAP_INITIAL_VISIBLE = 10;
const URL_PREFIX_OVERLAP_MORE_STEP = 20;

const GSC_PAGE_ROW_LIMIT = 25_000;

const GSC_PERIOD_OPTIONS = ["7d", "28d", "3m", "6m", "8m"] as const;

const LOCATION_NONE_KEY = "__none__";

/** Schwellen für GSC-Klicks pro URL (Property www.ubs.com, geladener Seitenreport). */
const GSC_CLICKS_THRESHOLD_OPTIONS = [1, 10, 50, 100, 500, 1000] as const;

type GscClicksFilterMode = "off" | "gte" | "lt";

type GscKeywordMappingState = "loading" | "ready" | "needsConnection" | "error";

function gscPeriodShortLabel(
  period: string,
  labels: Record<string, { short: string; selectLabel: string }>
): string {
  return labels[period]?.short ?? period;
}

function gscClicksForArticleUrl(
  gscByPath: Map<string, GscPageMetrics>,
  url: string | null | undefined
): number {
  return lookupGscMetrics(gscByPath, url)?.clicks ?? 0;
}

function articleMatchesGscClicksFilter(
  clicks: number,
  mode: GscClicksFilterMode,
  threshold: number
): boolean {
  if (mode === "off") return true;
  if (mode === "gte") return clicks >= threshold;
  return clicks < threshold;
}

function KeywordMappingGscLine({
  url,
  gscByPath,
  state,
  periodShort,
}: {
  url: string | null | undefined;
  gscByPath: Map<string, GscPageMetrics>;
  state: GscKeywordMappingState;
  periodShort: string;
}) {
  const t = useMessages(keywordMappingMessages);
  const displayLocale = useDisplayLocale();
  if (!url?.trim()) return null;
  if (state === "loading") {
    return (
      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">
        {t.gscLine.loading}
      </span>
    );
  }
  if (state === "needsConnection" || state === "error") {
    return null;
  }
  const m = lookupGscMetrics(gscByPath, url);
  if (!m) {
    return (
      <span
        className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block"
        title={t.gscLine.noMatchTitle}
      >
        {t.gscLine.noMatch}
      </span>
    );
  }
  return (
    <span className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5 block tabular-nums leading-snug">
      <span className="text-slate-500 dark:text-slate-500">GSC {periodShort}:</span>{" "}
      {t.gscLine.metrics(
        m.clicks.toLocaleString(displayLocale),
        m.impressions.toLocaleString(displayLocale),
        (m.ctr * 100).toFixed(1),
        m.position.toFixed(1)
      )}
    </span>
  );
}

function KeywordMappingLabsCell({ state }: { state: LabsKwArticleState | undefined }) {
  const t = useMessages(keywordMappingMessages);
  const displayLocale = useDisplayLocale();
  if (state === undefined) {
    return <span className="text-[10px] text-slate-400 dark:text-slate-500">—</span>;
  }
  if (state.status === "loading") {
    return (
      <span className="text-[10px] text-slate-400 dark:text-slate-500 animate-pulse">
        {t.labsCell.loading}
      </span>
    );
  }
  if (state.status === "error") {
    return (
      <span
        className="text-[10px] text-red-600 dark:text-red-400 block leading-snug"
        title={state.message}
      >
        {state.needsCredentials
          ? t.labsCell.notConfigured
          : state.message}
      </span>
    );
  }
  if (state.apiError && state.keywords.length === 0) {
    return (
      <span className="text-[10px] text-amber-700 dark:text-amber-300 block leading-snug" title={state.apiError}>
        {state.apiError}
      </span>
    );
  }
  if (state.keywords.length === 0) {
    return (
      <span
        className="text-[10px] text-slate-400 dark:text-slate-500 block leading-snug"
        title={t.labsCell.noTopKeywordsTitle}
      >
        {t.labsCell.noTopKeywords}
      </span>
    );
  }
  return (
    <div className="space-y-1 max-w-[14rem]">
      {state.apiError && (
        <span className="text-[9px] text-amber-600 dark:text-amber-400 block">{state.apiError}</span>
      )}
      <ul className="space-y-1 text-[10px] text-slate-600 dark:text-slate-400 leading-snug">
        {state.keywords.map((k, idx) => (
          <li key={`${k.keyword}-${idx}`} className="tabular-nums">
            <span className="font-medium text-slate-800 dark:text-slate-200">{k.keyword}</span>
            <span className="text-slate-500 dark:text-slate-500">
              {" "}
              {t.labsCell.position(k.rankGroup)}
              {k.searchVolume != null
                ? t.labsCell.volume(k.searchVolume.toLocaleString(displayLocale))
                : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UrlPrefixOverlapCard({
  overlap,
  editorialArticleById,
  selectedUrlPrefixes,
  selectedUrlPrefixSet,
  gscByPath,
  gscState,
  gscPeriodShort,
}: {
  overlap: OverlapGroup;
  editorialArticleById: Map<string, Article>;
  selectedUrlPrefixes: string[];
  selectedUrlPrefixSet: Set<string>;
  gscByPath: Map<string, GscPageMetrics>;
  gscState: GscKeywordMappingState;
  gscPeriodShort: string;
}) {
  const t = useMessages(keywordMappingMessages);
  const colLabel = useCallback(
    (key: string) =>
      key === URL_PREFIX_CARD_URL_COL_OTHER
        ? t.urlPrefixCard.otherPath
        : key === URL_PREFIX_CARD_URL_COL_NONE
          ? t.urlPrefixCard.noUrlPath
          : key,
    [t]
  );
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(URL_PREFIX_OVERLAP_INITIAL_VISIBLE);

  const { colKeys, crossingPathKeys, extraBits, bucket } = useMemo(() => {
    const bucketFn = (art: OverlapGroup["articles"][number]) => {
      const fromPlan = editorialArticleById.get(art.id);
      const displayUrl = fromPlan?.url?.trim() || art.url?.trim() || null;
      const p = getFirstTwoPathSegments(displayUrl);
      if (!p) return URL_PREFIX_CARD_URL_COL_NONE;
      if (selectedUrlPrefixSet.has(p)) return p;
      return URL_PREFIX_CARD_URL_COL_OTHER;
    };
    const ck: string[] = [];
    for (const p of selectedUrlPrefixes) {
      if (overlap.articles.some((a) => bucketFn(a) === p)) ck.push(p);
    }
    if (overlap.articles.some((a) => bucketFn(a) === URL_PREFIX_CARD_URL_COL_OTHER)) {
      ck.push(URL_PREFIX_CARD_URL_COL_OTHER);
    }
    if (overlap.articles.some((a) => bucketFn(a) === URL_PREFIX_CARD_URL_COL_NONE)) {
      ck.push(URL_PREFIX_CARD_URL_COL_NONE);
    }
    const crossing = ck.filter((k) => k !== URL_PREFIX_CARD_URL_COL_OTHER && k !== URL_PREFIX_CARD_URL_COL_NONE);
    const extra = [
      ck.includes(URL_PREFIX_CARD_URL_COL_OTHER) ? URL_PREFIX_CARD_URL_COL_OTHER : null,
      ck.includes(URL_PREFIX_CARD_URL_COL_NONE) ? URL_PREFIX_CARD_URL_COL_NONE : null,
    ].filter(Boolean) as string[];
    return { colKeys: ck, crossingPathKeys: crossing, extraBits: extra, bucket: bucketFn };
  }, [overlap.articles, editorialArticleById, selectedUrlPrefixes, selectedUrlPrefixSet]);

  const orderedIds = useMemo(() => {
    const ids: string[] = [];
    for (const colKey of colKeys) {
      for (const a of overlap.articles) {
        if (bucket(a) === colKey) ids.push(a.id);
      }
    }
    return ids;
  }, [overlap.articles, colKeys, bucket]);

  const shownIdSet = useMemo(
    () => new Set(orderedIds.slice(0, visibleCount)),
    [orderedIds, visibleCount]
  );

  const pathCountParts = useMemo(() => {
    const parts: Array<{ key: string; node: ReactNode }> = [];
    for (const colKey of colKeys) {
      const n = overlap.articles.filter((a) => bucket(a) === colKey).length;
      if (n > 0) {
        parts.push({
          key: colKey,
          node: (
            <span className="inline-flex items-center gap-1">
              <code className="text-[10px] px-1 py-0.5 rounded bg-teal-100/80 dark:bg-teal-900/40 font-mono text-teal-900 dark:text-teal-200">
                {colLabel(colKey)}
              </code>
              <span className="text-slate-500 dark:text-slate-400">({n})</span>
            </span>
          ),
        });
      }
    }
    return parts;
  }, [colKeys, overlap.articles, bucket, colLabel]);

  useEffect(() => {
    setVisibleCount(URL_PREFIX_OVERLAP_INITIAL_VISIBLE);
  }, [overlap.keyword]);

  const total = overlap.articles.length;
  const remaining = Math.max(0, orderedIds.length - visibleCount);
  const showMoreStep = () =>
    setVisibleCount((c) => Math.min(c + URL_PREFIX_OVERLAP_MORE_STEP, orderedIds.length));
  const nextBatch = Math.min(URL_PREFIX_OVERLAP_MORE_STEP, remaining);

  return (
    <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-900/5 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 sm:p-4">
        <div className="min-w-0 flex-1 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <a
              href={`/keyword-mapping/overlap?keyword=${encodeURIComponent(overlap.keyword)}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center max-w-full px-2.5 py-1 rounded-lg text-sm font-bold bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-colors shrink-0"
            >
              <span className="truncate">&quot;{overlap.keyword}&quot;</span>
              <svg className="w-3.5 h-3.5 ml-1 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-200 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 whitespace-nowrap">
              {t.urlCount(total)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
            {pathCountParts.map((part, i) => (
              <span key={part.key} className="inline-flex items-center gap-x-2">
                {i > 0 && <span className="text-slate-300 dark:text-slate-600">·</span>}
                {part.node}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-teal-200 dark:border-teal-700 bg-white/90 dark:bg-slate-800/80 text-teal-800 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors"
        >
          {expanded ? t.urlPrefixCard.collapse : t.urlPrefixCard.expand}
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="px-3 sm:px-4 pb-4 pt-0 border-t border-teal-100/80 dark:border-teal-900/40 space-y-4">
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed pt-3">
            <span className="font-semibold text-teal-900 dark:text-teal-200">{t.urlPrefixCard.whyOverlap}</span>
            {t.urlPrefixCard.focusKeywordPrefix}
            <span className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">
              {t.urlPrefixCard.quoted(overlap.keyword)}
            </span>
            {t.urlPrefixCard.assignedUnder}
            {crossingPathKeys.map((p, i) => {
              const chip = (
                <code
                  key={p}
                  className="text-[11px] px-1.5 py-0.5 rounded-md bg-teal-100/90 dark:bg-teal-900/50 font-mono text-teal-900 dark:text-teal-200 align-middle"
                >
                  {p}
                </code>
              );
              if (i === 0) return chip;
              if (i === crossingPathKeys.length - 1) {
                return (
                  <span key={`join-${p}`}>
                    {" "}
                    {t.urlPrefixCard.and} {chip}
                  </span>
                );
              }
              return (
                <span key={`join-${p}`}>
                  , {chip}
                </span>
              );
            })}
            {t.urlPrefixCard.assignedSuffix}
            {extraBits.length > 0 && (
              <span className="text-slate-600 dark:text-slate-400">
                {" "}
                {t.urlPrefixCard.alsoInvolved(extraBits.map(colLabel))}
              </span>
            )}
          </p>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.urlPrefixCard.visibleInfo(URL_PREFIX_OVERLAP_INITIAL_VISIBLE, URL_PREFIX_OVERLAP_MORE_STEP)}{" "}
            {t.urlPrefixCard.current} <span className="font-medium text-slate-700 dark:text-slate-300">{t.urlPrefixCard.ofTotal(Math.min(visibleCount, total), total)}</span>.
          </p>

          <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
            {colKeys.map((colKey, colIdx) => {
              const style = URL_PREFIX_OVERLAP_COLUMN_STYLES[colIdx % URL_PREFIX_OVERLAP_COLUMN_STYLES.length];
              const inCol = overlap.articles.filter((a) => bucket(a) === colKey && shownIdSet.has(a.id));
              return (
                <div key={colKey}>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                    <span className="normal-case font-mono text-[11px] tracking-normal">{colLabel(colKey)}</span>
                  </div>
                  <div className="space-y-2">
                    {inCol.map((article) => {
                      const fromPlan = editorialArticleById.get(article.id);
                      const displayTitle = fromPlan?.title ?? article.title;
                      const displayUrl = fromPlan?.url?.trim() || article.url?.trim() || null;
                      const seg = getFirstTwoPathSegments(displayUrl);
                      return (
                        <div
                          key={`${colKey}-${article.id}`}
                          className={`flex items-start gap-3 bg-white/80 dark:bg-slate-800/60 rounded-lg px-3 py-2 border ${style.border}`}
                        >
                          <svg
                            className={`w-4 h-4 mt-0.5 shrink-0 ${style.icon}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {displayTitle}
                            </div>
                            {displayUrl ? (
                              <>
                                <a
                                  href={displayUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 dark:text-blue-400 truncate mt-0.5 hover:underline block"
                                >
                                  {displayUrl}
                                </a>
                                {seg && (
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5 block">
                                    {t.urlPrefixCard.prefix} {seg}
                                  </span>
                                )}
                                <KeywordMappingGscLine
                                  url={displayUrl}
                                  gscByPath={gscByPath}
                                  state={gscState}
                                  periodShort={gscPeriodShort}
                                />
                              </>
                            ) : (
                              <span className="text-xs text-slate-500 dark:text-slate-500 italic mt-0.5 block">
                                {t.noUrlInPlan}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {remaining > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={showMoreStep}
                className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 transition-colors"
              >
                {t.urlPrefixCard.showMore(nextBatch)}
                <span className="ml-2 text-teal-100 text-xs">{t.urlPrefixCard.pending(remaining)}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type TabId = "mapping" | "overlaps" | "location-overlaps" | "url-prefix-overlaps" | "keywords" | "tagcloud";

export default function KeywordMappingPage() {
  const t = useMessages(keywordMappingMessages);
  const { intlLocale } = useLocale();
  const displayLocale = useDisplayLocale();
  const [articles, setArticles] = useState<Article[]>(_cachedArticles ?? []);
  const [loading, setLoading] = useState(!_cachedAnalysisData);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState("");
  const [progressIsError, setProgressIsError] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{ analyzed: number; total: number } | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(_cachedAnalysisData);
  const [activeTab, setActiveTab] = useState<TabId>("mapping");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [overlapFilter, setOverlapFilter] = useState<"all" | "with-overlaps">("all");
  const [keywordSearch, setKeywordSearch] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [debouncedKeywordSearch, setDebouncedKeywordSearch] = useState("");
  const [selectedCloudKeyword, setSelectedCloudKeyword] = useState<string | null>(null);
  const [mappingPage, setMappingPage] = useState(0);
  const [overlapsPage, setOverlapsPage] = useState(0);
  const [keywordsPage, setKeywordsPage] = useState(0);
  const [urlPrefixOverlapsPage, setUrlPrefixOverlapsPage] = useState(0);
  /** Ein Präfix pro Zeile, z. B. us/en oder volle URL — Vergleich der ersten zwei Pfadsegmente */
  const [urlPrefixCompareInput, setUrlPrefixCompareInput] = useState(
    "us/en\nglobal/en"
  );
  /** GSC-Daten immer von dieser Property (nicht vom Header-Property-Selektor). */
  const [gscRows, setGscRows] = useState<GscPageRow[]>([]);
  const [gscState, setGscState] = useState<GscKeywordMappingState>("loading");
  const [gscPeriod, setGscPeriod] = useState<string>("28d");
  const [gscClicksFilterMode, setGscClicksFilterMode] = useState<GscClicksFilterMode>("off");
  const [gscClicksThreshold, setGscClicksThreshold] = useState<number>(50);
  const [labsKwByArticleId, setLabsKwByArticleId] = useState<Record<string, LabsKwArticleState>>({});
  const [labsMarketHint, setLabsMarketHint] = useState<{ location: string | null; language: string | null } | null>(null);

  const fetchArticles = useCallback(async () => {
    if (_cachedArticles && isCacheFresh()) return;
    try {
      const res = await fetch("/api/editorial-plan?scope=keyword-mapping", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles);
        _cachedArticles = data.articles;
      }
    } catch (error) {
      console.error("Error fetching articles:", error);
    }
  }, []);

  const fetchSavedMapping = useCallback(async () => {
    if (_cachedAnalysisData && isCacheFresh()) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/editorial-plan/keyword-mapping", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.run) {
          setAnalysisData(data.run);
          _cachedAnalysisData = data.run;
        }
      }
    } catch (error) {
      console.error("Error fetching saved mapping:", error);
    } finally {
      setLoading(false);
      _lastFetchTime = Date.now();
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchArticles(), fetchSavedMapping()]);
  }, [fetchArticles, fetchSavedMapping]);

  useEffect(() => {
    let cancelled = false;
    async function loadGscPages() {
      setGscState("loading");
      try {
        const res = await fetch(
          `/api/gsc/pages?siteUrl=${encodeURIComponent(KEYWORD_MAPPING_GSC_SITE_URL)}&period=${encodeURIComponent(gscPeriod)}&limit=${GSC_PAGE_ROW_LIMIT}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (res.status === 403 && data.needsConnection) {
          setGscRows([]);
          setGscState("needsConnection");
          return;
        }
        if (!res.ok) {
          setGscRows([]);
          setGscState("error");
          return;
        }
        setGscRows(Array.isArray(data.data) ? data.data : []);
        setGscState("ready");
      } catch {
        if (!cancelled) {
          setGscRows([]);
          setGscState("error");
        }
      }
    }
    loadGscPages();
    return () => {
      cancelled = true;
    };
  }, [gscPeriod]);

  const gscByPath = useMemo(() => buildGscMetricsByPathname(gscRows), [gscRows]);
  const gscPeriodShort = useMemo(() => gscPeriodShortLabel(gscPeriod, t.gscPeriods), [gscPeriod, t]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeywordSearch(keywordSearch), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [keywordSearch]);

  const articleSearchFilter = useMemo(() => {
    const s = debouncedSearchTerm.trim();
    return s.length >= MIN_SEARCH_CHARS ? s : "";
  }, [debouncedSearchTerm]);

  const keywordSearchFilter = useMemo(() => {
    const s = debouncedKeywordSearch.trim();
    return s.length >= MIN_SEARCH_CHARS ? s : "";
  }, [debouncedKeywordSearch]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setProgress(t.progress.starting);
    setProgressIsError(false);
    setAnalysisProgress(null);
    try {
      const res = await fetch("/api/editorial-plan/keyword-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t.progress.analysisFailed);
      }

      if (!res.body) throw new Error(t.progress.noStream);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "progress") {
              const pct = event.total > 0 ? Math.round((event.analyzed / event.total) * 100) : 0;
              setProgress(t.progress.analyzing(event.analyzed.toLocaleString(displayLocale), event.total.toLocaleString(displayLocale), pct));
              setAnalysisProgress({ analyzed: event.analyzed, total: event.total });
            } else if (event.type === "complete") {
              setAnalysisData(event.data);
              _cachedAnalysisData = event.data;
              _lastFetchTime = Date.now();
              setProgress("");
              setAnalysisProgress(null);
            } else if (event.type === "error") {
              setProgress(t.progress.error(event.message));
              setProgressIsError(true);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (error) {
      console.error("Error running analysis:", error);
      setProgress(t.progress.error(error instanceof Error ? error.message : t.progress.unknownError));
      setProgressIsError(true);
    } finally {
      setAnalyzing(false);
      setAnalysisProgress(null);
    }
  };

  const filteredArticleIds = useMemo(() => {
    if (categoryFilter === "all" && locationFilter === "all" && languageFilter === "all") {
      return null;
    }
    return new Set(
      articles
        .filter((a) => {
          const matchesCategory = categoryFilter === "all" || a.category === categoryFilter;
          const matchesLocation = locationFilter === "all" || a.location === locationFilter;
          const matchesLanguage =
            languageFilter === "all" ||
            (languageFilter === "__none__" ? !a.language?.trim() : a.language?.toLowerCase() === languageFilter);
          return matchesCategory && matchesLocation && matchesLanguage;
        })
        .map((a) => a.id)
    );
  }, [articles, categoryFilter, locationFilter, languageFilter]);

  const clicksFilteredArticleIds = useMemo(() => {
    if (gscClicksFilterMode === "off" || gscState !== "ready") return null;
    const s = new Set<string>();
    for (const a of articles) {
      const clicks = gscClicksForArticleUrl(gscByPath, a.url);
      if (articleMatchesGscClicksFilter(clicks, gscClicksFilterMode, gscClicksThreshold)) {
        s.add(a.id);
      }
    }
    return s;
  }, [articles, gscByPath, gscClicksFilterMode, gscClicksThreshold, gscState]);

  const effectiveFilteredArticleIds = useMemo(() => {
    if (!filteredArticleIds && !clicksFilteredArticleIds) return null;
    if (!filteredArticleIds) return clicksFilteredArticleIds;
    if (!clicksFilteredArticleIds) return filteredArticleIds;
    const clicksSet = clicksFilteredArticleIds;
    return new Set([...filteredArticleIds].filter((id) => clicksSet.has(id)));
  }, [filteredArticleIds, clicksFilteredArticleIds]);

  const filteredOverlaps = useMemo(() => {
    if (!analysisData) return [];
    if (!effectiveFilteredArticleIds) return analysisData.overlaps;
    return analysisData.overlaps
      .map((o) => ({
        ...o,
        articles: o.articles.filter((a) => effectiveFilteredArticleIds.has(a.id)),
      }))
      .filter((o) => o.articles.length > 1);
  }, [analysisData, effectiveFilteredArticleIds]);

  const getResultForArticle = (articleId: string): KeywordResult | undefined => {
    return analysisData?.results.find((r) => r.id === articleId);
  };

  const getOverlapsForArticle = (articleId: string): OverlapGroup[] => {
    if (!analysisData) return [];
    return filteredOverlaps.filter((o) => o.articles.some((a) => a.id === articleId));
  };

  const eligibleArticles = useMemo(
    () => articles.filter((a) => a.title && (a.h1 || a.metaDescription)),
    [articles]
  );

  const filteredArticles = useMemo(() => {
    const resultById = new Map<string, KeywordResult>();
    if (analysisData) {
      for (const r of analysisData.results) {
        resultById.set(r.id, r);
      }
    }
    const overlapArticleIds = new Set<string>();
    for (const o of filteredOverlaps) {
      for (const art of o.articles) {
        overlapArticleIds.add(art.id);
      }
    }
    const term = articleSearchFilter.toLowerCase();
    const hasSearch = articleSearchFilter.length > 0;

    return eligibleArticles.filter((a) => {
      const matchesSearch =
        !hasSearch ||
        a.title.toLowerCase().includes(term) ||
        (a.url?.toLowerCase().includes(term) ?? false) ||
        (a.h1?.toLowerCase().includes(term) ?? false) ||
        (resultById.get(a.id)?.focusKeywords.some((k) => k.toLowerCase().includes(term)) ?? false);

      const matchesCategory = categoryFilter === "all" || a.category === categoryFilter;
      const matchesLocation = locationFilter === "all" || a.location === locationFilter;
      const matchesLanguage =
        languageFilter === "all" ||
        (languageFilter === "__none__" ? !a.language?.trim() : a.language?.toLowerCase() === languageFilter);
      const matchesOverlap =
        overlapFilter === "all" || overlapArticleIds.has(a.id);

      const c = gscClicksForArticleUrl(gscByPath, a.url);
      const matchesGscClicks =
        gscClicksFilterMode === "off" ||
        gscState !== "ready" ||
        articleMatchesGscClicksFilter(c, gscClicksFilterMode, gscClicksThreshold);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesLocation &&
        matchesLanguage &&
        matchesOverlap &&
        matchesGscClicks
      );
    });
  }, [
    eligibleArticles,
    articleSearchFilter,
    categoryFilter,
    locationFilter,
    languageFilter,
    overlapFilter,
    analysisData,
    filteredOverlaps,
    gscByPath,
    gscClicksFilterMode,
    gscClicksThreshold,
    gscState,
  ]);

  const categories = [...new Set(articles.map((a) => a.category).filter(Boolean))] as string[];

  const languagesFromArticles = useMemo(() => {
    const seen = new Set<string>();
    for (const a of articles) {
      const lang = a.language?.trim().toLowerCase();
      if (lang) seen.add(lang);
    }
    return [...seen].sort((a, b) => a.localeCompare(b, "de"));
  }, [articles]);

  /** Überlappungs-Payload kann ältere/leere URLs enthalten — Anzeige mit Redaktionsplan abgleichen. */
  const editorialArticleById = useMemo(
    () => new Map(articles.map((a) => [a.id, a])),
    [articles]
  );

  const totalOverlaps = filteredOverlaps.length;
  const criticalOverlaps = filteredOverlaps.filter((o) => o.articles.length >= 3).length;

  const locationOverlaps = useMemo(() => {
    return filteredOverlaps.filter((o) => {
      const locations = new Set(
        o.articles
          .map((a) => a.location?.trim())
          .filter((loc): loc is string => Boolean(loc))
      );
      return locations.size >= 2;
    });
  }, [filteredOverlaps]);

  const selectedUrlPrefixes = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const line of urlPrefixCompareInput.split(/\r?\n/)) {
      const n = normalizeUserPathPrefixLine(line);
      if (n && !seen.has(n)) {
        seen.add(n);
        out.push(n);
      }
    }
    return out;
  }, [urlPrefixCompareInput]);

  const selectedUrlPrefixSet = useMemo(
    () => new Set(selectedUrlPrefixes),
    [selectedUrlPrefixes]
  );

  /** Überlappungen, bei denen mindestens zwei der gewählten URL-Pfadpräfixe (je 2 Segmente) vorkommen */
  const urlPrefixCrossOverlaps = useMemo(() => {
    if (selectedUrlPrefixes.length < 2) return [];
    return filteredOverlaps.filter((o) => {
      const hit = new Set<string>();
      for (const art of o.articles) {
        const fromPlan = editorialArticleById.get(art.id);
        const url = fromPlan?.url?.trim() || art.url?.trim() || null;
        const p = getFirstTwoPathSegments(url);
        if (p && selectedUrlPrefixSet.has(p)) hit.add(p);
      }
      return hit.size >= 2;
    });
  }, [filteredOverlaps, editorialArticleById, selectedUrlPrefixSet]);

  const filteredResults = useMemo(() => {
    if (!analysisData) return [];
    if (!effectiveFilteredArticleIds) return analysisData.results;
    return analysisData.results.filter((r) => effectiveFilteredArticleIds.has(r.id));
  }, [analysisData, effectiveFilteredArticleIds]);

  const keywordStats = useMemo(() => {
    if (!analysisData) return { unique: [], counts: new Map<string, number>() };
    const counts = new Map<string, number>();
    for (const r of filteredResults) {
      for (const kw of r.focusKeywords) {
        const normalized = kw.toLowerCase().trim();
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      }
    }
    const unique = [...counts.entries()]
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword));
    return { unique, counts };
  }, [analysisData, filteredResults]);

  const filteredKeywords = useMemo(() => {
    if (!keywordSearchFilter) return keywordStats.unique;
    const term = keywordSearchFilter.toLowerCase();
    return keywordStats.unique.filter((k) => k.keyword.includes(term));
  }, [keywordStats.unique, keywordSearchFilter]);

  const tagCloudData = useMemo(() => {
    if (keywordStats.unique.length === 0) return [];
    const maxCount = Math.max(...keywordStats.unique.map((k) => k.count));
    const minCount = Math.min(...keywordStats.unique.map((k) => k.count));
    return keywordStats.unique.map((k) => {
      const ratio = maxCount === minCount ? 0.5 : (k.count - minCount) / (maxCount - minCount);
      return { ...k, ratio };
    });
  }, [keywordStats.unique]);

  const selectedCloudArticles = useMemo(() => {
    if (!selectedCloudKeyword || !analysisData) return [];
    return filteredResults
      .filter((r) => r.focusKeywords.some((kw) => kw.toLowerCase().trim() === selectedCloudKeyword))
      .map((r) => {
        const article = articles.find((a) => a.id === r.id);
        return article ? { id: article.id, title: article.title, url: article.url, language: article.language } : null;
      })
      .filter(Boolean) as Array<{ id: string; title: string; url: string | null; language: string | null }>;
  }, [selectedCloudKeyword, analysisData, filteredResults, articles]);

  useEffect(() => { setMappingPage(0); }, [articleSearchFilter, categoryFilter, locationFilter, languageFilter, overlapFilter, gscClicksFilterMode, gscClicksThreshold, gscState]);
  useEffect(() => { setOverlapsPage(0); }, [categoryFilter, locationFilter, languageFilter, gscClicksFilterMode, gscClicksThreshold, gscState]);
  useEffect(() => { setKeywordsPage(0); }, [keywordSearchFilter, categoryFilter, locationFilter, languageFilter, gscClicksFilterMode, gscClicksThreshold, gscState]);
  useEffect(() => {
    setUrlPrefixOverlapsPage(0);
  }, [urlPrefixCompareInput, categoryFilter, locationFilter, languageFilter, gscClicksFilterMode, gscClicksThreshold, gscState]);

  const paginatedArticles = useMemo(
    () => filteredArticles.slice(mappingPage * PAGE_SIZE, (mappingPage + 1) * PAGE_SIZE),
    [filteredArticles, mappingPage]
  );
  const paginatedOverlaps = useMemo(
    () => filteredOverlaps.slice(overlapsPage * PAGE_SIZE, (overlapsPage + 1) * PAGE_SIZE),
    [filteredOverlaps, overlapsPage]
  );
  const paginatedKeywords = useMemo(
    () => filteredKeywords.slice(keywordsPage * PAGE_SIZE, (keywordsPage + 1) * PAGE_SIZE),
    [filteredKeywords, keywordsPage]
  );
  const paginatedUrlPrefixOverlaps = useMemo(
    () =>
      urlPrefixCrossOverlaps.slice(
        urlPrefixOverlapsPage * PAGE_SIZE,
        (urlPrefixOverlapsPage + 1) * PAGE_SIZE
      ),
    [urlPrefixCrossOverlaps, urlPrefixOverlapsPage]
  );

  useEffect(() => {
    if (activeTab !== "mapping" || !analysisData) return;

    const items = paginatedArticles
      .filter((a) => a.url?.trim())
      .filter((a) => labsKwByArticleId[a.id] === undefined)
      .map((a) => ({ id: a.id, url: a.url! }));

    if (items.length === 0) return;

    const itemsSnapshot = items.map((r) => ({ ...r }));

    setLabsKwByArticleId((prev) => {
      const n = { ...prev };
      for (const row of itemsSnapshot) n[row.id] = { status: "loading" };
      return n;
    });

    (async () => {
      try {
        const res = await fetch("/api/keyword-mapping/ranked-keywords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: itemsSnapshot }),
        });
        const data = (await res.json()) as {
          byId?: Record<string, { keywords: LabsRankedKeywordRow[]; error?: string }>;
          labsLocation?: string | null;
          labsLanguage?: string | null;
          error?: string;
          needsCredentials?: boolean;
        };

        if (!res.ok) {
          const msg = data.error || `HTTP ${res.status}`;
          const needsCredentials = Boolean(data.needsCredentials) || res.status === 503;
          setLabsKwByArticleId((prev) => {
            const n = { ...prev };
            for (const row of itemsSnapshot) {
              n[row.id] = { status: "error", message: msg, needsCredentials };
            }
            return n;
          });
          return;
        }

        if (
          (data.labsLocation && data.labsLocation.trim()) ||
          (data.labsLanguage && data.labsLanguage.trim())
        ) {
          setLabsMarketHint({
            location: data.labsLocation?.trim() || null,
            language: data.labsLanguage?.trim() || null,
          });
        }

        const byId = data.byId ?? {};
        setLabsKwByArticleId((prev) => {
          const n = { ...prev };
          for (const row of itemsSnapshot) {
            const r = byId[row.id];
            if (r) {
              n[row.id] = {
                status: "ok",
                keywords: Array.isArray(r.keywords) ? r.keywords : [],
                ...(r.error ? { apiError: r.error } : {}),
              };
            } else {
              n[row.id] = { status: "ok", keywords: [] };
            }
          }
          return n;
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : t.networkError;
        setLabsKwByArticleId((prev) => {
          const n = { ...prev };
          for (const row of itemsSnapshot) {
            n[row.id] = { status: "error", message: msg };
          }
          return n;
        });
      }
    })();
  }, [paginatedArticles, activeTab, analysisData, labsKwByArticleId, t]);

  const [exportLoading, setExportLoading] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null);
  const exportCancelRef = useRef(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<{
    cachedUrlCount: number;
    latestFetchedAt: string | null;
  } | null>(null);

  const EXPORT_BATCH_SIZE = 50;
  const EXPORT_PARALLEL_BATCHES = 2;

  useEffect(() => {
    fetch("/api/keyword-mapping/ranked-keywords/cache-info")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setCacheInfo({ cachedUrlCount: data.cachedUrlCount, latestFetchedAt: data.latestFetchedAt });
      })
      .catch(() => {});
  }, []);

  const labsMissingCount = useMemo(() => {
    return filteredArticles.filter((a) => a.url?.trim() && labsKwByArticleId[a.id] === undefined).length;
  }, [filteredArticles, labsKwByArticleId]);

  const labsLoadedCount = useMemo(() => {
    return filteredArticles.filter((a) => labsKwByArticleId[a.id]?.status === "ok").length;
  }, [filteredArticles, labsKwByArticleId]);

  const fetchLabsBatched = useCallback(async (
    articleList: Array<{ id: string; url: string }>,
    opts: { useCache?: boolean } = {},
  ): Promise<Record<string, LabsKwArticleState>> => {
    const merged: Record<string, LabsKwArticleState> = { ...labsKwByArticleId };
    if (articleList.length === 0) return merged;

    const total = articleList.length;
    let done = 0;

    const allBatches: Array<Array<{ id: string; url: string }>> = [];
    for (let i = 0; i < articleList.length; i += EXPORT_BATCH_SIZE) {
      allBatches.push(articleList.slice(i, i + EXPORT_BATCH_SIZE));
    }

    async function processBatch(batch: Array<{ id: string; url: string }>): Promise<void> {
      if (exportCancelRef.current) return;

      setLabsKwByArticleId((prev) => {
        const n = { ...prev };
        for (const row of batch) n[row.id] = { status: "loading" };
        return n;
      });

      try {
        const res = await fetch("/api/keyword-mapping/ranked-keywords", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: batch, useCache: opts.useCache }),
        });
        const data = (await res.json()) as {
          byId?: Record<string, { keywords: LabsRankedKeywordRow[]; error?: string }>;
          error?: string;
          needsCredentials?: boolean;
        };
        if (!res.ok) {
          const msg = data.error || `HTTP ${res.status}`;
          const needsCredentials = Boolean(data.needsCredentials) || res.status === 503;
          for (const row of batch) merged[row.id] = { status: "error", message: msg, needsCredentials };
        } else {
          const byId = data.byId ?? {};
          for (const row of batch) {
            const r = byId[row.id];
            if (r) {
              merged[row.id] = { status: "ok", keywords: Array.isArray(r.keywords) ? r.keywords : [], ...(r.error ? { apiError: r.error } : {}) };
            } else {
              merged[row.id] = { status: "ok", keywords: [] };
            }
          }
        }
        setLabsKwByArticleId((prev) => ({ ...prev, ...Object.fromEntries(batch.map((b) => [b.id, merged[b.id]])) }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : t.networkError;
        for (const row of batch) merged[row.id] = { status: "error", message: msg };
        setLabsKwByArticleId((prev) => ({ ...prev, ...Object.fromEntries(batch.map((b) => [b.id, merged[b.id]])) }));
      }

      done += batch.length;
      setExportProgress({ done: Math.min(done, total), total });
    }

    for (let i = 0; i < allBatches.length; i += EXPORT_PARALLEL_BATCHES) {
      if (exportCancelRef.current) break;
      const chunk = allBatches.slice(i, i + EXPORT_PARALLEL_BATCHES);
      await Promise.all(chunk.map(processBatch));
    }

    return merged;
  }, [labsKwByArticleId, t]);

  const buildXlsx = useCallback((labsData: Record<string, LabsKwArticleState>) => {
    const resultById = new Map<string, KeywordResult>();
    if (analysisData) {
      for (const r of analysisData.results) resultById.set(r.id, r);
    }

    const rows = filteredArticles.map((article) => {
      const result = resultById.get(article.id);
      const gsc = lookupGscMetrics(gscByPath, article.url);
      const labsState = labsData[article.id];
      const labsKeywords =
        labsState?.status === "ok"
          ? labsState.keywords.map((k) => t.xlsx.labsKeyword(k.keyword, k.rankGroup, k.searchVolume)).join("; ")
          : labsState?.status === "error"
            ? t.xlsx.error(labsState.message)
            : "";

      const overlaps = filteredOverlaps
        .filter((o) => o.articles.some((a) => a.id === article.id))
        .map((o) => `${o.keyword} (${t.urlCount(o.articles.length)})`)
        .join("; ");

      return {
        [t.xlsx.title]: article.title,
        URL: article.url ?? "",
        [t.xlsx.language]: article.language ?? "",
        [t.xlsx.category]: article.category ?? "",
        Location: article.location ?? "",
        H1: article.h1 ?? "",
        "Meta Description": article.metaDescription ?? "",
        [t.xlsx.focusKeywords]: result?.focusKeywords.join(", ") ?? "",
        [t.xlsx.reasoning]: result?.reasoning ?? "",
        "Top Ranked Keywords (DataForSEO)": labsKeywords,
        [t.xlsx.gscClicks]: gsc?.clicks ?? "",
        [t.xlsx.gscImpressions]: gsc?.impressions ?? "",
        "GSC CTR (%)": gsc ? Math.round(gsc.ctr * 10000) / 100 : "",
        [t.xlsx.gscPosition]: gsc ? Math.round(gsc.position * 10) / 10 : "",
        [t.xlsx.overlaps]: overlaps,
      };
    });

    const stamp = new Date().toISOString().slice(0, 10);
    downloadExcel(`keyword-mapping_${stamp}.xlsx`, [
      {
        name: t.xlsx.sheetName,
        rows,
        columnWidths: [40, 60, 6, 16, 14, 40, 60, 30, 50, 50, 12, 14, 10, 12, 40],
      },
    ]);
  }, [filteredArticles, analysisData, gscByPath, filteredOverlaps, t]);

  const runExport = useCallback(async (mode: "quick" | "cached" | "live") => {
    setShowExportDialog(false);
    if (mode === "quick") {
      buildXlsx(labsKwByArticleId);
      return;
    }

    setExportLoading(true);
    exportCancelRef.current = false;
    setExportProgress(null);

    try {
      const articlesWithUrl = filteredArticles
        .filter((a) => a.url?.trim())
        .map((a) => ({ id: a.id, url: a.url! }));

      const toFetch = mode === "cached"
        ? articlesWithUrl.filter((a) => labsKwByArticleId[a.id] === undefined)
        : articlesWithUrl.filter((a) => labsKwByArticleId[a.id] === undefined || labsKwByArticleId[a.id]?.status === "error");

      const allLabs = await fetchLabsBatched(toFetch, { useCache: mode === "cached" });
      if (!exportCancelRef.current) {
        buildXlsx(allLabs);
        if (mode === "live") {
          fetch("/api/keyword-mapping/ranked-keywords/cache-info")
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => { if (data) setCacheInfo({ cachedUrlCount: data.cachedUrlCount, latestFetchedAt: data.latestFetchedAt }); })
            .catch(() => {});
        }
      }
    } finally {
      setExportLoading(false);
      setExportProgress(null);
    }
  }, [filteredArticles, labsKwByArticleId, fetchLabsBatched, buildXlsx]);

  const cancelExport = useCallback(() => {
    exportCancelRef.current = true;
  }, []);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t.subtitle}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t.gscInfo}
            <code className="text-[11px] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono">
              {KEYWORD_MAPPING_GSC_SITE_URL}
            </code>
            {gscState === "ready" && (
              <span className="text-slate-400 dark:text-slate-500">
                {" "}
                {t.gscRowsLoaded(gscRows.length.toLocaleString(displayLocale))}
              </span>
            )}
          </p>
          {labsMarketHint && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t.labsMarketHint(labsMarketHint.location || t.allPlaces, labsMarketHint.language || t.allLanguagesLower)}
            </p>
          )}
          {activeTab === "mapping" && analysisData && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t.labsCostNote(PAGE_SIZE)}
              <code className="text-[10px] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono">
                DATAFORSEO_LABS_LOCATION_NAME
              </code>{" "}
              /{" "}
              <code className="text-[10px] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono">
                DATAFORSEO_LABS_LANGUAGE_NAME
              </code>
              .
            </p>
          )}
          {analysisData?.createdAt && (
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {t.lastRun} {formatDate(analysisData.createdAt, displayLocale)}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {analysisData && !exportLoading && (
            <button
              onClick={() => setShowExportDialog(true)}
              disabled={filteredArticles.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={t.exportTitle(filteredArticles.length)}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t.exportButton(filteredArticles.length.toLocaleString(intlLocale))}
            </button>
          )}
          {exportLoading && (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium text-sm">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>
                {exportProgress
                  ? t.labsLoadingProgress(exportProgress.done.toLocaleString(displayLocale), exportProgress.total.toLocaleString(displayLocale))
                  : t.exportPreparing}
              </span>
              <button
                onClick={cancelExport}
                className="ml-1 px-2 py-0.5 text-xs rounded bg-emerald-800 hover:bg-emerald-900 transition-colors"
              >
                {t.cancel}
              </button>
            </div>
          )}
          <button
            onClick={runAnalysis}
            disabled={analyzing || eligibleArticles.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {analyzing ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t.analysisRunning}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {analysisData ? t.startNewAnalysis : t.startKeywordAnalysisCount(eligibleArticles.length.toLocaleString(intlLocale))}
              </>
            )}
          </button>
        </div>
      </div>

      {gscState === "needsConnection" && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          {t.needsConnection.prefix}
          <a href="/api/auth/link-google" className="font-medium underline hover:no-underline">
            {t.needsConnection.link}
          </a>
          {t.needsConnection.middle}
          <code className="text-xs font-mono px-1 rounded bg-amber-100 dark:bg-amber-900/50">
            {KEYWORD_MAPPING_GSC_SITE_URL}
          </code>
          {t.needsConnection.suffix}
        </div>
      )}
      {gscState === "error" && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-800 dark:text-red-200">
          {t.gscError}
        </div>
      )}

      {/* Progress */}
      {(progress || analysisProgress) && (
        <div className={`p-4 rounded-lg text-sm ${
          progressIsError
            ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
            : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
        }`}>
          <div className="flex items-center gap-3">
            {analyzing && !progressIsError && (
              <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            <span>{progress}</span>
          </div>
          {analysisProgress && analysisProgress.total > 0 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span>{t.progress.ofArticles(analysisProgress.analyzed.toLocaleString(displayLocale), analysisProgress.total.toLocaleString(displayLocale))}</span>
                <span className="font-medium">{Math.round((analysisProgress.analyzed / analysisProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-blue-200 dark:bg-blue-900/40 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 dark:bg-blue-400 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${Math.round((analysisProgress.analyzed / analysisProgress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {analysisData && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{filteredResults.length.toLocaleString(intlLocale)}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{t.stats.analyzed}</div>
          </div>
          <button
            onClick={() => setActiveTab("keywords")}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-left hover:border-blue-400 dark:hover:border-blue-500 hover:ring-1 hover:ring-blue-400 dark:hover:ring-blue-500 transition-all group"
          >
            <div className="text-2xl font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {keywordStats.unique.length.toLocaleString(intlLocale)}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
              {t.stats.uniqueKeywords}
              <svg className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className={`text-2xl font-bold ${totalOverlaps > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
              {totalOverlaps.toLocaleString(intlLocale)}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{t.stats.overlaps}</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className={`text-2xl font-bold ${criticalOverlaps > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
              {criticalOverlaps.toLocaleString(intlLocale)}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{t.stats.critical}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      {analysisData && (
        <div className="border-b border-slate-200 dark:border-slate-700">
          <nav className="flex gap-4 overflow-x-auto">
            <button
              onClick={() => setActiveTab("mapping")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === "mapping"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {t.tabs.mapping(filteredArticles.length.toLocaleString(intlLocale))}
            </button>
            <button
              onClick={() => setActiveTab("overlaps")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === "overlaps"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {t.tabs.overlaps}
              {totalOverlaps > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  {totalOverlaps.toLocaleString(intlLocale)}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("location-overlaps")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === "location-overlaps"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {t.tabs.locationOverlap}
              {locationOverlaps.length > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                  {locationOverlaps.length.toLocaleString(intlLocale)}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("url-prefix-overlaps")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === "url-prefix-overlaps"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {t.tabs.urlPrefixOverlap}
              {selectedUrlPrefixes.length >= 2 && urlPrefixCrossOverlaps.length > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300">
                  {urlPrefixCrossOverlaps.length.toLocaleString(intlLocale)}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("keywords")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === "keywords"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {t.tabs.allKeywords(keywordStats.unique.length.toLocaleString(intlLocale))}
            </button>
            <button
              onClick={() => setActiveTab("tagcloud")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === "tagcloud"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {t.tabs.tagCloud}
            </button>
          </nav>
        </div>
      )}

      {/* Filters */}
      {analysisData && (
        <div className="flex flex-wrap gap-3">
          {(activeTab === "mapping" || activeTab === "keywords") && (
            <div className="relative flex-1 min-w-[200px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={
                  activeTab === "keywords"
                    ? t.filters.searchKeyword
                    : t.filters.searchArticles
                }
                value={activeTab === "keywords" ? keywordSearch : searchTerm}
                onChange={(e) => activeTab === "keywords" ? setKeywordSearch(e.target.value) : setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{t.filters.allCategories}</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{t.filters.allLocations}</option>
            {EDITORIAL_LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            title={t.filters.languageTitle}
          >
            <option value="all">{t.filters.allLanguages}</option>
            <option value="__none__">{t.filters.noLanguage}</option>
            {languagesFromArticles.map((lang) => (
              <option key={lang} value={lang}>
                {lang.toUpperCase()}
              </option>
            ))}
          </select>
          {activeTab === "mapping" && (
            <select
              value={overlapFilter}
              onChange={(e) => setOverlapFilter(e.target.value as "all" | "with-overlaps")}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t.filters.allArticles}</option>
              <option value="with-overlaps">{t.filters.onlyWithOverlaps}</option>
            </select>
          )}
          <select
            value={gscPeriod}
            onChange={(e) => setGscPeriod(e.target.value)}
            title={t.filters.periodTitle}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 max-w-[200px]"
          >
            {GSC_PERIOD_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t.filters.gscPeriodOption(t.gscPeriods[value]?.selectLabel ?? value)}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={gscClicksFilterMode}
              onChange={(e) => setGscClicksFilterMode(e.target.value as GscClicksFilterMode)}
              title={
                gscState !== "ready"
                  ? t.filters.clicksFilterTitlePending
                  : t.filters.clicksFilterTitleReady
              }
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 min-w-[11rem] max-w-[14rem]"
            >
              <option value="off">{t.filters.clicksOff}</option>
              <option value="gte">{t.filters.clicksGte}</option>
              <option value="lt">{t.filters.clicksLt}</option>
            </select>
            {gscClicksFilterMode !== "off" && (
              <select
                value={gscClicksThreshold}
                onChange={(e) => setGscClicksThreshold(Number(e.target.value))}
                title={
                  gscClicksFilterMode === "gte"
                    ? t.filters.thresholdGteTitle(gscClicksThreshold.toLocaleString(displayLocale))
                    : t.filters.thresholdLtTitle(gscClicksThreshold.toLocaleString(displayLocale), (gscClicksThreshold - 1).toLocaleString(displayLocale))
                }
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 tabular-nums max-w-[9rem]"
              >
                {GSC_CLICKS_THRESHOLD_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {gscClicksFilterMode === "gte"
                      ? `≥ ${n.toLocaleString(displayLocale)}`
                      : `< ${n.toLocaleString(displayLocale)}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Mapping Tab */}
      {activeTab === "mapping" && analysisData && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t.columns.article}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t.columns.seoData}
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider max-w-[14rem]"
                    title={t.columns.topRankTitle}
                  >
                    {t.columns.topRank}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t.columns.focusKeywords}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t.columns.reasoning}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t.columns.overlaps}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {paginatedArticles.map((article) => {
                  const result = getResultForArticle(article.id);
                  const articleOverlaps = getOverlapsForArticle(article.id);
                  const hasOverlaps = articleOverlaps.length > 0;

                  return (
                    <tr
                      key={article.id}
                      className={`${
                        hasOverlaps
                          ? "bg-amber-50/50 dark:bg-amber-900/5"
                          : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      } transition-colors`}
                    >
                      <td className="px-4 py-3">
                        <div className="max-w-xs">
                          <div className="font-medium text-sm text-slate-900 dark:text-white truncate" title={article.title}>
                            {article.title}
                          </div>
                          {article.url && (
                            <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 truncate mt-0.5 hover:underline block" title={article.url}>
                              {article.url}
                            </a>
                          )}
                          <KeywordMappingGscLine
                            url={article.url}
                            gscByPath={gscByPath}
                            state={gscState}
                            periodShort={gscPeriodShort}
                          />
                          {article.language && (
                            <span className="inline-flex mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 uppercase">
                              {article.language}
                            </span>
                          )}
                          {article.category && (
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[article.category] || "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"}`}>
                              {article.category}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-xs space-y-1">
                          {article.h1 && (
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                              <span className="font-medium text-slate-500 dark:text-slate-500">H1:</span>{" "}
                              <span className="truncate block" title={article.h1}>{article.h1}</span>
                            </div>
                          )}
                          {article.metaDescription && (
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                              <span className="font-medium text-slate-500 dark:text-slate-500">Meta:</span>{" "}
                              <span className="line-clamp-2" title={article.metaDescription}>
                                {article.metaDescription.substring(0, 120)}
                                {article.metaDescription.length > 120 ? "..." : ""}
                              </span>
                            </div>
                          )}
                          {!article.h1 && !article.metaDescription && (
                            <span className="text-xs text-slate-400 italic">{t.mapping.noSeoData}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top border-l border-slate-100 dark:border-slate-700/80">
                        <KeywordMappingLabsCell state={labsKwByArticleId[article.id]} />
                      </td>
                      <td className="px-4 py-3">
                        {result ? (
                          <div className="flex flex-wrap gap-1.5">
                            {result.focusKeywords.map((kw) => {
                              const isOverlapping = filteredOverlaps.some(
                                (o) => o.keyword === kw
                              );
                              return isOverlapping ? (
                                <a
                                  key={kw}
                                  href={`/keyword-mapping/overlap?keyword=${encodeURIComponent(kw)}`}
                                  className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900/50 hover:ring-amber-400 dark:hover:ring-amber-600 transition-all"
                                  title={t.mapping.showAllUrlsWith(kw)}
                                >
                                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  {kw}
                                  <svg className="w-3 h-3 ml-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              ) : (
                                <span
                                  key={kw}
                                  className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                                >
                                  {kw}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">{t.mapping.notAnalyzed}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {result ? (
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            {result.reasoning}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {articleOverlaps.length > 0 ? (
                          <div className="space-y-1">
                            {articleOverlaps.map((overlap) => (
                              <a
                                key={overlap.keyword}
                                href={`/keyword-mapping/overlap?keyword=${encodeURIComponent(overlap.keyword)}`}
                                className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 hover:underline transition-colors"
                              >
                                <span className="font-medium">
                                  &quot;{overlap.keyword}&quot;
                                </span>
                                <span className="text-slate-500 dark:text-slate-400">
                                  ({t.urlCount(overlap.articles.length)})
                                </span>
                                <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </a>
                            ))}
                          </div>
                        ) : result ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {t.mapping.unique}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredArticles.length === 0 && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              {t.mapping.noArticlesFound}
            </div>
          )}
          <Pagination page={mappingPage} totalItems={filteredArticles.length} pageSize={PAGE_SIZE} onChange={setMappingPage} />
        </div>
      )}

      {/* Overlaps Tab */}
      {activeTab === "overlaps" && analysisData && (
        <div className="space-y-4">
          {filteredOverlaps.length === 0 ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 mx-auto text-green-500 dark:text-green-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-green-800 dark:text-green-300">{t.overlaps.noneTitle}</h3>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                {t.overlaps.noneText}
              </p>
            </div>
          ) : (
            <>
              {paginatedOverlaps.map((overlap) => (
              <div
                key={overlap.keyword}
                className={`rounded-xl border p-5 ${getSeverityColor(overlap.articles.length)}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold ${
                      overlap.articles.length >= 3
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                    }`}>
                      &quot;{overlap.keyword}&quot;
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      overlap.articles.length >= 3
                        ? "bg-red-200 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        : "bg-amber-200 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}>
                      {t.urlCount(overlap.articles.length)}
                    </span>
                  </div>
                  {overlap.articles.length >= 3 && (
                    <span className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {t.overlaps.highRisk}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {overlap.articles.map((article, artIdx) => {
                    const fromPlan = editorialArticleById.get(article.id);
                    const displayTitle = fromPlan?.title ?? article.title;
                    const displayUrl =
                      fromPlan?.url?.trim() || article.url?.trim() || null;
                    return (
                      <div
                        key={`${overlap.keyword}-${article.id}-${artIdx}`}
                        className="flex items-start gap-3 bg-white/60 dark:bg-slate-800/60 rounded-lg px-3 py-2"
                      >
                        <svg className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {displayTitle}
                          </div>
                          {displayUrl ? (
                            <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 truncate hover:underline block">
                              {displayUrl}
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500 dark:text-slate-500 italic">
                              {t.noUrlInPlan}
                            </span>
                          )}
                          <KeywordMappingGscLine
                            url={displayUrl}
                            gscByPath={gscByPath}
                            state={gscState}
                            periodShort={gscPeriodShort}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
              <Pagination page={overlapsPage} totalItems={filteredOverlaps.length} pageSize={PAGE_SIZE} onChange={setOverlapsPage} />
            </>
          )}
        </div>
      )}

      {/* Location Overlap Tab */}
      {activeTab === "location-overlaps" && analysisData && (
        <div className="space-y-4">
          <div className="bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 rounded-xl p-4">
            <p className="text-sm text-violet-700 dark:text-violet-200">
              {t.locationOverlaps.infoPrefix}<strong>{t.locationOverlaps.infoStrong1}</strong>
              {t.locationOverlaps.infoMiddle(EDITORIAL_LOCATIONS.join(", "))}
              <strong>{t.locationOverlaps.infoStrong2}</strong>
              {t.locationOverlaps.infoSuffix}
            </p>
          </div>
          {locationOverlaps.length === 0 ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 mx-auto text-green-500 dark:text-green-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-green-800 dark:text-green-300">{t.locationOverlaps.noneTitle}</h3>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                {t.locationOverlaps.noneText}
              </p>
            </div>
          ) : (
            locationOverlaps.map((overlap) => {
              const locKeys = sortLocationsForOverlapDisplay(
                new Set(
                  overlap.articles
                    .map((a) => a.location?.trim())
                    .filter((loc): loc is string => Boolean(loc))
                )
              );
              const hasUnassigned = overlap.articles.some((a) => !a.location?.trim());
              const columnKeys = hasUnassigned ? [...locKeys, LOCATION_NONE_KEY] : locKeys;
              return (
                <div
                  key={overlap.keyword}
                  className="rounded-xl border p-5 bg-violet-50/50 dark:bg-violet-900/5 border-violet-200 dark:border-violet-800"
                >
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                      &quot;{overlap.keyword}&quot;
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-200 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                      {t.urlCount(overlap.articles.length)}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {t.locationOverlaps.locations(locKeys.join(" · "))}
                      {hasUnassigned && t.locationOverlaps.withoutLocationSuffix}
                    </span>
                  </div>
                  <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
                    {columnKeys.map((loc, colIdx) => {
                      const style = LOCATION_OVERLAP_COLUMN_STYLES[colIdx % LOCATION_OVERLAP_COLUMN_STYLES.length];
                      return (
                        <div key={loc}>
                          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                            {loc === LOCATION_NONE_KEY ? t.locationOverlaps.withoutLocation : loc}
                          </div>
                          <div className="space-y-2">
                            {overlap.articles
                              .filter((a) =>
                                loc === LOCATION_NONE_KEY
                                  ? !a.location?.trim()
                                  : (a.location?.trim() ?? "") === loc
                              )
                              .map((article) => {
                                const fromPlan = editorialArticleById.get(article.id);
                                const displayTitle = fromPlan?.title ?? article.title;
                                const displayUrl =
                                  fromPlan?.url?.trim() || article.url?.trim() || null;
                                return (
                                  <div
                                    key={`${loc}-${article.id}`}
                                    className={`flex items-start gap-3 bg-white/80 dark:bg-slate-800/60 rounded-lg px-3 py-2 border ${style.border}`}
                                  >
                                    <svg className={`w-4 h-4 mt-0.5 shrink-0 ${style.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <div className="min-w-0">
                                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                        {displayTitle}
                                      </div>
                                      {displayUrl ? (
                                        <a href={displayUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 truncate mt-0.5 hover:underline block">
                                          {displayUrl}
                                        </a>
                                      ) : (
                                        <span className="text-xs text-slate-500 dark:text-slate-500 italic mt-0.5 block">
                                          {t.noUrlInPlan}
                                        </span>
                                      )}
                                      <KeywordMappingGscLine
                                        url={displayUrl}
                                        gscByPath={gscByPath}
                                        state={gscState}
                                        periodShort={gscPeriodShort}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* URL-Pfad-Overlap Tab */}
      {activeTab === "url-prefix-overlaps" && analysisData && (
        <div className="space-y-4">
          <div className="bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-700 rounded-xl p-4 space-y-3">
            <p className="text-sm text-teal-800 dark:text-teal-200">
              {t.urlPrefixOverlaps.intro.s1}<strong>{t.urlPrefixOverlaps.intro.b1}</strong>
              {t.urlPrefixOverlaps.intro.s2}
              <code className="text-xs bg-teal-100 dark:bg-teal-900/50 px-1 rounded">us/en</code>
              {t.urlPrefixOverlaps.intro.vs}
              <code className="text-xs bg-teal-100 dark:bg-teal-900/50 px-1 rounded">global/en</code>
              {t.urlPrefixOverlaps.intro.s3}
              <strong>{t.urlPrefixOverlaps.intro.b2}</strong>
              {t.urlPrefixOverlaps.intro.s4}
              <strong>{t.urlPrefixOverlaps.intro.b3}</strong>
              {t.urlPrefixOverlaps.intro.s5}
              <strong>{t.urlPrefixOverlaps.intro.b4}</strong>
              {t.urlPrefixOverlaps.intro.s6(URL_PREFIX_OVERLAP_INITIAL_VISIBLE, URL_PREFIX_OVERLAP_MORE_STEP)}
            </p>
            <div>
              <label
                htmlFor="url-prefix-compare-input"
                className="block text-xs font-semibold text-teal-900 dark:text-teal-100 mb-1.5"
              >
                {t.urlPrefixOverlaps.pathsLabel}
              </label>
              <textarea
                id="url-prefix-compare-input"
                value={urlPrefixCompareInput}
                onChange={(e) => setUrlPrefixCompareInput(e.target.value)}
                rows={5}
                spellCheck={false}
                className="w-full max-w-2xl font-mono text-sm px-3 py-2 border border-teal-200 dark:border-teal-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder={"us/en\nglobal/en\nuk/en"}
              />
              <p className="mt-1.5 text-xs text-teal-700 dark:text-teal-300">
                {t.urlPrefixOverlaps.detected}{" "}
                {selectedUrlPrefixes.length === 0 ? (
                  <span>{t.urlPrefixOverlaps.noValidPrefixes}</span>
                ) : (
                  <span className="font-mono">{selectedUrlPrefixes.join(" · ")}</span>
                )}
                {selectedUrlPrefixes.length === 1 && (
                  <span className="block mt-1 text-amber-700 dark:text-amber-300">
                    {t.urlPrefixOverlaps.needTwoPrefixes}
                  </span>
                )}
              </p>
            </div>
          </div>

          {selectedUrlPrefixes.length < 2 ? (
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center text-sm text-slate-600 dark:text-slate-400">
              {t.urlPrefixOverlaps.needTwoPaths.prefix}
              <span className="font-mono">us/en</span>
              {t.urlPrefixOverlaps.needTwoPaths.and}
              <span className="font-mono">global/en</span>
              {t.urlPrefixOverlaps.needTwoPaths.suffix}
            </div>
          ) : urlPrefixCrossOverlaps.length === 0 ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 mx-auto text-green-500 dark:text-green-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-green-800 dark:text-green-300">{t.urlPrefixOverlaps.noneTitle}</h3>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1 max-w-lg mx-auto">
                {t.urlPrefixOverlaps.noneText}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedUrlPrefixOverlaps.map((overlap) => (
                  <UrlPrefixOverlapCard
                    key={overlap.keyword}
                    overlap={overlap}
                    editorialArticleById={editorialArticleById}
                    selectedUrlPrefixes={selectedUrlPrefixes}
                    selectedUrlPrefixSet={selectedUrlPrefixSet}
                    gscByPath={gscByPath}
                    gscState={gscState}
                    gscPeriodShort={gscPeriodShort}
                  />
                ))}
              </div>
              <Pagination
                page={urlPrefixOverlapsPage}
                totalItems={urlPrefixCrossOverlaps.length}
                pageSize={PAGE_SIZE}
                onChange={setUrlPrefixOverlapsPage}
              />
            </>
          )}
        </div>
      )}

      {/* Keywords Tab */}
      {activeTab === "keywords" && analysisData && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t.columns.keyword}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t.columns.urlCount}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t.columns.status}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t.columns.assignedArticles}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {paginatedKeywords.map((kw, idx) => {
                  const isOverlap = kw.count > 1;
                  const globalIdx = keywordsPage * PAGE_SIZE + idx;
                  const matchingArticles = filteredResults
                    .filter((r) => r.focusKeywords.some((fk) => fk.toLowerCase().trim() === kw.keyword))
                    .map((r) => {
                      const a = articles.find((art) => art.id === r.id);
                      return a ? { id: a.id, title: a.title, url: a.url, language: a.language } : null;
                    })
                    .filter(Boolean) as Array<{ id: string; title: string; url: string | null; language: string | null }>;

                  return (
                    <tr
                      key={kw.keyword}
                      className={`${
                        isOverlap ? "bg-amber-50/50 dark:bg-amber-900/5" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      } transition-colors`}
                    >
                      <td className="px-4 py-3 text-xs text-slate-400 tabular-nums">
                        {globalIdx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium ${
                          isOverlap
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                        }`}>
                          {kw.keyword}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${
                          kw.count >= 3 ? "text-red-600 dark:text-red-400" :
                          kw.count === 2 ? "text-amber-600 dark:text-amber-400" :
                          "text-slate-600 dark:text-slate-400"
                        }`}>
                          {kw.count}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {kw.count === 1 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {t.mapping.unique}
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                            kw.count >= 3
                              ? "text-red-600 dark:text-red-400"
                              : "text-amber-600 dark:text-amber-400"
                          }`}>
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {t.keywords.overlap}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {matchingArticles.map((a) => (
                            <div key={a.id} className="text-xs text-slate-600 dark:text-slate-400">
                              <div className="font-medium text-slate-700 dark:text-slate-300">{a.title}</div>
                              {a.url && (
                                <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 dark:text-blue-400 hover:underline break-all">{a.url}</a>
                              )}
                              <KeywordMappingGscLine
                                url={a.url}
                                gscByPath={gscByPath}
                                state={gscState}
                                periodShort={gscPeriodShort}
                              />
                              {a.language && (
                                <span className="inline-flex mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 uppercase">
                                  {a.language}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredKeywords.length === 0 && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              {t.keywords.noneFound}
            </div>
          )}
          <Pagination page={keywordsPage} totalItems={filteredKeywords.length} pageSize={PAGE_SIZE} onChange={setKeywordsPage} />
        </div>
      )}

      {/* Tag Cloud Tab */}
      {activeTab === "tagcloud" && analysisData && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {tagCloudData.map((kw) => {
                const fontSize = 0.75 + kw.ratio * 1.5;
                const isOverlap = kw.count > 1;
                const isSelected = selectedCloudKeyword === kw.keyword;
                return (
                  <button
                    key={kw.keyword}
                    onClick={() => setSelectedCloudKeyword(isSelected ? null : kw.keyword)}
                    style={{ fontSize: `${fontSize}rem` }}
                    className={`px-2 py-1 rounded-lg transition-all hover:scale-110 cursor-pointer leading-tight ${
                      isSelected
                        ? "bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-slate-800"
                        : isOverlap
                          ? "text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                    title={`${kw.keyword} (${kw.count}x)`}
                  >
                    {kw.keyword}
                    {kw.count > 1 && (
                      <sup className={`ml-0.5 text-[0.6em] ${isSelected ? "text-blue-200" : "text-slate-400 dark:text-slate-500"}`}>
                        {kw.count}
                      </sup>
                    )}
                  </button>
                );
              })}
            </div>
            {tagCloudData.length === 0 && (
              <div className="text-center text-slate-400 dark:text-slate-500 py-8">
                {t.tagCloud.noKeywords}
              </div>
            )}
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-center gap-6 text-xs text-slate-400 dark:text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-slate-300 dark:bg-slate-600" />
                {t.tagCloud.legendUnique}
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-amber-400 dark:bg-amber-600" />
                {t.tagCloud.legendOverlap}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[0.65rem]">Aa</span>
                <span className="mx-1">&rarr;</span>
                <span className="text-[1rem] font-medium">Aa</span>
                {t.tagCloud.legendFontSize}
              </div>
            </div>
          </div>

          {/* Detail panel for selected keyword */}
          {selectedCloudKeyword && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-blue-200 dark:border-blue-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-blue-700 dark:text-blue-300">
                    &quot;{selectedCloudKeyword}&quot;
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t.tagCloud.articleCount(selectedCloudArticles.length)}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedCloudKeyword(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-2">
                {selectedCloudArticles.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg px-4 py-3">
                    <svg className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {a.title}
                      </div>
                      {a.url && (
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 truncate mt-0.5 hover:underline block">
                          {a.url}
                        </a>
                      )}
                      <KeywordMappingGscLine
                        url={a.url}
                        gscByPath={gscByPath}
                        state={gscState}
                        periodShort={gscPeriodShort}
                      />
                      {a.language && (
                        <span className="inline-flex mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 uppercase">
                          {a.language}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!analysisData && !analyzing && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
            {t.empty.title}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            {t.empty.text(eligibleArticles.length.toLocaleString(intlLocale))}
          </p>
          <div className="flex items-center justify-center gap-8 text-sm text-slate-400 dark:text-slate-500">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t.empty.totalArticles(articles.length.toLocaleString(intlLocale))}
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t.empty.withSeoData(eligibleArticles.length.toLocaleString(intlLocale))}
            </div>
          </div>
        </div>
      )}

      {showExportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowExportDialog(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{t.exportDialog.title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {t.exportDialog.intro(filteredArticles.length.toLocaleString(intlLocale))}
            </p>

            <div className="space-y-3">
              {/* Option 1: Schnell-Export */}
              <button
                onClick={() => runExport("quick")}
                className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                    {t.exportDialog.quickTitle}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-medium">
                    {t.exportDialog.quickBadge}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t.exportDialog.quickText(labsLoadedCount.toLocaleString(intlLocale), filteredArticles.length.toLocaleString(intlLocale))}
                </p>
              </button>

              {/* Option 2: Gespeicherte Daten aus DB */}
              <button
                onClick={() => runExport("cached")}
                className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900 dark:text-white group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                    {t.exportDialog.cachedTitle}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 font-medium">
                    {t.exportDialog.cachedBadge}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {cacheInfo && cacheInfo.cachedUrlCount > 0
                    ? t.exportDialog.cachedText(cacheInfo.cachedUrlCount.toLocaleString(intlLocale), formatDate(cacheInfo.latestFetchedAt!, displayLocale))
                    : t.exportDialog.cachedEmpty
                  }
                </p>
              </button>

              {/* Option 3: Frische Daten via API */}
              <button
                onClick={() => runExport("live")}
                className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                    {t.exportDialog.liveTitle}
                  </span>
                  {labsMissingCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-medium">
                      {t.exportDialog.liveBadge(Math.ceil(labsMissingCount / EXPORT_BATCH_SIZE))}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {labsMissingCount === 0
                    ? t.exportDialog.liveReady
                    : t.exportDialog.liveText(labsMissingCount.toLocaleString(intlLocale), Math.ceil(labsMissingCount / EXPORT_BATCH_SIZE), EXPORT_BATCH_SIZE, EXPORT_PARALLEL_BATCHES)
                  }
                </p>
              </button>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowExportDialog(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
