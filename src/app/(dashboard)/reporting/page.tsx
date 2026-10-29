"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { sanitizeHtml } from "@/lib/sanitize";
import { PieChart } from "@/components/charts";
import { useMessages } from "@/i18n/I18nProvider";
import { reportingMessages } from "@/i18n/messages/reporting";

interface RankingStats {
  total: number;
  top3: number;
  top10: number;
  top20: number;
  top50: number;
  top100: number;
  notRanking: number;
  avgPosition: number;
  improved: number;
  declined: number;
  unchanged: number;
}

interface CategoryStat {
  category: string;
  total: number;
  ranking: number;
  top10: number;
  avgPosition: number | null;
}

interface KeywordData {
  id: string;
  keyword: string;
  category: string | null;
  currentPosition: number | null;
  deltaLast: number | null;
  deltaStart: number | null;
  searchVolume: number | null;
  latestUrl: string | null;
}

interface RankingReportData {
  keywords: KeywordData[];
  stats: RankingStats;
  categoryStats: CategoryStat[];
  topImprovers: KeywordData[];
  topDecliners: KeywordData[];
}

// Report-Typen Konfiguration
const REPORT_TYPES = [
  {
    id: "ranking",
    href: "/reporting/ranking",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
      </svg>
    ),
    color: "from-blue-500 to-indigo-600",
    available: true,
  },
  {
    id: "traffic",
    href: "/reporting/traffic",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    color: "from-emerald-500 to-teal-600",
    available: true,
  },
  {
    id: "kvp",
    href: "/reporting/kvp",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: "from-amber-500 to-orange-600",
    available: true,
  },
  {
    id: "tasks",
    href: "/reporting/tasks",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    color: "from-cyan-500 to-teal-600",
    available: true,
  },
  {
    id: "competitor",
    href: "/reporting/competitor",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    color: "from-purple-500 to-pink-600",
    available: false,
  },
];

