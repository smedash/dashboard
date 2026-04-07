"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

interface Article {
  id: string;
  title: string;
  url: string | null;
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
  articles: Array<{ id: string; title: string; url: string | null; location?: string | null }>;
}

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

function isCacheFresh(): boolean {
  return Date.now() - _lastFetchTime < CACHE_TTL;
}

function Pagination({ page, totalItems, pageSize, onChange }: {
  page: number;
  totalItems: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
      <span className="text-sm text-slate-500 dark:text-slate-400">
        {start.toLocaleString()}–{end.toLocaleString()} von {totalItems.toLocaleString()}
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
          Zurück
        </button>
        <span className="px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300">
          {page + 1} / {totalPages}
        </span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages - 1}
          className="px-2.5 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Weiter
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("de-CH", {
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

type TabId = "mapping" | "overlaps" | "location-overlaps" | "url-prefix-overlaps" | "keywords" | "tagcloud";

export default function KeywordMappingPage() {
  const [articles, setArticles] = useState<Article[]>(_cachedArticles ?? []);
  const [loading, setLoading] = useState(!_cachedAnalysisData);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState("");
  const [analysisProgress, setAnalysisProgress] = useState<{ analyzed: number; total: number } | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(_cachedAnalysisData);
  const [activeTab, setActiveTab] = useState<TabId>("mapping");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
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

  const fetchArticles = useCallback(async () => {
    if (_cachedArticles && isCacheFresh()) return;
    try {
      const res = await fetch("/api/editorial-plan?scope=keyword-mapping");
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
      const res = await fetch("/api/editorial-plan/keyword-mapping");
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
    setProgress("Starte Keyword-Analyse...");
    setAnalysisProgress(null);
    try {
      const res = await fetch("/api/editorial-plan/keyword-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Analyse fehlgeschlagen");
      }

      if (!res.body) throw new Error("Kein Stream verfügbar");

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
              setProgress(`Analysiere... ${event.analyzed.toLocaleString("de-CH")} / ${event.total.toLocaleString("de-CH")} Artikel (${pct}%)`);
              setAnalysisProgress({ analyzed: event.analyzed, total: event.total });
            } else if (event.type === "complete") {
              setAnalysisData(event.data);
              _cachedAnalysisData = event.data;
              _lastFetchTime = Date.now();
              setProgress("");
              setAnalysisProgress(null);
            } else if (event.type === "error") {
              setProgress(`Fehler: ${event.message}`);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (error) {
      console.error("Error running analysis:", error);
      setProgress(`Fehler: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
    } finally {
      setAnalyzing(false);
      setAnalysisProgress(null);
    }
  };

  const filteredArticleIds = useMemo(() => {
    if (categoryFilter === "all" && locationFilter === "all") return null;
    return new Set(
      articles
        .filter((a) => (categoryFilter === "all" || a.category === categoryFilter) &&
                       (locationFilter === "all" || a.location === locationFilter))
        .map((a) => a.id)
    );
  }, [articles, categoryFilter, locationFilter]);

  const filteredOverlaps = useMemo(() => {
    if (!analysisData) return [];
    if (!filteredArticleIds) return analysisData.overlaps;
    return analysisData.overlaps
      .map((o) => ({
        ...o,
        articles: o.articles.filter((a) => filteredArticleIds.has(a.id)),
      }))
      .filter((o) => o.articles.length > 1);
  }, [analysisData, filteredArticleIds]);

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
      const matchesOverlap =
        overlapFilter === "all" || overlapArticleIds.has(a.id);

      return matchesSearch && matchesCategory && matchesLocation && matchesOverlap;
    });
  }, [
    eligibleArticles,
    articleSearchFilter,
    categoryFilter,
    locationFilter,
    overlapFilter,
    analysisData,
    filteredOverlaps,
  ]);

  const categories = [...new Set(articles.map((a) => a.category).filter(Boolean))] as string[];

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
    if (!filteredArticleIds) return analysisData.results;
    return analysisData.results.filter((r) => filteredArticleIds.has(r.id));
  }, [analysisData, filteredArticleIds]);

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
        return article ? { id: article.id, title: article.title, url: article.url } : null;
      })
      .filter(Boolean) as Array<{ id: string; title: string; url: string | null }>;
  }, [selectedCloudKeyword, analysisData, filteredResults, articles]);

  useEffect(() => { setMappingPage(0); }, [articleSearchFilter, categoryFilter, locationFilter, overlapFilter]);
  useEffect(() => { setOverlapsPage(0); }, [categoryFilter, locationFilter]);
  useEffect(() => { setKeywordsPage(0); }, [keywordSearchFilter, categoryFilter, locationFilter]);
  useEffect(() => {
    setUrlPrefixOverlapsPage(0);
  }, [urlPrefixCompareInput, categoryFilter, locationFilter]);

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

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Keyword Mapping
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Analysiere Fokuskeywords und erkenne Kannibalisierungspotenzial im Redaktionsplan
          </p>
          {analysisData?.createdAt && (
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Letzter Durchlauf: {formatDate(analysisData.createdAt)}
            </p>
          )}
        </div>
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
              Analyse läuft...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {analysisData ? "Neue Analyse starten" : `Keyword-Analyse starten (${eligibleArticles.length.toLocaleString()} Artikel)`}
            </>
          )}
        </button>
      </div>

      {/* Progress */}
      {(progress || analysisProgress) && (
        <div className={`p-4 rounded-lg text-sm ${
          progress.startsWith("Fehler")
            ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
            : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
        }`}>
          <div className="flex items-center gap-3">
            {analyzing && !progress.startsWith("Fehler") && (
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
                <span>{analysisProgress.analyzed.toLocaleString("de-CH")} von {analysisProgress.total.toLocaleString("de-CH")} Artikeln</span>
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
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{filteredResults.length.toLocaleString()}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Artikel analysiert</div>
          </div>
          <button
            onClick={() => setActiveTab("keywords")}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-left hover:border-blue-400 dark:hover:border-blue-500 hover:ring-1 hover:ring-blue-400 dark:hover:ring-blue-500 transition-all group"
          >
            <div className="text-2xl font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {keywordStats.unique.length.toLocaleString()}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
              Einzigartige Keywords
              <svg className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className={`text-2xl font-bold ${totalOverlaps > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
              {totalOverlaps.toLocaleString()}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Keyword-Überlappungen</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className={`text-2xl font-bold ${criticalOverlaps > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
              {criticalOverlaps.toLocaleString()}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Kritische Überlappungen (3+)</div>
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
              Keyword-Mapping ({filteredArticles.length.toLocaleString()})
            </button>
            <button
              onClick={() => setActiveTab("overlaps")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === "overlaps"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Überlappungen
              {totalOverlaps > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  {totalOverlaps.toLocaleString()}
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
              Location Overlap
              {locationOverlaps.length > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                  {locationOverlaps.length.toLocaleString()}
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
              URL-Pfad-Overlap
              {selectedUrlPrefixes.length >= 2 && urlPrefixCrossOverlaps.length > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300">
                  {urlPrefixCrossOverlaps.length.toLocaleString()}
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
              Alle Keywords ({keywordStats.unique.length.toLocaleString()})
            </button>
            <button
              onClick={() => setActiveTab("tagcloud")}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === "tagcloud"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              Tag Cloud
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
                    ? "Keyword suchen (mind. 2 Zeichen)…"
                    : "Titel, URL oder Keyword (mind. 2 Zeichen)…"
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
            <option value="all">Alle Kategorien</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alle Locations</option>
            {EDITORIAL_LOCATIONS.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
          {activeTab === "mapping" && (
            <select
              value={overlapFilter}
              onChange={(e) => setOverlapFilter(e.target.value as "all" | "with-overlaps")}
              className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Alle Artikel</option>
              <option value="with-overlaps">Nur mit Überlappungen</option>
            </select>
          )}
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
                    Artikel
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    SEO-Daten
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Fokuskeywords
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Begründung
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Überlappungen
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
                            <span className="text-xs text-slate-400 italic">Keine SEO-Daten</span>
                          )}
                        </div>
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
                                  title={`Alle URLs mit "${kw}" anzeigen`}
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
                          <span className="text-xs text-slate-400 italic">Nicht analysiert</span>
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
                                  ({overlap.articles.length} URLs)
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
                            Einzigartig
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
              Keine Artikel gefunden, die den Filtern entsprechen.
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
              <h3 className="text-lg font-medium text-green-800 dark:text-green-300">Keine Überlappungen gefunden</h3>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                Alle Artikel haben einzigartige Fokuskeywords. Kein Kannibalisierungspotenzial erkannt.
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
                      {overlap.articles.length} URLs
                    </span>
                  </div>
                  {overlap.articles.length >= 3 && (
                    <span className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Hohes Kannibalisierungsrisiko
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
                              Keine URL im Redaktionsplan
                            </span>
                          )}
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
              Hier erscheinen Keywords, die in Artikeln mit <strong>mindestens zwei verschiedenen Locations</strong> vorkommen
              (alle Locations aus dem Filter: {EDITORIAL_LOCATIONS.join(", ")}).
              Für die vollständige Übersicht bitte im Filter <strong>Alle Locations</strong> wählen — bei nur einer Location sind kreuzende Überlappungen nicht sichtbar.
            </p>
          </div>
          {locationOverlaps.length === 0 ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 mx-auto text-green-500 dark:text-green-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-green-800 dark:text-green-300">Keine Location-Überlappungen</h3>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                Kein Keyword tritt unter den aktuellen Filtern gleichzeitig in Artikeln mit unterschiedlicher Location auf.
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
              const columnKeys = hasUnassigned ? [...locKeys, "Ohne Location"] : locKeys;
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
                      {overlap.articles.length} URLs
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Locations: {locKeys.join(" · ")}
                      {hasUnassigned && " · (ohne Location)"}
                    </span>
                  </div>
                  <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
                    {columnKeys.map((loc, colIdx) => {
                      const style = LOCATION_OVERLAP_COLUMN_STYLES[colIdx % LOCATION_OVERLAP_COLUMN_STYLES.length];
                      return (
                        <div key={loc}>
                          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                            {loc}
                          </div>
                          <div className="space-y-2">
                            {overlap.articles
                              .filter((a) =>
                                loc === "Ohne Location"
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
                                          Keine URL im Redaktionsplan
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
              Vergleiche <strong>zwei oder mehr URL-Bereiche</strong> anhand der ersten beiden Pfadsegmente nach der Domain
              (z. B.{" "}
              <code className="text-xs bg-teal-100 dark:bg-teal-900/50 px-1 rounded">us/en</code> vs.{" "}
              <code className="text-xs bg-teal-100 dark:bg-teal-900/50 px-1 rounded">global/en</code>).
              Angezeigt werden nur Fokuskeyword-Überlappungen, bei denen betroffene Artikel unter{" "}
              <strong>mindestens zwei</strong> der eingetragenen Pfade liegen. Kategorie- und Location-Filter wirken weiterhin auf die Datenbasis.
            </p>
            <div>
              <label
                htmlFor="url-prefix-compare-input"
                className="block text-xs font-semibold text-teal-900 dark:text-teal-100 mb-1.5"
              >
                Pfade zum Vergleich (eine Zeile pro Präfix oder volle URL)
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
                Erkannt:{" "}
                {selectedUrlPrefixes.length === 0 ? (
                  <span>keine gültigen Präfixe</span>
                ) : (
                  <span className="font-mono">{selectedUrlPrefixes.join(" · ")}</span>
                )}
                {selectedUrlPrefixes.length === 1 && (
                  <span className="block mt-1 text-amber-700 dark:text-amber-300">
                    Mindestens zwei verschiedene Präfixe eintragen, um kreuzende Überlappungen zu sehen.
                  </span>
                )}
              </p>
            </div>
          </div>

          {selectedUrlPrefixes.length < 2 ? (
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center text-sm text-slate-600 dark:text-slate-400">
              Bitte mindestens zwei gültige Pfade angeben (je zwei Segmente nach der Domain, z. B.{" "}
              <span className="font-mono">us/en</span> und <span className="font-mono">global/en</span>).
            </div>
          ) : urlPrefixCrossOverlaps.length === 0 ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 mx-auto text-green-500 dark:text-green-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-green-800 dark:text-green-300">Keine Überlappungen über die gewählten Pfade</h3>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1 max-w-lg mx-auto">
                Unter den aktuellen Filtern gibt es kein Keyword, das gleichzeitig in Artikeln mit mindestens zwei verschiedenen
                der angegebenen URL-Pfadpräfixe vorkommt.
              </p>
            </div>
          ) : (
            <>
              {paginatedUrlPrefixOverlaps.map((overlap) => {
                const URL_COL_OTHER = "Anderer Pfad";
                const URL_COL_NONE = "Ohne URL-Pfad";
                const bucket = (art: (typeof overlap.articles)[number]) => {
                  const fromPlan = editorialArticleById.get(art.id);
                  const displayUrl = fromPlan?.url?.trim() || art.url?.trim() || null;
                  const p = getFirstTwoPathSegments(displayUrl);
                  if (!p) return URL_COL_NONE;
                  if (selectedUrlPrefixSet.has(p)) return p;
                  return URL_COL_OTHER;
                };
                const colKeys: string[] = [];
                for (const p of selectedUrlPrefixes) {
                  if (overlap.articles.some((a) => bucket(a) === p)) colKeys.push(p);
                }
                if (overlap.articles.some((a) => bucket(a) === URL_COL_OTHER)) colKeys.push(URL_COL_OTHER);
                if (overlap.articles.some((a) => bucket(a) === URL_COL_NONE)) colKeys.push(URL_COL_NONE);

                const pathLabels = colKeys
                  .filter((k) => k !== URL_COL_OTHER && k !== URL_COL_NONE)
                  .join(" · ");
                const extraBits = [
                  colKeys.includes(URL_COL_OTHER) ? URL_COL_OTHER : null,
                  colKeys.includes(URL_COL_NONE) ? URL_COL_NONE : null,
                ].filter(Boolean);

                return (
                  <div
                    key={overlap.keyword}
                    className="rounded-xl border p-5 bg-teal-50/50 dark:bg-teal-900/5 border-teal-200 dark:border-teal-800"
                  >
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <a
                        href={`/keyword-mapping/overlap?keyword=${encodeURIComponent(overlap.keyword)}`}
                        className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-colors"
                      >
                        &quot;{overlap.keyword}&quot;
                        <svg className="w-3.5 h-3.5 ml-1 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-200 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                        {overlap.articles.length} URLs
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Pfade: {pathLabels || "—"}
                        {extraBits.length > 0 && ` · ${extraBits.join(" · ")}`}
                      </span>
                    </div>
                    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
                      {colKeys.map((colKey, colIdx) => {
                        const style = URL_PREFIX_OVERLAP_COLUMN_STYLES[colIdx % URL_PREFIX_OVERLAP_COLUMN_STYLES.length];
                        return (
                          <div key={colKey}>
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                              <span className="normal-case font-mono text-[11px] tracking-normal">{colKey}</span>
                            </div>
                            <div className="space-y-2">
                              {overlap.articles
                                .filter((a) => bucket(a) === colKey)
                                .map((article) => {
                                  const fromPlan = editorialArticleById.get(article.id);
                                  const displayTitle = fromPlan?.title ?? article.title;
                                  const displayUrl =
                                    fromPlan?.url?.trim() || article.url?.trim() || null;
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
                                                Präfix: {seg}
                                              </span>
                                            )}
                                          </>
                                        ) : (
                                          <span className="text-xs text-slate-500 dark:text-slate-500 italic mt-0.5 block">
                                            Keine URL im Redaktionsplan
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
                  </div>
                );
              })}
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
                    Keyword
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Anzahl URLs
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Zugeordnete Artikel
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
                      return a ? { id: a.id, title: a.title, url: a.url } : null;
                    })
                    .filter(Boolean) as Array<{ id: string; title: string; url: string | null }>;

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
                            Einzigartig
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
                            Überlappung
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
              Keine Keywords gefunden.
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
                Keine Keywords vorhanden.
              </div>
            )}
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-center gap-6 text-xs text-slate-400 dark:text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-slate-300 dark:bg-slate-600" />
                Einzigartig (1 URL)
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-amber-400 dark:bg-amber-600" />
                Überlappung (2+ URLs)
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[0.65rem]">Aa</span>
                <span className="mx-1">&rarr;</span>
                <span className="text-[1rem] font-medium">Aa</span>
                Schriftgrösse = Häufigkeit
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
                    {selectedCloudArticles.length} {selectedCloudArticles.length === 1 ? "Artikel" : "Artikel"}
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
            Keyword-Analyse starten
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            Klicke auf &quot;Keyword-Analyse starten&quot;, um alle {eligibleArticles.length.toLocaleString()} Artikel
            des Redaktionsplans auf ihre Fokuskeywords zu prüfen. Die Analyse basiert auf Title, H1 und Meta-Description.
          </p>
          <div className="flex items-center justify-center gap-8 text-sm text-slate-400 dark:text-slate-500">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {articles.length.toLocaleString()} Artikel total
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {eligibleArticles.length.toLocaleString()} mit SEO-Daten
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
