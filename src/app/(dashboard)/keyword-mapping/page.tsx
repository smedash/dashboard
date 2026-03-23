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

const CATEGORY_COLORS: Record<string, string> = {
  Mortgages: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "Accounts&Cards": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  Investing: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  Pension: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "Digital Banking": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
};

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

type TabId = "mapping" | "overlaps" | "location-overlaps" | "keywords" | "tagcloud";

export default function KeywordMappingPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState("");
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("mapping");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [overlapFilter, setOverlapFilter] = useState<"all" | "with-overlaps">("all");
  const [keywordSearch, setKeywordSearch] = useState("");
  const [selectedCloudKeyword, setSelectedCloudKeyword] = useState<string | null>(null);

  const fetchArticles = useCallback(async () => {
    try {
      const res = await fetch("/api/editorial-plan");
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles);
      }
    } catch (error) {
      console.error("Error fetching articles:", error);
    }
  }, []);

  const fetchSavedMapping = useCallback(async () => {
    try {
      const res = await fetch("/api/editorial-plan/keyword-mapping");
      if (res.ok) {
        const data = await res.json();
        if (data.run) {
          setAnalysisData(data.run);
        }
      }
    } catch (error) {
      console.error("Error fetching saved mapping:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchArticles(), fetchSavedMapping()]);
  }, [fetchArticles, fetchSavedMapping]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setProgress("Sende Artikel an Claude zur Keyword-Analyse...");
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

      const data: AnalysisData = await res.json();
      setAnalysisData(data);
      setProgress("");
    } catch (error) {
      console.error("Error running analysis:", error);
      setProgress(`Fehler: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const getResultForArticle = (articleId: string): KeywordResult | undefined => {
    return analysisData?.results.find((r) => r.id === articleId);
  };

  const getOverlapsForArticle = (articleId: string): OverlapGroup[] => {
    if (!analysisData) return [];
    return analysisData.overlaps.filter((o) => o.articles.some((a) => a.id === articleId));
  };

  const eligibleArticles = articles.filter(
    (a) => a.title && (a.h1 || a.metaDescription)
  );

  const filteredArticles = eligibleArticles.filter((a) => {
    const matchesSearch =
      !searchTerm ||
      a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.h1?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getResultForArticle(a.id)?.focusKeywords.some((k) =>
        k.toLowerCase().includes(searchTerm.toLowerCase())
      );

    const matchesCategory = categoryFilter === "all" || a.category === categoryFilter;

    const matchesOverlap =
      overlapFilter === "all" || getOverlapsForArticle(a.id).length > 0;

    return matchesSearch && matchesCategory && matchesOverlap;
  });

  const categories = [...new Set(articles.map((a) => a.category).filter(Boolean))] as string[];

  const totalOverlaps = analysisData?.overlaps.length ?? 0;
  const criticalOverlaps = analysisData?.overlaps.filter((o) => o.articles.length >= 3).length ?? 0;

  const locationOverlaps = useMemo(() => {
    if (!analysisData) return [];
    return analysisData.overlaps.filter((o) => {
      const locations = new Set(o.articles.map((a) => a.location).filter(Boolean));
      return locations.has("Guide") && locations.has("Insights");
    });
  }, [analysisData]);

  const keywordStats = useMemo(() => {
    if (!analysisData) return { unique: [], counts: new Map<string, number>() };
    const counts = new Map<string, number>();
    for (const r of analysisData.results) {
      for (const kw of r.focusKeywords) {
        const normalized = kw.toLowerCase().trim();
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      }
    }
    const unique = [...counts.entries()]
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword));
    return { unique, counts };
  }, [analysisData]);

  const filteredKeywords = useMemo(() => {
    if (!keywordSearch) return keywordStats.unique;
    const term = keywordSearch.toLowerCase();
    return keywordStats.unique.filter((k) => k.keyword.includes(term));
  }, [keywordStats.unique, keywordSearch]);

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
    return analysisData.results
      .filter((r) => r.focusKeywords.some((kw) => kw.toLowerCase().trim() === selectedCloudKeyword))
      .map((r) => {
        const article = articles.find((a) => a.id === r.id);
        return article ? { id: article.id, title: article.title, url: article.url } : null;
      })
      .filter(Boolean) as Array<{ id: string; title: string; url: string | null }>;
  }, [selectedCloudKeyword, analysisData, articles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
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
              {analysisData ? "Neue Analyse starten" : `Keyword-Analyse starten (${eligibleArticles.length} Artikel)`}
            </>
          )}
        </button>
      </div>

      {/* Progress */}
      {progress && (
        <div className={`p-4 rounded-lg text-sm ${
          progress.startsWith("Fehler")
            ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
            : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
        }`}>
          {progress}
        </div>
      )}

      {/* Stats */}
      {analysisData && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{analysisData.analyzed}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Artikel analysiert</div>
          </div>
          <button
            onClick={() => setActiveTab("keywords")}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-left hover:border-blue-400 dark:hover:border-blue-500 hover:ring-1 hover:ring-blue-400 dark:hover:ring-blue-500 transition-all group"
          >
            <div className="text-2xl font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {keywordStats.unique.length}
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
              {totalOverlaps}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Keyword-Überlappungen</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className={`text-2xl font-bold ${criticalOverlaps > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
              {criticalOverlaps}
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
              Keyword-Mapping ({filteredArticles.length})
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
                  {totalOverlaps}
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
                  {locationOverlaps.length}
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
              Alle Keywords ({keywordStats.unique.length})
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

      {/* Filters (for mapping + keywords tabs) */}
      {analysisData && (activeTab === "mapping" || activeTab === "keywords") && (
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={activeTab === "keywords" ? "Keyword suchen..." : "Suche nach Titel, URL oder Keyword..."}
              value={activeTab === "keywords" ? keywordSearch : searchTerm}
              onChange={(e) => activeTab === "keywords" ? setKeywordSearch(e.target.value) : setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {activeTab === "mapping" && (
            <>
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
                value={overlapFilter}
                onChange={(e) => setOverlapFilter(e.target.value as "all" | "with-overlaps")}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Alle Artikel</option>
                <option value="with-overlaps">Nur mit Überlappungen</option>
              </select>
            </>
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
                {filteredArticles.map((article) => {
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
                            <div className="text-xs text-blue-600 dark:text-blue-400 truncate mt-0.5" title={article.url}>
                              {article.url}
                            </div>
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
                              const isOverlapping = analysisData.overlaps.some(
                                (o) => o.keyword === kw
                              );
                              return (
                                <span
                                  key={kw}
                                  className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                                    isOverlapping
                                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-700"
                                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                                  }`}
                                >
                                  {isOverlapping && (
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                  )}
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
                              <div key={overlap.keyword} className="text-xs">
                                <span className="font-medium text-amber-700 dark:text-amber-400">
                                  &quot;{overlap.keyword}&quot;
                                </span>
                                <span className="text-slate-500 dark:text-slate-400">
                                  {" "}
                                  ({overlap.articles.length} URLs)
                                </span>
                              </div>
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
        </div>
      )}

      {/* Overlaps Tab */}
      {activeTab === "overlaps" && analysisData && (
        <div className="space-y-4">
          {analysisData.overlaps.length === 0 ? (
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
            analysisData.overlaps.map((overlap) => (
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
                  {overlap.articles.map((article) => (
                    <div
                      key={article.id}
                      className="flex items-start gap-3 bg-white/60 dark:bg-slate-800/60 rounded-lg px-3 py-2"
                    >
                      <svg className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {article.title}
                        </div>
                        {article.url && (
                          <div className="text-xs text-blue-600 dark:text-blue-400 truncate">
                            {article.url}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Location Overlap Tab */}
      {activeTab === "location-overlaps" && analysisData && (
        <div className="space-y-4">
          <div className="bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 rounded-xl p-4">
            <p className="text-sm text-violet-700 dark:text-violet-200">
              Hier werden Keywords angezeigt, die sowohl in <strong>Guide</strong>- als auch in <strong>Insights</strong>-Artikeln vorkommen.
              Diese Überlappungen über Location-Grenzen hinweg sind besonders relevant für die Content-Strategie.
            </p>
          </div>
          {locationOverlaps.length === 0 ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-8 text-center">
              <svg className="w-12 h-12 mx-auto text-green-500 dark:text-green-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-green-800 dark:text-green-300">Keine Location-Überlappungen</h3>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                Kein Keyword kommt gleichzeitig in Guide- und Insights-Artikeln vor.
              </p>
            </div>
          ) : (
            locationOverlaps.map((overlap) => (
              <div
                key={overlap.keyword}
                className="rounded-xl border p-5 bg-violet-50/50 dark:bg-violet-900/5 border-violet-200 dark:border-violet-800"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
                    &quot;{overlap.keyword}&quot;
                  </span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-200 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                    {overlap.articles.length} URLs
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Guide
                    </div>
                    <div className="space-y-2">
                      {overlap.articles
                        .filter((a) => a.location === "Guide")
                        .map((article) => (
                          <div
                            key={article.id}
                            className="flex items-start gap-3 bg-white/80 dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-blue-100 dark:border-blue-900/30"
                          >
                            <svg className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {article.title}
                              </div>
                              {article.url && (
                                <div className="text-xs text-blue-600 dark:text-blue-400 truncate mt-0.5">
                                  {article.url}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Insights
                    </div>
                    <div className="space-y-2">
                      {overlap.articles
                        .filter((a) => a.location === "Insights")
                        .map((article) => (
                          <div
                            key={article.id}
                            className="flex items-start gap-3 bg-white/80 dark:bg-slate-800/60 rounded-lg px-3 py-2 border border-emerald-100 dark:border-emerald-900/30"
                          >
                            <svg className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {article.title}
                              </div>
                              {article.url && (
                                <div className="text-xs text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
                                  {article.url}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            ))
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
                {filteredKeywords.map((kw, idx) => {
                  const isOverlap = kw.count > 1;
                  const matchingArticles = analysisData.results
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
                        {idx + 1}
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
                        <div className="space-y-1 max-w-sm">
                          {matchingArticles.map((a) => (
                            <div key={a.id} className="text-xs text-slate-600 dark:text-slate-400 truncate" title={a.title}>
                              {a.title}
                              {a.url && (
                                <span className="text-blue-500 dark:text-blue-400 ml-1">({a.url})</span>
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
                        <div className="text-xs text-blue-600 dark:text-blue-400 truncate mt-0.5">
                          {a.url}
                        </div>
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
            Klicke auf &quot;Keyword-Analyse starten&quot;, um alle {eligibleArticles.length} Artikel
            des Redaktionsplans auf ihre Fokuskeywords zu prüfen. Die Analyse basiert auf Title, H1 und Meta-Description.
          </p>
          <div className="flex items-center justify-center gap-8 text-sm text-slate-400 dark:text-slate-500">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {articles.length} Artikel total
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {eligibleArticles.length} mit SEO-Daten
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