export default function ReportingPage() {
  const t = useMessages(reportingMessages);
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<RankingReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGeneratingAiReport, setIsGeneratingAiReport] = useState(false);
  const [aiReportError, setAiReportError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Ranking-Daten für Executive Summary laden
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/reporting/ranking-report?days=30");
        if (!res.ok) throw new Error("Fehler beim Laden der Daten");
        const result = await res.json();
        setData(result);
      } catch (error) {
        console.error("Error fetching ranking data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  // Executive Summary Text generieren
  const executiveSummary = useMemo(() => {
    if (!data || data.stats.total === 0) return null;

    const { stats, categoryStats, topImprovers, topDecliners } = data;
    const top10Total = stats.top3 + stats.top10;
    const top10Pct = ((top10Total / stats.total) * 100).toFixed(1);
    const rankingPct = (((stats.total - stats.notRanking) / stats.total) * 100).toFixed(1);

    const bestCategory = categoryStats
      .filter((c) => c.avgPosition !== null)
      .sort((a, b) => (a.avgPosition || 999) - (b.avgPosition || 999))[0];

    const topImprover = topImprovers[0];
    const topDecliner = topDecliners[0];

    return {
      total: stats.total,
      top10Total,
      top10Pct,
      rankingPct,
      avgPosition: stats.avgPosition,
      improved: stats.improved,
      declined: stats.declined,
      bestCategory: bestCategory?.category || null,
      bestCategoryAvg: bestCategory?.avgPosition || null,
      topImprover: topImprover
        ? t.summary.keywordDelta(topImprover.keyword, `+${topImprover.deltaLast}`)
        : null,
      topDecliner: topDecliner
        ? t.summary.keywordDelta(topDecliner.keyword, `${topDecliner.deltaLast}`)
        : null,
    };
  }, [data, t]);

  // Distribution data für kleines Pie Chart
  const distributionData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Top 3", value: data.stats.top3 },
      { name: "Top 4-10", value: data.stats.top10 },
      { name: "Top 11-20", value: data.stats.top20 },
      { name: "Top 21-50", value: data.stats.top50 },
      { name: "Top 51-100", value: data.stats.top100 },
      { name: t.distribution.notRanking, value: data.stats.notRanking },
    ].filter((d) => d.value > 0);
  }, [data, t]);

  const generateAiReport = async () => {
    if (!data) return;
    setIsGeneratingAiReport(true);
    setAiReportError(null);
    setAiReport(null);

    try {
      const response = await fetch("/api/reporting/ai-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ranking",
          rankingData: {
            stats: data.stats,
            categoryStats: data.categoryStats,
            topImprovers: data.topImprovers.slice(0, 10).map((kw) => ({
              keyword: kw.keyword,
              position: kw.currentPosition,
              delta: kw.deltaLast,
              category: kw.category,
              searchVolume: kw.searchVolume,
            })),
            topDecliners: data.topDecliners.slice(0, 10).map((kw) => ({
              keyword: kw.keyword,
              position: kw.currentPosition,
              delta: kw.deltaLast,
              category: kw.category,
              searchVolume: kw.searchVolume,
            })),
            topKeywords: data.keywords
              .filter((kw) => kw.currentPosition !== null)
              .sort((a, b) => (a.currentPosition || 999) - (b.currentPosition || 999))
              .slice(0, 20)
              .map((kw) => ({
                keyword: kw.keyword,
                position: kw.currentPosition,
                deltaLast: kw.deltaLast,
                deltaStart: kw.deltaStart,
                category: kw.category,
                searchVolume: kw.searchVolume,
                url: kw.latestUrl,
              })),
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t.ai.errorGenerating);
      }

      const result = await response.json();
      setAiReport(result.report);
    } catch (error) {
      console.error("Error generating AI report:", error);
      setAiReportError(error instanceof Error ? error.message : t.ai.unknownError);
    } finally {
      setIsGeneratingAiReport(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t.subtitle}
        </p>
      </div>

      {/* Executive Summary */}
      {isLoading ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span className="text-sm text-slate-500 dark:text-slate-400">{t.loadingData}</span>
          </div>
        </div>
      ) : data && executiveSummary ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{t.executiveSummary}</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Kennzahlen */}
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard title={t.stats.totalKeywords} value={executiveSummary.total} />
                  <StatCard title={t.stats.avgPosition} value={executiveSummary.avgPosition} format="position" />
                  <StatCard
                    title={t.stats.top10}
                    value={executiveSummary.top10Total}
                    subtitle={t.stats.top10Subtitle(executiveSummary.top10Pct)}
                    trend="up"
                  />
                  <StatCard
                    title={t.stats.improvedDeclined}
                    value={`${executiveSummary.improved} / ${executiveSummary.declined}`}
                  />
                </div>

                {/* Summary Text */}
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <div className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
                    <p>
                      {t.summary.rankingIntro}
                      <strong className="text-slate-900 dark:text-white">{t.summary.trackedKeywords(executiveSummary.total)}</strong>
                      {t.summary.rankingVerb}
                      <strong className="text-slate-900 dark:text-white">{executiveSummary.rankingPct}%</strong>
                      {t.summary.inTop100}
                      <strong className="text-blue-600 dark:text-blue-400">{executiveSummary.top10Total}</strong>
                      {t.summary.inTop10}
                      <strong className="text-slate-900 dark:text-white">{executiveSummary.avgPosition}</strong>
                      {t.summary.inTop10End}
                    </p>
                    <p>
                      {t.summary.changeIntro}
                      <strong className="text-emerald-600 dark:text-emerald-400">{t.summary.improved(executiveSummary.improved)}</strong>
                      {t.summary.and}
                      <strong className="text-red-600 dark:text-red-400">{t.summary.declined(executiveSummary.declined)}</strong>
                      {t.summary.changeEnd}
                    </p>
                    {executiveSummary.bestCategory && (
                      <p>
                        {t.summary.bestCategoryIntro}
                        <strong className="text-slate-900 dark:text-white">{executiveSummary.bestCategory}</strong>
                        {t.summary.bestCategoryMid}
                        <strong className="text-slate-900 dark:text-white">{executiveSummary.bestCategoryAvg}</strong>
                        {t.summary.bestCategoryEnd}
                      </p>
                    )}
                    {(executiveSummary.topImprover || executiveSummary.topDecliner) && (
                      <p>
                        {executiveSummary.topImprover && (
                          <>
                            {t.summary.topImprover}<strong className="text-emerald-600 dark:text-emerald-400">{executiveSummary.topImprover}</strong>.{" "}
                          </>
                        )}
                        {executiveSummary.topDecliner && (
                          <>
                            {t.summary.topDecliner}<strong className="text-red-600 dark:text-red-400">{executiveSummary.topDecliner}</strong>.
                          </>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Mini Pie Chart */}
              <div>
                <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">{t.distribution.title}</h3>
                {distributionData.length > 0 ? (
                  <PieChart data={distributionData} height={200} />
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-sm text-slate-400">
                    {t.noData}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {t.noRankingData.before}
            <Link href="/ranktracker" className="text-blue-600 dark:text-blue-400 hover:underline">
              {t.noRankingData.link}
            </Link>
            {t.noRankingData.after}
          </p>
        </div>
      )}

      {/* KI-Report Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
              {t.ai.title}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t.ai.description}
            </p>
          </div>
          <button
            onClick={generateAiReport}
            disabled={isGeneratingAiReport || !data || data.stats.total === 0}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-medium rounded-lg transition-all disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
          >
            {isGeneratingAiReport ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>{t.ai.generating}</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <span>{t.ai.generate}</span>
              </>
            )}
          </button>
        </div>

        {aiReportError && (
          <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">{aiReportError}</p>
          </div>
        )}

        {aiReport && (
          <div className="mt-6 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <div className="text-slate-700 dark:text-slate-300 leading-relaxed">
                {aiReport.split("\n").map((line, i) => {
                  if (line.match(/^#{1,6}\s/)) {
                    const level = Math.min(line.match(/^#+/)?.[0].length || 1, 6);
                    let text = line.replace(/^#+\s/, "");
                    text = text.replace(/\*\*/g, "").replace(/\*/g, "");
                    const className = `font-bold text-slate-900 dark:text-white mt-6 mb-3 ${
                      level === 1 ? "text-2xl" : level === 2 ? "text-xl" : level === 3 ? "text-lg" : "text-base"
                    }`;
                    if (level === 1) return <h1 key={i} className={className}>{text}</h1>;
                    if (level === 2) return <h2 key={i} className={className}>{text}</h2>;
                    if (level === 3) return <h3 key={i} className={className}>{text}</h3>;
                    if (level === 4) return <h4 key={i} className={className}>{text}</h4>;
                    if (level === 5) return <h5 key={i} className={className}>{text}</h5>;
                    return <h6 key={i} className={className}>{text}</h6>;
                  }
                  if (line.match(/^[-*]\s/)) {
                    let listText = line.replace(/^[-*]\s/, "");
                    listText = listText.replace(/\*\*(.*?)\*\*/g, "<strong class='font-bold text-slate-900 dark:text-white'>$1</strong>");
                    listText = listText.replace(/\*(.*?)\*/g, "<em class='italic'>$1</em>");
                    listText = listText.replace(/\*(?![*<])/g, "");
                    return (
                      <div key={i} className="ml-4 mb-2" dangerouslySetInnerHTML={{ __html: sanitizeHtml(`<span class="text-slate-400">&bull;</span> ${listText}`) }} />
                    );
                  }
                  if (line.trim()) {
                    let text = line;
                    text = text.replace(/\*\*(.*?)\*\*/g, "<strong class='font-bold text-slate-900 dark:text-white'>$1</strong>");
                    text = text.replace(/\*(.*?)\*/g, "<em class='italic'>$1</em>");
                    text = text.replace(/\*(?![*<])/g, "");
                    return <p key={i} className="mb-3" dangerouslySetInnerHTML={{ __html: sanitizeHtml(text) }} />;
                  }
                  return <br key={i} />;
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Report-Typen Auswahl */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{t.reportTypesTitle}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {REPORT_TYPES.map((report) => (
            <div key={report.id} className="relative">
              {report.available ? (
                <Link
                  href={report.href}
                  className="group block bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className={`shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br ${report.color} flex items-center justify-center text-white`}>
                      {report.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {t.reportTypes[report.id].title}
                        </h3>
                        <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t.reportTypes[report.id].description}
                      </p>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="block bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 opacity-60">
                  <div className="flex items-start gap-4">
                    <div className={`shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white`}>
                      {report.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                          {t.reportTypes[report.id].title}
                        </h3>
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">
                          {t.comingSoon}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t.reportTypes[report.id].description}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
