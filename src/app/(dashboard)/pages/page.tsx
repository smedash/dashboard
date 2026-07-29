"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { downloadExcel } from "@/lib/excel-export";
import { DataTable } from "@/components/ui/DataTable";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { useProperty } from "@/contexts/PropertyContext";
import Link from "next/link";

interface PageRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface KVPUrl {
  id: string;
  url: string;
  focusKeyword: string;
}

interface ConductorPageInfo {
  url: string;
  health: number | null;
  statusCode: number | null;
  type: string | null;
  isIndexable: boolean;
  isInSitemap: boolean;
  isDisallowedInRobotsTxt: boolean;
  isLinked: boolean;
  lighthousePerformance: { value: number; range: string } | null;
  lighthouseLcp: { value: number; range: string } | null;
  lighthouseCls: { value: number; range: string } | null;
  relevance: number | null;
  incomingInternalLinks: number;
  timeDocumentDownload: number | null;
  dataCapturedAt: string | null;
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "").replace(/^https?:\/\/www\./, "https://");
}

function buildNormalizedMap(
  map: Record<string, ConductorPageInfo>
): Map<string, ConductorPageInfo> {
  const normalized = new Map<string, ConductorPageInfo>();
  for (const [url, info] of Object.entries(map)) {
    normalized.set(normalizeUrl(url), info);
  }
  return normalized;
}

function lookupConductor(
  gscUrl: string,
  map: Record<string, ConductorPageInfo>,
  normalizedMap?: Map<string, ConductorPageInfo>
): ConductorPageInfo | null {
  if (map[gscUrl]) return map[gscUrl];
  const nm = normalizedMap || buildNormalizedMap(map);
  return nm.get(normalizeUrl(gscUrl)) || null;
}

