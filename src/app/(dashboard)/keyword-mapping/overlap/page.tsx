"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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

const LOCATION_COLORS: Record<string, string> = {
  Guide: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Insights: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "CH Market": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  Global: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  Microsites: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  Minisites: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
};

export default function OverlapDetailPage() {
  const searchParams = useSearchParams();
  const keyword = searchParams.get("keyword") ?? "";

  const [articles, setArticles] = useState<Article[]>([]);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [articlesRes, mappingRes] = await Promise.all([
          fetch("/api/editorial-plan?scope=keyword-mapping"),
          fetch("/api/editorial-plan/keyword-mapping"),
        ]);

        if (articlesRes.ok) {
          const data = await articlesRes.json();
          setArticles(data.articles);
        }

        if (mappingRes.ok) {
          const data = await mappingRes.json();
          if (data.run) setAnalysisData(data.run);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const overlapGroup = useMemo(() => {
    if (!analysisData || !keyword) return null;
    return analysisData.overlaps.find(
      (o) => o.keyword.toLowerCase() === keyword.toLowerCase()
    ) ?? null;
  }, [analysisData, keyword]);

  const enrichedArticles = useMemo(() => {
    if (!overlapGroup) return [];
    return overlapGroup.articles.map((oa) => {
      const full = articles.find((a) => a.id === oa.id);
      const result = analysisData?.results.find((r) => r.id === oa.id);
      return {
        id: oa.id,
        title: (full?.title?.trim() || oa.title)?.trim() || oa.title,
        url: full?.url?.trim() || oa.url?.trim() || null,
        location: full?.location ?? oa.location ?? null,
        category: full?.category ?? null,
        h1: full?.h1 ?? null,
        metaDescription: full?.metaDescription ?? null,
        focusKeywords: result?.focusKeywords ?? [],
        reasoning: result?.reasoning ?? "",
      };
    });
  }, [overlapGroup, articles, analysisData]);

  const locationGroups = useMemo(() => {
    const groups = new Map<string, typeof enrichedArticles>();
    for (const a of enrichedArticles) {
      const loc = a.location || "Ohne Location";
      if (!groups.has(loc)) groups.set(loc, []);
      groups.get(loc)!.push(a);
    }
    return groups;
  }, [enrichedArticles]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="mt-3 h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!keyword) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 dark:text-slate-400">Kein Keyword angegeben.</p>
        <Link href="/keyword-mapping" className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline">
          &larr; Zurück zum Keyword Mapping
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/keyword-mapping"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Zurück zum Keyword Mapping
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Keyword-Überlappung
          </h1>
          <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-700">
            <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            &quot;{keyword}&quot;
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {enrichedArticles.length} {enrichedArticles.length === 1 ? "Artikel verwendet" : "Artikel verwenden"} dieses Fokuskeyword.
          {enrichedArticles.length >= 3 && (
            <span className="ml-2 text-red-600 dark:text-red-400 font-medium">
              Hohes Kannibalisierungsrisiko
            </span>
          )}
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className={`text-2xl font-bold ${enrichedArticles.length >= 3 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
            {enrichedArticles.length}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Betroffene URLs</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {locationGroups.size}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Locations betroffen</div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {new Set(enrichedArticles.map((a) => a.category).filter(Boolean)).size}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Kategorien betroffen</div>
        </div>
      </div>

      {/* Severity banner */}
      {enrichedArticles.length >= 3 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <div className="text-sm font-medium text-red-800 dark:text-red-300">
              Hohes Kannibalisierungsrisiko
            </div>
            <div className="text-sm text-red-700 dark:text-red-400 mt-0.5">
              {enrichedArticles.length} Artikel konkurrieren um dasselbe Fokuskeyword. Es wird empfohlen, die Content-Strategie zu konsolidieren.
            </div>
          </div>
        </div>
      )}

      {/* No data state */}
      {!overlapGroup && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">Keine Überlappung gefunden</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Für &quot;{keyword}&quot; wurde keine Keyword-Überlappung erkannt, oder die Analyse wurde noch nicht durchgeführt.
          </p>
        </div>
      )}

      {/* Articles table */}
      {overlapGroup && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Alle Artikel mit Fokuskeyword &quot;{keyword}&quot;
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Artikel
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Kategorie
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    SEO-Daten
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Alle Fokuskeywords
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Begründung
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {enrichedArticles.map((article) => (
                  <tr key={article.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="max-w-sm">
                        <div className="font-medium text-sm text-slate-900 dark:text-white">
                          {article.title}
                        </div>
                        {article.url && (
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-0.5 block truncate"
                          >
                            {article.url}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {article.location ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${LOCATION_COLORS[article.location] || "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                          {article.location}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">–</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {article.category ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${CATEGORY_COLORS[article.category] || "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                          {article.category}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">–</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="max-w-xs space-y-1">
                        {article.h1 && (
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            <span className="font-medium text-slate-500 dark:text-slate-500">H1:</span>{" "}
                            <span className="truncate block">{article.h1}</span>
                          </div>
                        )}
                        {article.metaDescription && (
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            <span className="font-medium text-slate-500 dark:text-slate-500">Meta:</span>{" "}
                            <span className="line-clamp-2">
                              {article.metaDescription.substring(0, 150)}
                              {article.metaDescription.length > 150 ? "..." : ""}
                            </span>
                          </div>
                        )}
                        {!article.h1 && !article.metaDescription && (
                          <span className="text-xs text-slate-400 italic">Keine SEO-Daten</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {article.focusKeywords.map((kw) => {
                          const isThisKeyword = kw.toLowerCase() === keyword.toLowerCase();
                          return (
                            <span
                              key={kw}
                              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                                isThisKeyword
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-700"
                                  : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {kw}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs text-slate-600 dark:text-slate-400">
                        {article.reasoning || "–"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Location breakdown */}
      {overlapGroup && locationGroups.size > 1 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Verteilung nach Location
            </h2>
          </div>
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...locationGroups.entries()].map(([location, groupArticles]) => (
              <div
                key={location}
                className="rounded-lg border border-slate-200 dark:border-slate-700 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${LOCATION_COLORS[location] || "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                    {location}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {groupArticles.length} {groupArticles.length === 1 ? "Artikel" : "Artikel"}
                  </span>
                </div>
                <div className="space-y-2">
                  {groupArticles.map((a) => (
                    <div key={a.id} className="text-xs">
                      <div className="font-medium text-slate-700 dark:text-slate-300 truncate">
                        {a.title}
                      </div>
                      {a.url && (
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 dark:text-blue-400 hover:underline truncate block"
                        >
                          {a.url}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
