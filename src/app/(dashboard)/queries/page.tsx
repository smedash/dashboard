"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { downloadExcel } from "@/lib/excel-export";
import { DataTable } from "@/components/ui/DataTable";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { useProperty } from "@/contexts/PropertyContext";
import { useLocale, useMessages } from "@/i18n/I18nProvider";
import { queriesMessages } from "@/i18n/messages/queries";

interface QueryRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface TrendData {
  keyword: string;
  trendAvg: number | null;
  trendRecent: number | null;
  trendDirection: string | null;
  updatedAt?: string;
}

interface IntentData {
  keyword: string;
  intentLabel: string;
  intentProbability: number;
  secondaryIntents: Array<{ label: string; probability: number }> | null;
  updatedAt?: string;
}

interface TrendJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  totalKeywords: number;
  processedKeywords: number;
  createdAt: string;
}

interface IntentJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  totalKeywords: number;
  processedKeywords: number;
  createdAt: string;
}

export default function QueriesPage() {
  const { selectedProperty } = useProperty();
  const t = useMessages(queriesMessages);
  const { intlLocale } = useLocale();
  const [period, setPeriod] = useState("28d");
  const [data, setData] = useState<QueryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [brandFilter, setBrandFilter] = useState("ubs");
  const [excludeBrand, setExcludeBrand] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [trendDirectionFilter, setTrendDirectionFilter] = useState<string>("all");
  const [trendsMap, setTrendsMap] = useState<Map<string, TrendData>>(new Map());
  const [trendJob, setTrendJob] = useState<TrendJob | null>(null);
  const [isStartingJob, setIsStartingJob] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [intentMap, setIntentMap] = useState<Map<string, IntentData>>(new Map());
  const [intentJob, setIntentJob] = useState<IntentJob | null>(null);
  const [isStartingIntentJob, setIsStartingIntentJob] = useState(false);
  const intentPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!selectedProperty) return;

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/gsc/queries?siteUrl=${encodeURIComponent(selectedProperty)}&period=${period}&limit=25000`
        );
        const result = await response.json();
        setData(result.data || []);
      } catch (error) {
        console.error("Error fetching queries:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [selectedProperty, period]);

  const loadCachedTrends = useCallback(async (keywords: string[]) => {
    if (keywords.length === 0) return;

    const batchSize = 2000;
    const newMap = new Map<string, TrendData>();

    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);
      try {
        const response = await fetch("/api/google-trends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords: batch }),
        });
        if (!response.ok) continue;
        const result = await response.json();
        if (result.data) {
          for (const [key, value] of Object.entries(result.data)) {
            newMap.set(key, value as TrendData);
          }
        }
      } catch {
        console.error("Error loading cached trends batch");
      }
    }

    if (newMap.size > 0) {
      setTrendsMap(newMap);
    }
  }, []);

  const loadCachedIntents = useCallback(async (keywords: string[]) => {
    if (keywords.length === 0) return;

    const batchSize = 2000;
    const newMap = new Map<string, IntentData>();

    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);
      try {
        const response = await fetch("/api/search-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords: batch }),
        });
        if (!response.ok) continue;
        const result = await response.json();
        if (result.data) {
          for (const [key, value] of Object.entries(result.data)) {
            newMap.set(key, value as IntentData);
          }
        }
      } catch {
        console.error("Error loading cached intents batch");
      }
    }

    if (newMap.size > 0) {
      setIntentMap(newMap);
    }
  }, []);

  const checkIntentJobStatus = useCallback(async (opts?: { loadIntents?: boolean }) => {
    if (!selectedProperty) return null;
    try {
      const response = await fetch(
        `/api/search-intent/jobs?property=${encodeURIComponent(selectedProperty)}`
      );
      if (!response.ok) return null;
      const result = await response.json();
      const job = result.job as IntentJob | null;
      setIntentJob(job);

      if (opts?.loadIntents && job?.status === "completed" && data.length > 0) {
        const keywords = data.map((r) => r.keys[0].toLowerCase().trim());
        loadCachedIntents(keywords);
      }

      return job;
    } catch {
      console.error("Error checking intent job status");
      return null;
    }
  }, [selectedProperty, data, loadCachedIntents]);

  const checkJobStatus = useCallback(async (opts?: { loadTrends?: boolean }) => {
    if (!selectedProperty) return null;
    try {
      const response = await fetch(
        `/api/google-trends/jobs?property=${encodeURIComponent(selectedProperty)}`
      );
      if (!response.ok) return null;
      const result = await response.json();
      const job = result.job as TrendJob | null;
      setTrendJob(job);

      if (opts?.loadTrends && job?.status === "completed" && data.length > 0) {
        const keywords = data.map((r) => r.keys[0].toLowerCase().trim());
        loadCachedTrends(keywords);
      }

      return job;
    } catch {
      console.error("Error checking job status");
      return null;
    }
  }, [selectedProperty, data, loadCachedTrends]);

  useEffect(() => {
    if (selectedProperty && data.length > 0) {
      checkJobStatus({ loadTrends: true });
      checkIntentJobStatus({ loadIntents: true });
    }
  }, [selectedProperty, data.length, checkJobStatus, checkIntentJobStatus]);

  useEffect(() => {
    if (trendJob?.status === "pending" || trendJob?.status === "processing") {
      if (!pollRef.current) {
        pollRef.current = setInterval(async () => {
          const job = await checkJobStatus({
            loadTrends: true,
          });
          if (!job || job.status === "completed" || job.status === "failed") {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        }, 15_000);
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [trendJob?.status, checkJobStatus]);

  useEffect(() => {
    if (intentJob?.status === "pending" || intentJob?.status === "processing") {
      if (!intentPollRef.current) {
        intentPollRef.current = setInterval(async () => {
          const job = await checkIntentJobStatus({ loadIntents: true });
          if (!job || job.status === "completed" || job.status === "failed") {
            if (intentPollRef.current) {
              clearInterval(intentPollRef.current);
              intentPollRef.current = null;
            }
          }
        }, 15_000);
      }
    } else {
      if (intentPollRef.current) {
        clearInterval(intentPollRef.current);
        intentPollRef.current = null;
      }
    }

    return () => {
      if (intentPollRef.current) {
        clearInterval(intentPollRef.current);
        intentPollRef.current = null;
      }
    };
  }, [intentJob?.status, checkIntentJobStatus]);

  const validTrendsCount = useMemo(() => {
    let count = 0;
    for (const t of trendsMap.values()) {
      if (t.trendAvg !== null || t.trendRecent !== null) count++;
    }
    return count;
  }, [trendsMap]);

  const CATEGORY_KEYWORDS: Record<string, string[]> = {
    beratung: ["termin", "vereinbaren", "kontakt", "beratungsgespräch", "terminvereinbarung", "telefon", "email"],
    abschluss: ["eröffnen", "beantragen", "abschliessen", "kaufen", "buchen", "eröffnung", "abschluss"],
    produkte: [
      "hypothek", "zinsen", "konto", "konten", "kredit", "kreditkarte",
      "investment", "pension", "rente", "säule 3a", "sparkonto",
      "grenzgängerkonto", "mietkautionskonto", "bankkonto", "kontokorrentkonto",
      "haushaltskonto", "studentenkonto", "jugendkonto", "kinderkonto",
      "debitkarte", "prepaidkarte", "festhypothek", "baukredit",
      "baufinanzierung", "saron", "hypothekenrechner", "ablöserechner",
      "renovationsrechner", "finanzierungsrechner", "freizügigkeitskonto",
      "pensionierung", "pensionierungsrechner", "steuerrechner",
      "vermögensrechner", "fondskonto", "anlageplan", "festgeld",
      "wertschriftendepot", "anlagefonds", "twint", "mobile payment",
    ],
  };

  const tableData = useMemo(() => {
    const brandTerms = brandFilter
      .toLowerCase()
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const searchLower = searchQuery.toLowerCase().trim();

    return data
      .filter((row) => {
        const queryLower = row.keys[0].toLowerCase().trim();
        if (searchLower && !queryLower.includes(searchLower)) return false;
        if (excludeBrand && brandTerms.length > 0) {
          if (brandTerms.some((term) => queryLower.includes(term))) return false;
        }
        if (intentFilter !== "all") {
          const intent = intentMap.get(queryLower);
          if (intentFilter === "none") {
            if (intent) return false;
          } else {
            if (!intent || intent.intentLabel !== intentFilter) return false;
          }
        }
        if (categoryFilter !== "all") {
          const keywords = CATEGORY_KEYWORDS[categoryFilter];
          if (keywords && !keywords.some((kw) => queryLower.includes(kw))) return false;
        }
        if (trendDirectionFilter !== "all") {
          const trend = trendsMap.get(queryLower);
          const hasRealData = trend && (trend.trendAvg !== null || trend.trendRecent !== null);
          if (trendDirectionFilter === "none") {
            if (hasRealData) return false;
          } else {
            if (!hasRealData || trend.trendDirection !== trendDirectionFilter) return false;
          }
        }
        return true;
      })
      .map((row, index) => {
        const normalizedKey = row.keys[0].toLowerCase().trim();
        const trend = trendsMap.get(normalizedKey);
        const intent = intentMap.get(normalizedKey);
        return {
          id: index,
          query: row.keys[0],
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
          trendAvg: trend?.trendAvg ?? null,
          trendRecent: trend?.trendRecent ?? null,
          trendDirection: trend?.trendDirection ?? null,
          intentLabel: intent?.intentLabel ?? null,
          intentProbability: intent?.intentProbability ?? null,
        };
      });
  }, [data, excludeBrand, brandFilter, searchQuery, trendsMap, intentMap, intentFilter, categoryFilter, trendDirectionFilter]);

  const startTrendJob = useCallback(async () => {
    if (!selectedProperty || data.length === 0) return;

    setIsStartingJob(true);
    try {
      const keywords = data.map((r) => r.keys[0]);
      const response = await fetch("/api/google-trends/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords,
          property: selectedProperty,
          location: "Switzerland",
          language: "German",
        }),
      });

      const result = await response.json();
      if (response.ok) {
        setTrendJob(result.job);
      } else {
        if (result.job) setTrendJob(result.job);
        alert(result.error || t.errors.startJob);
      }
    } catch (error) {
      console.error("Error starting trend job:", error);
      alert(t.errors.startTrendJob);
    } finally {
      setIsStartingJob(false);
    }
  }, [selectedProperty, data, t]);

  const startIntentJob = useCallback(async () => {
    if (!selectedProperty || data.length === 0) return;

    setIsStartingIntentJob(true);
    try {
      const keywords = data.map((r) => r.keys[0]);
      const response = await fetch("/api/search-intent/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords,
          property: selectedProperty,
          language: "de",
        }),
      });

      const result = await response.json();
      if (response.ok) {
        setIntentJob(result.job);
      } else {
        if (result.job) setIntentJob(result.job);
        alert(result.error || t.errors.startJob);
      }
    } catch (error) {
      console.error("Error starting intent job:", error);
      alert(t.errors.startIntentJob);
    } finally {
      setIsStartingIntentJob(false);
    }
  }, [selectedProperty, data, t]);

  const exportToXlsx = useCallback(() => {
    if (tableData.length === 0) return;

    const hasTrends = trendsMap.size > 0;
    const hasIntents = intentMap.size > 0;
    const rows = tableData.map((r) => {
      const base: Record<string, unknown> = {
        [t.export.query]: r.query,
        [t.export.clicks]: r.clicks,
        [t.export.impressions]: r.impressions,
        [t.export.ctr]: Math.round(r.ctr * 10000) / 100,
        [t.export.position]: Math.round(r.position * 10) / 10,
      };
      if (hasIntents) {
        base[t.export.searchIntent] = r.intentLabel ?? "";
      }
      if (hasTrends) {
        base[t.export.trendAvg] = r.trendAvg ?? "";
        base[t.export.trendRecent] = r.trendRecent ?? "";
        base[t.export.trendDirection] =
          r.trendDirection === "up" ? "↑" :
          r.trendDirection === "down" ? "↓" :
          r.trendDirection === "stable" ? "→" : "";
      }
      return base;
    });

    const host = (() => {
      try {
        return new URL(selectedProperty || "").hostname.replace(/[^a-zA-Z0-9._-]/g, "_") || "property";
      } catch {
        return "property";
      }
    })();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadExcel(`${t.export.filePrefix}_${host}_${period}_${stamp}.xlsx`, [
      { name: t.export.sheetName, rows },
    ]);
  }, [tableData, selectedProperty, period, trendsMap, intentMap, t]);

  const jobIsActive = trendJob?.status === "pending" || trendJob?.status === "processing";
  const jobProgress = jobIsActive && trendJob
    ? Math.round((trendJob.processedKeywords / trendJob.totalKeywords) * 100)
    : null;
  const intentJobIsActive = intentJob?.status === "pending" || intentJob?.status === "processing";
  const intentJobProgress = intentJobIsActive && intentJob
    ? Math.round((intentJob.processedKeywords / intentJob.totalKeywords) * 100)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">{t.title}</h1>
        <div className="flex flex-wrap items-center gap-4">
          <PeriodSelector value={period} onChange={setPeriod} />
          <button
            type="button"
            onClick={startTrendJob}
            disabled={isLoading || isStartingJob || jobIsActive || data.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-emerald-600 bg-emerald-700 text-emerald-100 hover:bg-emerald-600 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            title={t.trendsButtonTitle}
          >
            {isStartingJob || jobIsActive ? (
              <div className="w-4 h-4 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            )}
            Google Trends
          </button>
          <button
            type="button"
            onClick={startIntentJob}
            disabled={isLoading || isStartingIntentJob || intentJobIsActive || data.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-violet-600 bg-violet-700 text-violet-100 hover:bg-violet-600 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            title={t.intentButtonTitle}
          >
            {isStartingIntentJob || intentJobIsActive ? (
              <div className="w-4 h-4 border-2 border-violet-300 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            )}
            Search Intent
          </button>
          <button
            type="button"
            onClick={exportToXlsx}
            disabled={isLoading || tableData.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            title={t.exportTitle}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Job Status Banner */}
      {jobIsActive && trendJob && (
        <div className="bg-emerald-900/50 border border-emerald-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-emerald-200">
                {t.trendsLoading}
              </span>
            </div>
            <span className="text-sm text-emerald-300">
              {t.jobProgress(trendJob.processedKeywords.toLocaleString(intlLocale), trendJob.totalKeywords.toLocaleString(intlLocale), jobProgress)}
            </span>
          </div>
          <div className="w-full bg-emerald-950 rounded-full h-2">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${jobProgress}%` }}
            />
          </div>
          <p className="text-xs text-emerald-400 mt-2">
            {t.trendsBackgroundHint}
          </p>
        </div>
      )}

      {trendJob?.status === "completed" && validTrendsCount > 0 && (
        <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-emerald-300">
            {t.trendsLoaded(validTrendsCount.toLocaleString(intlLocale))}
          </span>
          <button
            onClick={startTrendJob}
            disabled={isLoading || isStartingJob || data.length === 0}
            className="text-xs text-emerald-400 hover:text-emerald-200 underline disabled:opacity-50"
          >
            {t.reload}
          </button>
        </div>
      )}

      {/* Search Intent Job Status Banner */}
      {intentJobIsActive && intentJob && (
        <div className="bg-violet-900/50 border border-violet-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-violet-200">
                {t.intentLoading}
              </span>
            </div>
            <span className="text-sm text-violet-300">
              {t.jobProgress(intentJob.processedKeywords.toLocaleString(intlLocale), intentJob.totalKeywords.toLocaleString(intlLocale), intentJobProgress)}
            </span>
          </div>
          <div className="w-full bg-violet-950 rounded-full h-2">
            <div
              className="bg-violet-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${intentJobProgress}%` }}
            />
          </div>
          <p className="text-xs text-violet-400 mt-2">
            {t.intentBackgroundHint}
          </p>
        </div>
      )}

      {intentJob?.status === "completed" && intentMap.size > 0 && (
        <div className="bg-violet-900/30 border border-violet-800 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-violet-300">
            {t.intentLoaded(intentMap.size.toLocaleString(intlLocale))}
          </span>
          <button
            onClick={startIntentJob}
            disabled={isLoading || isStartingIntentJob || data.length === 0}
            className="text-xs text-violet-400 hover:text-violet-200 underline disabled:opacity-50"
          >
            {t.reload}
          </button>
        </div>
      )}

      {/* Search/Filters + Intent Pie Chart */}
      <div className={`grid gap-4 ${intentMap.size > 0 ? "grid-cols-1 lg:grid-cols-[1fr_280px_280px_280px]" : "grid-cols-1"}`}>
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={excludeBrand}
              onChange={(e) => setExcludeBrand(e.target.checked)}
              className="w-4 h-4 rounded border-slate-500 bg-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
            />
            <span className="text-sm text-slate-300">{t.excludeBrand}</span>
          </label>
          <input
            type="text"
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            placeholder={t.brandPlaceholder}
            disabled={!excludeBrand}
            className="flex-1 min-w-[200px] max-w-[400px] px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          {intentMap.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300">{t.intentLabel}</span>
              <div className="flex items-center gap-1">
                {[
                  { value: "all", label: t.all, cls: "border-slate-500 text-slate-300 hover:bg-slate-600" },
                  { value: "informational", label: "I", cls: "border-blue-500/50 text-blue-300 hover:bg-blue-500/20" },
                  { value: "navigational", label: "N", cls: "border-purple-500/50 text-purple-300 hover:bg-purple-500/20" },
                  { value: "commercial", label: "C", cls: "border-amber-500/50 text-amber-300 hover:bg-amber-500/20" },
                  { value: "transactional", label: "T", cls: "border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/20" },
                  { value: "none", label: "?", cls: "border-red-500/50 text-red-300 hover:bg-red-500/20" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setIntentFilter(opt.value)}
                    className={`px-2 py-1 text-xs font-bold rounded border transition-colors ${opt.cls} ${
                      intentFilter === opt.value
                        ? "ring-2 ring-offset-1 ring-offset-slate-800 ring-blue-500 bg-slate-600"
                        : ""
                    }`}
                    title={opt.value === "all" ? t.showAll : opt.value === "none" ? t.noIntent : opt.value.charAt(0).toUpperCase() + opt.value.slice(1)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300">{t.categoryLabel}</span>
            <div className="flex items-center gap-[5px]">
              {[
                { value: "all", label: t.all, cls: "border-slate-500 text-slate-300 hover:bg-slate-600" },
                { value: "beratung", label: t.categories.beratung, cls: "border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/20" },
                { value: "abschluss", label: t.categories.abschluss, cls: "border-orange-500/50 text-orange-300 hover:bg-orange-500/20" },
                { value: "produkte", label: t.categories.produkte, cls: "border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/20" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategoryFilter(opt.value)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors ${opt.cls} ${
                    categoryFilter === opt.value
                      ? "ring-2 ring-offset-1 ring-offset-slate-800 ring-blue-500 bg-slate-600"
                      : ""
                  }`}
                  title={
                    opt.value === "all"
                      ? t.showAll
                      : t.categoryTitle(opt.label)
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {trendsMap.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300">{t.trendLabel}</span>
              <div className="flex items-center gap-[5px]">
                {[
                  { value: "all", label: t.all, icon: null, cls: "border-slate-500 text-slate-300 hover:bg-slate-600" },
                  { value: "up", label: "↑", icon: null, cls: "border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/20" },
                  { value: "stable", label: "→", icon: null, cls: "border-slate-400/50 text-slate-300 hover:bg-slate-500/20" },
                  { value: "down", label: "↓", icon: null, cls: "border-red-500/50 text-red-300 hover:bg-red-500/20" },
                  { value: "none", label: "?", icon: null, cls: "border-yellow-500/50 text-yellow-300 hover:bg-yellow-500/20" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTrendDirectionFilter(opt.value)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors ${opt.cls} ${
                      trendDirectionFilter === opt.value
                        ? "ring-2 ring-offset-1 ring-offset-slate-800 ring-blue-500 bg-slate-600"
                        : ""
                    }`}
                    title={
                      opt.value === "all" ? t.showAll :
                      opt.value === "up" ? t.trendFilter.up :
                      opt.value === "stable" ? t.trendFilter.stable :
                      opt.value === "down" ? t.trendFilter.down :
                      t.trendFilter.none
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <span className="text-sm text-slate-400">
            {t.resultCount(tableData.length, data.length)}
          </span>
        </div>
      </div>

      {/* Intent Pie Chart */}
      {intentMap.size > 0 && (() => {
        const counts = { informational: 0, navigational: 0, commercial: 0, transactional: 0, none: 0 };
        for (const row of tableData) {
          const label = row.intentLabel as string | null;
          if (label && label in counts) {
            counts[label as keyof typeof counts]++;
          } else {
            counts.none++;
          }
        }
        const total = counts.informational + counts.navigational + counts.commercial + counts.transactional + counts.none;
        if (total === 0) return null;

        const segments = [
          { label: "Informational", short: "I", count: counts.informational, color: "#3b82f6" },
          { label: "Navigational", short: "N", count: counts.navigational, color: "#a855f7" },
          { label: "Commercial", short: "C", count: counts.commercial, color: "#f59e0b" },
          { label: "Transactional", short: "T", count: counts.transactional, color: "#10b981" },
          { label: t.noIntent, short: "?", count: counts.none, color: "#ef4444" },
        ].filter((s) => s.count > 0);

        const radius = 40;
        const circumference = 2 * Math.PI * radius;
        let offset = 0;

        return (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col items-center justify-center">
            <h3 className="text-sm font-medium text-slate-300 mb-3">{t.intentDistribution}</h3>
            <svg viewBox="0 0 100 100" className="w-28 h-28 mb-3">
              {segments.map((seg) => {
                const pct = seg.count / total;
                const dashLength = pct * circumference;
                const dashOffset = -offset * circumference;
                offset += pct;
                return (
                  <circle
                    key={seg.label}
                    cx="50" cy="50" r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="18"
                    strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                    strokeDashoffset={dashOffset}
                    className="transition-all duration-500"
                  />
                );
              })}
              <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" className="fill-white text-[10px] font-bold">
                {total.toLocaleString(intlLocale)}
              </text>
            </svg>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {segments.map((seg) => (
                <div key={seg.label} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="text-slate-400">{seg.short}</span>
                  <span className="text-slate-200 font-medium">{Math.round((seg.count / total) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Intent Impressions Pie Chart */}
      {intentMap.size > 0 && (() => {
        const impByIntent = { informational: 0, navigational: 0, commercial: 0, transactional: 0, none: 0 };
        for (const row of tableData) {
          const label = row.intentLabel as string | null;
          if (label && label in impByIntent) {
            impByIntent[label as keyof typeof impByIntent] += row.impressions;
          } else {
            impByIntent.none += row.impressions;
          }
        }
        const totalImp = Object.values(impByIntent).reduce((a, b) => a + b, 0);
        if (totalImp === 0) return null;

        const segments = [
          { label: "Informational", short: "I", count: impByIntent.informational, color: "#3b82f6" },
          { label: "Navigational", short: "N", count: impByIntent.navigational, color: "#a855f7" },
          { label: "Commercial", short: "C", count: impByIntent.commercial, color: "#f59e0b" },
          { label: "Transactional", short: "T", count: impByIntent.transactional, color: "#10b981" },
          { label: t.noIntent, short: "?", count: impByIntent.none, color: "#ef4444" },
        ].filter((s) => s.count > 0);

        const radius = 40;
        const circumference = 2 * Math.PI * radius;
        let offset = 0;

        return (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col items-center justify-center">
            <h3 className="text-sm font-medium text-slate-300 mb-3">{t.impressionsByIntent}</h3>
            <svg viewBox="0 0 100 100" className="w-28 h-28 mb-3">
              {segments.map((seg) => {
                const pct = seg.count / totalImp;
                const dashLength = pct * circumference;
                const dashOffset = -offset * circumference;
                offset += pct;
                return (
                  <circle
                    key={seg.label}
                    cx="50" cy="50" r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="18"
                    strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                    strokeDashoffset={dashOffset}
                    className="transition-all duration-500"
                  />
                );
              })}
              <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" className="fill-white text-[10px] font-bold">
                {totalImp.toLocaleString(intlLocale)}
              </text>
            </svg>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {segments.map((seg) => (
                <div key={seg.label} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="text-slate-400">{seg.short}</span>
                  <span className="text-slate-200 font-medium">{seg.count.toLocaleString(intlLocale)}</span>
                  <span className="text-slate-500">{Math.round((seg.count / totalImp) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Intent Clicks Pie Chart */}
      {intentMap.size > 0 && (() => {
        const clicksByIntent = { informational: 0, navigational: 0, commercial: 0, transactional: 0, none: 0 };
        for (const row of tableData) {
          const label = row.intentLabel as string | null;
          if (label && label in clicksByIntent) {
            clicksByIntent[label as keyof typeof clicksByIntent] += row.clicks;
          } else {
            clicksByIntent.none += row.clicks;
          }
        }
        const totalClicks = Object.values(clicksByIntent).reduce((a, b) => a + b, 0);
        if (totalClicks === 0) return null;

        const segments = [
          { label: "Informational", short: "I", count: clicksByIntent.informational, color: "#3b82f6" },
          { label: "Navigational", short: "N", count: clicksByIntent.navigational, color: "#a855f7" },
          { label: "Commercial", short: "C", count: clicksByIntent.commercial, color: "#f59e0b" },
          { label: "Transactional", short: "T", count: clicksByIntent.transactional, color: "#10b981" },
          { label: t.noIntent, short: "?", count: clicksByIntent.none, color: "#ef4444" },
        ].filter((s) => s.count > 0);

        const radius = 40;
        const circumference = 2 * Math.PI * radius;
        let offset = 0;

        return (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col items-center justify-center">
            <h3 className="text-sm font-medium text-slate-300 mb-3">{t.clicksByIntent}</h3>
            <svg viewBox="0 0 100 100" className="w-28 h-28 mb-3">
              {segments.map((seg) => {
                const pct = seg.count / totalClicks;
                const dashLength = pct * circumference;
                const dashOffset = -offset * circumference;
                offset += pct;
                return (
                  <circle
                    key={seg.label}
                    cx="50" cy="50" r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="18"
                    strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                    strokeDashoffset={dashOffset}
                    className="transition-all duration-500"
                  />
                );
              })}
              <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" className="fill-white text-[10px] font-bold">
                {totalClicks.toLocaleString(intlLocale)}
              </text>
            </svg>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {segments.map((seg) => (
                <div key={seg.label} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="text-slate-400">{seg.short}</span>
                  <span className="text-slate-200 font-medium">{seg.count.toLocaleString(intlLocale)}</span>
                  <span className="text-slate-500">{Math.round((seg.count / totalClicks) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex flex-col items-center justify-center">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mb-4"></div>
            <div className="text-center">
              <p className="text-lg font-medium text-white mb-2">
                {t.loadingTitle}
              </p>
              <p className="text-sm text-slate-400">
                {t.loadingHint}
              </p>
            </div>
          </div>
        ) : (
          <DataTable
            data={tableData}
            keyField="id"
            columns={[
              {
                key: "query",
                header: t.columns.query,
                sortable: true,
                render: (value) => (
                  <span className="font-medium text-white">{String(value)}</span>
                ),
              },
              {
                key: "clicks",
                header: t.columns.clicks,
                sortable: true,
                render: (value) => (
                  <span className="text-blue-400">{Number(value).toLocaleString(intlLocale)}</span>
                ),
              },
              {
                key: "impressions",
                header: t.columns.impressions,
                sortable: true,
                render: (value) => Number(value).toLocaleString(intlLocale),
              },
              {
                key: "ctr",
                header: t.columns.ctr,
                sortable: true,
                render: (value) => `${(Number(value) * 100).toFixed(2)}%`,
              },
              {
                key: "position",
                header: t.columns.position,
                sortable: true,
                render: (value) => Number(value).toFixed(1),
              },
              ...(intentMap.size > 0
                ? [
                    {
                      key: "intentLabel" as const,
                      header: t.columns.intent,
                      sortable: true,
                      render: (value: unknown) => {
                        const label = value as string | null;
                        if (!label) return (
                          <span
                            className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold border bg-red-500/10 text-red-400 border-red-500/30"
                            title={t.noIntentAvailable}
                          >
                            ?
                          </span>
                        );
                        const colors: Record<string, string> = {
                          informational: "bg-blue-500/20 text-blue-300 border-blue-500/30",
                          navigational: "bg-purple-500/20 text-purple-300 border-purple-500/30",
                          commercial: "bg-amber-500/20 text-amber-300 border-amber-500/30",
                          transactional: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                        };
                        const abbr: Record<string, string> = {
                          informational: "I",
                          navigational: "N",
                          commercial: "C",
                          transactional: "T",
                        };
                        const cls = colors[label] || "bg-slate-500/20 text-slate-300 border-slate-500/30";
                        return (
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold border ${cls}`}
                            title={label.charAt(0).toUpperCase() + label.slice(1)}
                          >
                            {abbr[label] || "?"}
                          </span>
                        );
                      },
                    },
                  ]
                : []),
              ...(trendsMap.size > 0
                ? [
                    {
                      key: "trendAvg" as const,
                      header: t.columns.trendAvg,
                      sortable: true,
                      render: (value: unknown) => {
                        const v = value as number | null;
                        if (v === null || v === undefined) return <span className="text-slate-500">–</span>;
                        const color = v >= 60 ? "text-emerald-400" : v >= 30 ? "text-yellow-400" : "text-slate-400";
                        return <span className={color}>{v}</span>;
                      },
                    },
                    {
                      key: "trendDirection" as const,
                      header: t.columns.direction,
                      sortable: true,
                      render: (value: unknown) => {
                        const dir = value as string | null;
                        if (!dir) return <span className="text-slate-500">–</span>;
                        if (dir === "up") return <span className="text-emerald-400" title={t.trendDirection.up}>↑</span>;
                        if (dir === "down") return <span className="text-red-400" title={t.trendDirection.down}>↓</span>;
                        return <span className="text-slate-400" title={t.trendDirection.stable}>→</span>;
                      },
                    },
                  ]
                : []),
            ]}
          />
        )}
      </div>
    </div>
  );
}
