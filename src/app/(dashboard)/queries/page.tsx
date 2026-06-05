"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { DataTable } from "@/components/ui/DataTable";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { useProperty } from "@/contexts/PropertyContext";

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

interface TrendJob {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  totalKeywords: number;
  processedKeywords: number;
  createdAt: string;
}

export default function QueriesPage() {
  const { selectedProperty } = useProperty();
  const [period, setPeriod] = useState("28d");
  const [data, setData] = useState<QueryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [brandFilter, setBrandFilter] = useState("ubs");
  const [excludeBrand, setExcludeBrand] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [trendsMap, setTrendsMap] = useState<Map<string, TrendData>>(new Map());
  const [trendJob, setTrendJob] = useState<TrendJob | null>(null);
  const [isStartingJob, setIsStartingJob] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    }
  }, [selectedProperty, data.length, checkJobStatus]);

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

  const tableData = useMemo(() => {
    const brandTerms = brandFilter
      .toLowerCase()
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const searchLower = searchQuery.toLowerCase().trim();

    return data
      .filter((row) => {
        const queryLower = row.keys[0].toLowerCase();
        if (searchLower && !queryLower.includes(searchLower)) return false;
        if (excludeBrand && brandTerms.length > 0) {
          if (brandTerms.some((term) => queryLower.includes(term))) return false;
        }
        return true;
      })
      .map((row, index) => {
        const trend = trendsMap.get(row.keys[0].toLowerCase());
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
        };
      });
  }, [data, excludeBrand, brandFilter, searchQuery, trendsMap]);

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
        alert(result.error || "Fehler beim Starten des Jobs");
      }
    } catch (error) {
      console.error("Error starting trend job:", error);
      alert("Fehler beim Starten des Google Trends Jobs");
    } finally {
      setIsStartingJob(false);
    }
  }, [selectedProperty, data]);

  const exportToXlsx = useCallback(() => {
    if (tableData.length === 0) return;

    const hasTrends = trendsMap.size > 0;
    const rows = tableData.map((r) => {
      const base: Record<string, unknown> = {
        Suchanfrage: r.query,
        Klicks: r.clicks,
        Impressionen: r.impressions,
        "CTR (%)": Math.round(r.ctr * 10000) / 100,
        Position: Math.round(r.position * 10) / 10,
      };
      if (hasTrends) {
        base["Trend Ø"] = r.trendAvg ?? "";
        base["Trend aktuell"] = r.trendRecent ?? "";
        base["Trend Richtung"] =
          r.trendDirection === "up" ? "↑" :
          r.trendDirection === "down" ? "↓" :
          r.trendDirection === "stable" ? "→" : "";
      }
      return base;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Suchanfragen");

    const host = (() => {
      try {
        return new URL(selectedProperty || "").hostname.replace(/[^a-zA-Z0-9._-]/g, "_") || "property";
      } catch {
        return "property";
      }
    })();
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `gsc-suchanfragen_${host}_${period}_${stamp}.xlsx`);
  }, [tableData, selectedProperty, period, trendsMap]);

  const jobIsActive = trendJob?.status === "pending" || trendJob?.status === "processing";
  const jobProgress = jobIsActive && trendJob
    ? Math.round((trendJob.processedKeywords / trendJob.totalKeywords) * 100)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Suchanfragen</h1>
        <div className="flex flex-wrap items-center gap-4">
          <PeriodSelector value={period} onChange={setPeriod} />
          <button
            type="button"
            onClick={startTrendJob}
            disabled={isLoading || isStartingJob || jobIsActive || data.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-emerald-600 bg-emerald-700 text-emerald-100 hover:bg-emerald-600 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            title="Google Trends Daten fuer alle Keywords im Hintergrund laden (Schweiz/Deutsch). Du erhaeltst eine E-Mail wenn fertig."
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
            onClick={exportToXlsx}
            disabled={isLoading || tableData.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            title="Aktuelle Tabelle (inkl. Filter) als Excel-Datei speichern"
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
                Google Trends werden geladen...
              </span>
            </div>
            <span className="text-sm text-emerald-300">
              {trendJob.processedKeywords.toLocaleString("de-DE")} / {trendJob.totalKeywords.toLocaleString("de-DE")} Keywords ({jobProgress}%)
            </span>
          </div>
          <div className="w-full bg-emerald-950 rounded-full h-2">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${jobProgress}%` }}
            />
          </div>
          <p className="text-xs text-emerald-400 mt-2">
            Laeuft im Hintergrund — du erhaeltst eine E-Mail wenn fertig. Du kannst die Seite verlassen.
          </p>
        </div>
      )}

      {trendJob?.status === "completed" && trendsMap.size > 0 && (
        <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-emerald-300">
            Google Trends geladen: {trendsMap.size.toLocaleString("de-DE")} Keywords mit Trend-Daten
          </span>
          <button
            onClick={startTrendJob}
            disabled={isLoading || isStartingJob || data.length === 0}
            className="text-xs text-emerald-400 hover:text-emerald-200 underline disabled:opacity-50"
          >
            Neu laden
          </button>
        </div>
      )}

      {/* Search and Filters */}
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
            placeholder="Keywords durchsuchen..."
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
            <span className="text-sm text-slate-300">Brand ausschließen:</span>
          </label>
          <input
            type="text"
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            placeholder="z.B. ubs, bank"
            disabled={!excludeBrand}
            className="flex-1 min-w-[200px] max-w-[400px] px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <span className="text-sm text-slate-400">
            {tableData.length} von {data.length} Suchanfragen
          </span>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex flex-col items-center justify-center">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mb-4"></div>
            <div className="text-center">
              <p className="text-lg font-medium text-white mb-2">
                Hole Live-Daten aus der GSC...
              </p>
              <p className="text-sm text-slate-400">
                Das kann einige Sekunden dauern!
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
                header: "Suchanfrage",
                sortable: true,
                render: (value) => (
                  <span className="font-medium text-white">{String(value)}</span>
                ),
              },
              {
                key: "clicks",
                header: "Klicks",
                sortable: true,
                render: (value) => (
                  <span className="text-blue-400">{Number(value).toLocaleString("de-DE")}</span>
                ),
              },
              {
                key: "impressions",
                header: "Impressionen",
                sortable: true,
                render: (value) => Number(value).toLocaleString("de-DE"),
              },
              {
                key: "ctr",
                header: "CTR",
                sortable: true,
                render: (value) => `${(Number(value) * 100).toFixed(2)}%`,
              },
              {
                key: "position",
                header: "Position",
                sortable: true,
                render: (value) => Number(value).toFixed(1),
              },
              ...(trendsMap.size > 0
                ? [
                    {
                      key: "trendAvg" as const,
                      header: "Trend Ø",
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
                      header: "Richtung",
                      sortable: true,
                      render: (value: unknown) => {
                        const dir = value as string | null;
                        if (!dir) return <span className="text-slate-500">–</span>;
                        if (dir === "up") return <span className="text-emerald-400" title="steigend">↑</span>;
                        if (dir === "down") return <span className="text-red-400" title="fallend">↓</span>;
                        return <span className="text-slate-400" title="stabil">→</span>;
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