export default function PagesPage() {
  const { selectedProperty } = useProperty();
  const [period, setPeriod] = useState("28d");
  const [data, setData] = useState<PageRow[]>([]);
  const [kvpUrls, setKvpUrls] = useState<KVPUrl[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [kvpFilter, setKvpFilter] = useState<"all" | "with" | "without">("all");
  const [conductorPages, setConductorPages] = useState<Record<string, ConductorPageInfo>>({});
  const [conductorLastSync, setConductorLastSync] = useState<string | null>(null);

  // Lade Conductor Monitoring Daten
  useEffect(() => {
    async function fetchConductorData() {
      try {
        const response = await fetch("/api/conductor-monitoring/pages-enrichment");
        const result = await response.json();
        setConductorPages(result.pages || {});
        setConductorLastSync(result.lastSyncAt || null);
      } catch (error) {
        console.error("Error fetching Conductor data:", error);
      }
    }
    fetchConductorData();
  }, []);

  // Lade KVP-URLs einmalig
  useEffect(() => {
    async function fetchKvpUrls() {
      try {
        const response = await fetch("/api/kvp");
        const result = await response.json();
        setKvpUrls(result.urls || []);
      } catch (error) {
        console.error("Error fetching KVP URLs:", error);
      }
    }
    fetchKvpUrls();
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!selectedProperty) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/gsc/pages?siteUrl=${encodeURIComponent(selectedProperty)}&period=${period}&limit=25000`
        );
        const result = await response.json();
        setData(result.data || []);
      } catch (error) {
        console.error("Error fetching pages:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [selectedProperty, period]);

  // Erstelle ein Set mit allen KVP-URLs für schnellen Lookup
  const kvpUrlSet = useMemo(() => {
    return new Set(kvpUrls.map((kvp) => kvp.url));
  }, [kvpUrls]);

  const conductorNormMap = useMemo(
    () => buildNormalizedMap(conductorPages),
    [conductorPages]
  );

  const tableData = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();

    return data
      .filter((row) => {
        // Textsuche
        if (searchLower && !row.keys[0].toLowerCase().includes(searchLower)) {
          return false;
        }
        // KVP Filter
        const hasKvp = kvpUrlSet.has(row.keys[0]);
        if (kvpFilter === "with" && !hasKvp) return false;
        if (kvpFilter === "without" && hasKvp) return false;
        return true;
      })
      .map((row, index) => {
        const cm = lookupConductor(row.keys[0], conductorPages, conductorNormMap);
        return {
          id: index,
          page: row.keys[0],
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
          hasKvp: kvpUrlSet.has(row.keys[0]),
          cmHealth: cm?.health ?? null,
          cmIndexable: cm?.isIndexable ?? null,
          cmInSitemap: cm?.isInSitemap ?? null,
          cmStatusCode: cm?.statusCode ?? null,
          cmLighthousePerf: cm?.lighthousePerformance ?? null,
          cmLighthouseLcp: cm?.lighthouseLcp ?? null,
        };
      });
  }, [data, searchQuery, kvpUrlSet, kvpFilter, conductorPages, conductorNormMap]);

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search;
    } catch {
      return url;
    }
  };

  const exportToXlsx = useCallback(() => {
    if (tableData.length === 0) return;

    const rows = tableData.map((r) => ({
      Seite: r.page,
      KVP: r.hasKvp ? "Ja" : "Nein",
      Klicks: r.clicks,
      Impressionen: r.impressions,
      "CTR (%)": Math.round(r.ctr * 10000) / 100,
      Position: Math.round(r.position * 10) / 10,
      "Health Score": r.cmHealth ?? "",
      Indexierbar: r.cmIndexable === null ? "" : r.cmIndexable ? "Ja" : "Nein",
      "In Sitemap": r.cmInSitemap === null ? "" : r.cmInSitemap ? "Ja" : "Nein",
      "Status Code": r.cmStatusCode ?? "",
      "Performance": r.cmLighthousePerf
        ? (r.cmLighthousePerf as { value: number }).value
        : "",
    }));

    const host = (() => {
      try {
        return new URL(selectedProperty || "").hostname.replace(/[^a-zA-Z0-9._-]/g, "_") || "property";
      } catch {
        return "property";
      }
    })();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadExcel(`gsc-seiten_${host}_${period}_${stamp}.xlsx`, [
      { name: "Seiten", rows },
    ]);
  }, [tableData, selectedProperty, period]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Seiten</h1>
        <div className="flex flex-wrap items-center gap-4">
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      {/* Search und Filter */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[300px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="URLs durchsuchen..."
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          {/* KVP Filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => setKvpFilter("all")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                kvpFilter === "all"
                  ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Alle
            </button>
            <button
              onClick={() => setKvpFilter("with")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                kvpFilter === "with"
                  ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Mit KVP
            </button>
            <button
              onClick={() => setKvpFilter("without")}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                kvpFilter === "without"
                  ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Ohne KVP
            </button>
          </div>

          <span className="text-sm text-slate-600 dark:text-slate-400">
            {tableData.length} von {data.length} Seiten
          </span>

          {conductorLastSync && (
            <span className="text-xs text-slate-500 dark:text-slate-500" title="Letzter Conductor Monitoring Sync">
              CM: {new Date(conductorLastSync).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}

          <button
            type="button"
            onClick={exportToXlsx}
            disabled={isLoading || tableData.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            title="Aktuelle Tabelle (inkl. Filter) als Excel-Datei speichern"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Excel (.xlsx)
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex flex-col items-center justify-center">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mb-4"></div>
            <div className="text-center">
              <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                Hole Live-Daten aus der GSC...
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
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
                key: "page",
                header: "Seite",
                sortable: true,
                render: (value) => (
                  <a
                    href={String(value)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate max-w-[400px] block"
                    title={String(value)}
                  >
                    {formatUrl(String(value))}
                  </a>
                ),
              },
              {
                key: "hasKvp",
                header: "KVP",
                sortable: true,
                render: (value, row) => (
                  value ? (
                    <Link
                      href={`/ubs-kvp?search=${encodeURIComponent(String(row.page))}`}
                      className="inline-flex items-center justify-center w-6 h-6 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                      title="KVP vorhanden - klicken zum Anzeigen"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </Link>
                  ) : (
                    <Link
                      href={`/ubs-kvp`}
                      className="inline-flex items-center justify-center w-6 h-6 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                      title="Kein KVP vorhanden - klicken zum Erstellen"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </Link>
                  )
                ),
              },
              {
                key: "clicks",
                header: "Klicks",
                sortable: true,
                render: (value) => (
                  <span className="text-blue-600 dark:text-blue-400">{Number(value).toLocaleString("de-DE")}</span>
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
              {
                key: "cmHealth",
                header: "Health",
                sortable: true,
                render: (value) => {
                  if (value === null || value === undefined) return <span className="text-slate-400">–</span>;
                  const score = Number(value);
                  const color =
                    score >= 800
                      ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
                      : score >= 500
                        ? "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20"
                        : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20";
                  return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
                      {score}
                    </span>
                  );
                },
              },
              {
                key: "cmIndexable",
                header: "Index",
                sortable: true,
                render: (value) => {
                  if (value === null || value === undefined) return <span className="text-slate-400">–</span>;
                  return value ? (
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full" title="Indexierbar">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400 rounded-full" title="Nicht indexierbar">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </span>
                  );
                },
              },
              {
                key: "cmInSitemap",
                header: "Sitemap",
                sortable: true,
                render: (value) => {
                  if (value === null || value === undefined) return <span className="text-slate-400">–</span>;
                  return value ? (
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full" title="In Sitemap">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 rounded-full" title="Nicht in Sitemap">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </span>
                  );
                },
              },
              {
                key: "cmStatusCode",
                header: "Status",
                sortable: true,
                render: (value) => {
                  if (value === null || value === undefined) return <span className="text-slate-400">–</span>;
                  const code = Number(value);
                  const color =
                    code >= 200 && code < 300
                      ? "text-green-600 dark:text-green-400"
                      : code >= 300 && code < 400
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400";
                  return <span className={`font-mono text-xs font-semibold ${color}`}>{code}</span>;
                },
              },
              {
                key: "cmLighthousePerf",
                header: "Perf.",
                sortable: true,
                render: (value) => {
                  if (!value || value === null) return <span className="text-slate-400">–</span>;
                  const perf = value as { value: number; range: string };
                  const color =
                    perf.range === "good"
                      ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20"
                      : perf.range === "needsImprovement"
                        ? "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20"
                        : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20";
                  return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
                      {perf.value}
                    </span>
                  );
                },
              },
              {
                key: "cmLighthouseLcp",
                header: "LCP",
                sortable: true,
                render: (value) => {
                  if (!value || value === null) return <span className="text-slate-400">–</span>;
                  const lcp = value as { value: number; range: string };
                  const color =
                    lcp.range === "good"
                      ? "text-green-600 dark:text-green-400"
                      : lcp.range === "needsImprovement"
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400";
                  const seconds = (lcp.value / 1000).toFixed(1);
                  return <span className={`text-xs font-semibold ${color}`}>{seconds}s</span>;
                },
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}

