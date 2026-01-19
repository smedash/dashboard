"use client";

import { useState, useEffect, useMemo } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { BarChart, LineChart, PieChart } from "@/components/charts";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { useProperty } from "@/contexts/PropertyContext";

interface GSCRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface GSCData {
  dimension: string;
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

type ReportType = "standard" | "vergleich" | "keywords" | "verzeichnisse";

export default function ReportingPage() {
  const { selectedProperty } = useProperty();
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState("28d");
  const [reportType, setReportType] = useState<ReportType>("standard");
  const [currentData, setCurrentData] = useState<GSCData[]>([]);
  const [previousData, setPreviousData] = useState<GSCData[]>([]);
  const [currentStats, setCurrentStats] = useState<{
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  } | null>(null);
  const [previousStats, setPreviousStats] = useState<{
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [needsGoogleConnection, setNeedsGoogleConnection] = useState(false);
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [previousDateRange, setPreviousDateRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isGeneratingAiReport, setIsGeneratingAiReport] = useState(false);
  const [aiReportError, setAiReportError] = useState<string | null>(null);

  // Set mounted to true after component mounts to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch GSC data
  useEffect(() => {
    async function fetchData() {
      if (!selectedProperty) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setNeedsGoogleConnection(false);

      try {
        // Fetch stats for current period
        const statsRes = await fetch(
          `/api/gsc/stats?siteUrl=${encodeURIComponent(selectedProperty)}&period=${period}&dimension=date`
        );

        if (!statsRes.ok) {
          const errorData = await statsRes.json();
          if (errorData.needsConnection || statsRes.status === 403) {
            setNeedsGoogleConnection(true);
            setIsLoading(false);
            return;
          }
          throw new Error(errorData.error || "Failed to fetch stats");
        }

        const statsData = await statsRes.json();
        setCurrentStats(statsData.current);
        setPreviousStats(statsData.previous);
        setDateRange(statsData.period);
        setPreviousDateRange(statsData.previousPeriod);

        // Fetch detailed data based on report type
        if (reportType === "standard") {
          // Fetch queries, pages, and devices for standard report
          const [queriesRes, pagesRes, devicesRes] = await Promise.all([
            fetch(`/api/gsc/queries?siteUrl=${encodeURIComponent(selectedProperty)}&period=${period}&limit=10000`),
            fetch(`/api/gsc/pages?siteUrl=${encodeURIComponent(selectedProperty)}&period=${period}&limit=10000`),
            fetch(`/api/gsc/devices?siteUrl=${encodeURIComponent(selectedProperty)}&period=${period}`),
          ]);

          const queriesData = await queriesRes.json();
          const pagesData = await pagesRes.json();
          const devicesData = await devicesRes.json();

          const combinedData: GSCData[] = [
            ...(queriesData.data || []).map((row: GSCRow) => ({
              dimension: "query",
              key: row.keys[0] || "",
              clicks: row.clicks,
              impressions: row.impressions,
              ctr: row.ctr,
              position: row.position,
            })),
            ...(pagesData.data || []).map((row: GSCRow) => ({
              dimension: "page",
              key: row.keys[0] || "",
              clicks: row.clicks,
              impressions: row.impressions,
              ctr: row.ctr,
              position: row.position,
            })),
            ...(devicesData.data || []).map((row: GSCRow) => ({
              dimension: "device",
              key: row.keys[0] || "",
              clicks: row.clicks,
              impressions: row.impressions,
              ctr: row.ctr,
              position: row.position,
            })),
          ];

          setCurrentData(combinedData);
          setPreviousData([]);
        } else {
          // For comparison reports, fetch current and previous period data
          const [currentQueriesRes, currentPagesRes, currentQueryPageRes] = await Promise.all([
            fetch(`/api/gsc/queries?siteUrl=${encodeURIComponent(selectedProperty)}&period=${period}&limit=10000`),
            fetch(`/api/gsc/pages?siteUrl=${encodeURIComponent(selectedProperty)}&period=${period}&limit=10000`),
            fetch(`/api/gsc/query-page?siteUrl=${encodeURIComponent(selectedProperty)}&period=${period}&limit=10000`),
          ]);

          const currentQueries = await currentQueriesRes.json();
          const currentPages = await currentPagesRes.json();
          const currentQueryPage = await currentQueryPageRes.json();

          const currentCombined: GSCData[] = [
            ...(currentQueries.data || []).map((row: GSCRow) => ({
              dimension: "query",
              key: row.keys[0] || "",
              clicks: row.clicks,
              impressions: row.impressions,
              ctr: row.ctr,
              position: row.position,
            })),
            ...(currentPages.data || []).map((row: GSCRow) => ({
              dimension: "page",
              key: row.keys[0] || "",
              clicks: row.clicks,
              impressions: row.impressions,
              ctr: row.ctr,
              position: row.position,
            })),
            ...(currentQueryPage.data || []).map((row: GSCRow) => ({
              dimension: "query_page",
              key: `${row.keys[0] || ""}|${row.keys[1] || ""}`,
              clicks: row.clicks,
              impressions: row.impressions,
              ctr: row.ctr,
              position: row.position,
            })),
          ];

          setCurrentData(currentCombined);

          // Fetch previous period data if available
          if (statsData.previousPeriod) {
            const prevStartStr = statsData.previousPeriod.startDate;
            const prevEndStr = statsData.previousPeriod.endDate;

            const [prevQueriesRes, prevPagesRes, prevQueryPageRes] = await Promise.all([
              fetch(`/api/gsc/queries?siteUrl=${encodeURIComponent(selectedProperty)}&startDate=${prevStartStr}&endDate=${prevEndStr}&limit=10000`).catch(() => ({ json: () => ({ data: [] }) })),
              fetch(`/api/gsc/pages?siteUrl=${encodeURIComponent(selectedProperty)}&startDate=${prevStartStr}&endDate=${prevEndStr}&limit=10000`).catch(() => ({ json: () => ({ data: [] }) })),
              fetch(`/api/gsc/query-page?siteUrl=${encodeURIComponent(selectedProperty)}&startDate=${prevStartStr}&endDate=${prevEndStr}&limit=10000`).catch(() => ({ json: () => ({ data: [] }) })),
            ]);

            const prevQueries = await prevQueriesRes.json();
            const prevPages = await prevPagesRes.json();
            const prevQueryPage = await prevQueryPageRes.json();

            const previousCombined: GSCData[] = [
              ...(prevQueries.data || []).map((row: GSCRow) => ({
                dimension: "query",
                key: row.keys[0] || "",
                clicks: row.clicks,
                impressions: row.impressions,
                ctr: row.ctr,
                position: row.position,
              })),
              ...(prevPages.data || []).map((row: GSCRow) => ({
                dimension: "page",
                key: row.keys[0] || "",
                clicks: row.clicks,
                impressions: row.impressions,
                ctr: row.ctr,
                position: row.position,
              })),
              ...(prevQueryPage.data || []).map((row: GSCRow) => ({
                dimension: "query_page",
                key: `${row.keys[0] || ""}|${row.keys[1] || ""}`,
                clicks: row.clicks,
                impressions: row.impressions,
                ctr: row.ctr,
                position: row.position,
              })),
            ];

            setPreviousData(previousCombined);
          } else {
            setPreviousData([]);
          }
        }
      } catch (error) {
        console.error("Error fetching reporting data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [selectedProperty, period, reportType]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Generate Executive Summary
  const executiveSummary = useMemo(() => {
    if (reportType === "standard" && currentStats) {
      const totalClicks = currentStats.clicks;
      const totalImpressions = currentStats.impressions;
      const avgCTR = currentStats.ctr;
      const avgPosition = currentStats.position;

      // Get top keywords
      const topKeywords = currentData
        .filter((d) => d.dimension === "query")
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5)
        .map((d) => d.key);

      // Get top pages
      const topPages = currentData
        .filter((d) => d.dimension === "page")
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5)
        .map((d) => d.key);

      const dateRangeStr = dateRange
        ? `${formatDate(dateRange.startDate)} bis ${formatDate(dateRange.endDate)}`
        : "dem ausgewählten Zeitraum";

      return `Im Zeitraum ${dateRangeStr} verzeichnete die Website ${totalClicks.toLocaleString("de-DE")} Klicks aus ${totalImpressions.toLocaleString("de-DE")} Impressionen. Die durchschnittliche Click-Through-Rate (CTR) lag bei ${(avgCTR * 100).toFixed(2)}%, während die durchschnittliche Position bei ${avgPosition.toFixed(1)} lag.

Die wichtigsten Keywords waren: ${topKeywords.join(", ")}. Die Top-Performer-Seiten umfassen ${topPages.length} Seiten, die zusammen einen erheblichen Anteil des organischen Traffics generieren.

Die Performance zeigt ${avgCTR >= 0.05 ? "eine gute" : avgCTR >= 0.03 ? "eine durchschnittliche" : "eine verbesserungswürdige"} CTR, was auf ${avgPosition <= 5 ? "starke Rankings" : avgPosition <= 10 ? "solide Rankings" : "Potenzial für Verbesserungen"} hindeutet.`;
    }

    if (reportType === "vergleich" && currentStats && previousStats && dateRange && previousDateRange) {
      const clicksDiff = currentStats.clicks - previousStats.clicks;
      const clicksPercent = previousStats.clicks > 0
        ? ((currentStats.clicks - previousStats.clicks) / previousStats.clicks) * 100
        : 0;
      const impressionsDiff = currentStats.impressions - previousStats.impressions;
      const positionDiff = currentStats.position - previousStats.position;

      return `Vergleich zwischen ${formatDate(previousDateRange.startDate)} - ${formatDate(previousDateRange.endDate)} (Vorperiode) und ${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)} (Aktuell):

Die Klicks ${clicksDiff >= 0 ? "stiegen" : "sanken"} um ${Math.abs(clicksDiff).toLocaleString("de-DE")} (${clicksPercent >= 0 ? "+" : ""}${clicksPercent.toFixed(1)}%), während die Impressionen ${impressionsDiff >= 0 ? "anstiegen" : "zurückgingen"} um ${Math.abs(impressionsDiff).toLocaleString("de-DE")}.

Die durchschnittliche Position ${positionDiff <= 0 ? "verbesserte sich" : "verschlechterte sich"} um ${Math.abs(positionDiff).toFixed(1)} Positionen. ${positionDiff <= 0 ? "Dies deutet auf erfolgreiche SEO-Maßnahmen hin." : "Hier besteht Handlungsbedarf zur Verbesserung der Rankings."}`;
    }

    if (reportType === "keywords" && currentData.length > 0 && previousData.length > 0) {
      const keywords1 = new Set(currentData.filter((d) => d.dimension === "query").map((d) => d.key));
      const keywords2 = new Set(previousData.filter((d) => d.dimension === "query").map((d) => d.key));
      const common = new Set([...keywords1].filter((k) => keywords2.has(k)));
      const only1 = new Set([...keywords1].filter((k) => !keywords2.has(k)));
      const only2 = new Set([...keywords2].filter((k) => !keywords1.has(k)));

      // Calculate total clicks for common keywords
      const commonKeywordsData = currentData
        .filter((d) => d.dimension === "query" && keywords2.has(d.key))
        .reduce((sum, d) => sum + d.clicks, 0);
      const commonKeywordsData2 = previousData
        .filter((d) => d.dimension === "query" && keywords1.has(d.key))
        .reduce((sum, d) => sum + d.clicks, 0);

      return `Keyword-Vergleich zwischen Vorperiode und aktuellem Zeitraum:

Es wurden ${common.size} gemeinsame Keywords identifiziert, die in beiden Zeiträumen ranken. Diese generierten in der Vorperiode ${commonKeywordsData2.toLocaleString("de-DE")} Klicks und im aktuellen Zeitraum ${commonKeywordsData.toLocaleString("de-DE")} Klicks.

${only1.size} Keywords sind nur im aktuellen Zeitraum vorhanden, während ${only2.size} Keywords nur in der Vorperiode auftauchen. Die gemeinsamen Keywords zeigen die Kernkompetenzen der Website, während die Unterschiede auf Veränderungen in der Keyword-Strategie oder Marktentwicklung hindeuten.

${commonKeywordsData > commonKeywordsData2 ? "Die gemeinsamen Keywords zeigen eine positive Entwicklung mit steigenden Klicks." : commonKeywordsData < commonKeywordsData2 ? "Die gemeinsamen Keywords zeigen einen Rückgang der Performance." : "Die Performance der gemeinsamen Keywords blieb stabil."}`;
    }

    if (reportType === "verzeichnisse" && currentData.length > 0 && previousData.length > 0) {
      // Extract directories and calculate similarity
      const extractDir = (url: string, depth: number) => {
        try {
          const urlObj = new URL(url);
          const pathParts = urlObj.pathname.split("/").filter(Boolean);
          return "/" + pathParts.slice(0, depth).join("/");
        } catch {
          return "/";
        }
      };

      // Calculate directory stats with keywords
      const calculateDirStats = (data: GSCData[], depth: number) => {
        const pageData = data.filter((d) => d.dimension === "page");
        const queryPageData = data.filter((d) => d.dimension === "query_page");
        const dirMap = new Map<string, { clicks: number; keywords: Set<string> }>();

        pageData.forEach((page) => {
          const dirPath = extractDir(page.key, depth);
          if (!dirMap.has(dirPath)) {
            dirMap.set(dirPath, { clicks: 0, keywords: new Set() });
          }
          const dir = dirMap.get(dirPath)!;
          dir.clicks += page.clicks;
        });

        queryPageData.forEach((qp) => {
          const parts = qp.key.split("|");
          if (parts.length > 1) {
            const pageUrl = parts[1];
            const dirPath = extractDir(pageUrl, depth);
            if (dirMap.has(dirPath)) {
              const dir = dirMap.get(dirPath)!;
              dir.keywords.add(parts[0]);
            }
          }
        });

        return dirMap;
      };

      const dirs1 = calculateDirStats(currentData, 3);
      const dirs2 = calculateDirStats(previousData, 3);

      // Calculate similarity matches
      let matchCount = 0;
      let totalClicks1 = 0;
      let totalClicks2 = 0;

      dirs1.forEach((dir1, path1) => {
        dirs2.forEach((dir2, path2) => {
          const intersection = new Set([...dir1.keywords].filter((k) => dir2.keywords.has(k)));
          const union = new Set([...dir1.keywords, ...dir2.keywords]);
          const similarity = union.size > 0 ? intersection.size / union.size : 0;
          if (similarity >= 0.3) {
            matchCount++;
            totalClicks1 += dir1.clicks;
            totalClicks2 += dir2.clicks;
          }
        });
      });

      return `Verzeichnis-Vergleich zwischen Vorperiode und aktuellem Zeitraum:

Es wurden ${matchCount} ähnliche Verzeichnisse identifiziert, die auf gemeinsamen Keywords basieren (Ähnlichkeit ≥ 30%). Diese Verzeichnisse generierten in der Vorperiode ${totalClicks2.toLocaleString("de-DE")} Klicks und im aktuellen Zeitraum ${totalClicks1.toLocaleString("de-DE")} Klicks.

Die Verzeichnisse zeigen strukturelle Ähnlichkeiten zwischen den beiden Zeiträumen und ermöglichen einen direkten Vergleich der Performance. ${totalClicks1 > totalClicks2 ? "Die Performance der ähnlichen Verzeichnisse hat sich verbessert." : totalClicks1 < totalClicks2 ? "Die Performance der ähnlichen Verzeichnisse ist zurückgegangen." : "Die Performance der ähnlichen Verzeichnisse blieb stabil."}`;
    }

    return "Bitte wähle einen Report-Typ aus und stelle sicher, dass eine Property ausgewählt ist.";
  }, [reportType, currentStats, previousStats, currentData, previousData, dateRange, previousDateRange]);

  // Chart data for standard report
  const chartData = useMemo(() => {
    if (reportType === "standard" && currentData.length > 0) {
      const topKeywords = currentData
        .filter((d) => d.dimension === "query")
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10)
        .map((d) => ({
          keyword: d.key.length > 30 ? d.key.substring(0, 30) + "..." : d.key,
          clicks: d.clicks,
        }));

      const topPages = currentData
        .filter((d) => d.dimension === "page")
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10)
        .map((d) => {
          try {
            const url = new URL(d.key);
            return {
              page: url.pathname.length > 30 ? url.pathname.substring(0, 30) + "..." : url.pathname,
              clicks: d.clicks,
            };
          } catch {
            return { page: d.key, clicks: d.clicks };
          }
        });

      return { topKeywords, topPages };
    }

    if (reportType === "vergleich" && currentStats && previousStats) {
      return {
        comparison: [
          {
            name: "Vorperiode",
            clicks: previousStats.clicks,
            impressions: previousStats.impressions,
            ctr: previousStats.ctr * 100,
            position: previousStats.position,
          },
          {
            name: "Aktuell",
            clicks: currentStats.clicks,
            impressions: currentStats.impressions,
            ctr: currentStats.ctr * 100,
            position: currentStats.position,
          },
        ],
      };
    }

    if (reportType === "keywords" && currentData.length > 0 && previousData.length > 0) {
      const keywords1Map = new Map<string, GSCData>();
      currentData.filter((d) => d.dimension === "query").forEach((d) => keywords1Map.set(d.key, d));
      const keywords2Map = new Map<string, GSCData>();
      previousData.filter((d) => d.dimension === "query").forEach((d) => keywords2Map.set(d.key, d));

      const allKeywords = new Set([...keywords1Map.keys(), ...keywords2Map.keys()]);
      const commonKeywords = Array.from(allKeywords)
        .filter((k) => keywords1Map.has(k) && keywords2Map.has(k))
        .map((k) => {
          const kw1 = keywords1Map.get(k)!;
          const kw2 = keywords2Map.get(k)!;
          return {
            keyword: k.length > 30 ? k.substring(0, 30) + "..." : k,
            clicks1: kw1.clicks,
            clicks2: kw2.clicks,
            clicksDiff: kw1.clicks - kw2.clicks,
          };
        })
        .sort((a, b) => Math.abs(b.clicksDiff) - Math.abs(a.clicksDiff))
        .slice(0, 10);

      return { commonKeywords };
    }

    if (reportType === "verzeichnisse" && currentData.length > 0 && previousData.length > 0) {
      const extractDir = (url: string, depth: number) => {
        try {
          const urlObj = new URL(url);
          const pathParts = urlObj.pathname.split("/").filter(Boolean);
          return "/" + pathParts.slice(0, depth).join("/");
        } catch {
          return "/";
        }
      };

      // Simplified directory comparison for chart
      const dirs1 = new Map<string, number>();
      currentData
        .filter((d) => d.dimension === "page")
        .forEach((d) => {
          const dir = extractDir(d.key, 3);
          dirs1.set(dir, (dirs1.get(dir) || 0) + d.clicks);
        });

      const dirs2 = new Map<string, number>();
      previousData
        .filter((d) => d.dimension === "page")
        .forEach((d) => {
          const dir = extractDir(d.key, 3);
          dirs2.set(dir, (dirs2.get(dir) || 0) + d.clicks);
        });

      const topDirs = Array.from(dirs1.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([dir, clicks1]) => ({
          directory: dir.length > 30 ? dir.substring(0, 30) + "..." : dir,
          clicks1,
          clicks2: dirs2.get(dir) || 0,
        }));

      return { topDirs };
    }

    return null;
  }, [reportType, currentData, previousData, currentStats, previousStats]);

  // Wait for mount to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (needsGoogleConnection) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center">
        <p className="text-red-400 mb-4">
          Bitte verbinde zuerst dein Google-Konto, um Reporting-Daten abzurufen.
        </p>
        <a
          href="/settings"
          className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Zu den Einstellungen
        </a>
      </div>
    );
  }

  if (!selectedProperty) {
    return (
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center">
        <p className="text-slate-400">
          Bitte wähle eine Property aus, um Reporting-Daten anzuzeigen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Reporting</h1>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Report Configuration */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Report konfigurieren</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Report-Typ</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="standard">Standard Report</option>
              <option value="vergleich">Vergleichs-Report</option>
              <option value="keywords">Keywords-Vergleich</option>
              <option value="verzeichnisse">Verzeichnisse-Vergleich</option>
            </select>
          </div>
        </div>
      </div>

      {/* KI-Report Section */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">KI-generierter SEO-Report</h2>
            <p className="text-sm text-slate-400">
              Generiere einen umfassenden SEO-Report mit KI-Analyse basierend auf GSC-Daten, Rankings und KVPs
            </p>
          </div>
          <button
            onClick={async () => {
              if (!selectedProperty) return;
              setIsGeneratingAiReport(true);
              setAiReportError(null);
              setAiReport(null);

              try {
                const response = await fetch("/api/reporting/ai-report", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    siteUrl: selectedProperty,
                    period: period,
                  }),
                });

                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.error || "Fehler beim Generieren des Reports");
                }

                const data = await response.json();
                setAiReport(data.report);
              } catch (error) {
                console.error("Error generating AI report:", error);
                setAiReportError(error instanceof Error ? error.message : "Unbekannter Fehler");
              } finally {
                setIsGeneratingAiReport(false);
              }
            }}
            disabled={isGeneratingAiReport || !selectedProperty}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-medium rounded-lg transition-all disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isGeneratingAiReport ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Generiere Report...</span>
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <span>KI-Report generieren</span>
              </>
            )}
          </button>
        </div>

        {aiReportError && (
          <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <p className="text-red-400 text-sm">{aiReportError}</p>
          </div>
        )}

        {aiReport && (
          <div className="mt-6 p-6 bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="prose prose-invert max-w-none">
              <div className="text-slate-300 leading-relaxed">
                {aiReport.split("\n").map((line, i) => {
                  // Formatierung für Überschriften
                  if (line.match(/^#{1,6}\s/)) {
                    const level = Math.min(line.match(/^#+/)?.[0].length || 1, 6);
                    let text = line.replace(/^#+\s/, "");
                    // Entferne Markdown-Formatierung aus Überschriften
                    text = text.replace(/\*\*/g, "").replace(/\*/g, "");
                    const className = `font-bold text-white mt-6 mb-3 ${
                      level === 1 ? "text-2xl" : level === 2 ? "text-xl" : level === 3 ? "text-lg" : "text-base"
                    }`;
                    
                    // Verwende direkte Heading-Komponenten
                    if (level === 1) {
                      return <h1 key={i} className={className}>{text}</h1>;
                    } else if (level === 2) {
                      return <h2 key={i} className={className}>{text}</h2>;
                    } else if (level === 3) {
                      return <h3 key={i} className={className}>{text}</h3>;
                    } else if (level === 4) {
                      return <h4 key={i} className={className}>{text}</h4>;
                    } else if (level === 5) {
                      return <h5 key={i} className={className}>{text}</h5>;
                    } else {
                      return <h6 key={i} className={className}>{text}</h6>;
                    }
                  }
                  // Formatierung für Listen
                  if (line.match(/^[-*]\s/)) {
                    let listText = line.replace(/^[-*]\s/, "");
                    // Konvertiere Markdown zu HTML
                    listText = listText.replace(/\*\*(.*?)\*\*/g, "<strong class='font-bold text-white'>$1</strong>");
                    listText = listText.replace(/\*(.*?)\*/g, "<em class='italic'>$1</em>");
                    // Entferne verbleibende einzelne * Zeichen
                    listText = listText.replace(/\*(?![*<])/g, "");
                    return (
                      <div key={i} className="ml-4 mb-2" dangerouslySetInnerHTML={{ __html: `<span class="text-slate-400">•</span> ${listText}` }} />
                    );
                  }
                  // Normale Zeilen
                  if (line.trim()) {
                    let text = line;
                    // Konvertiere Markdown zu HTML (erst ** dann *, damit verschachtelte nicht kaputt gehen)
                    text = text.replace(/\*\*(.*?)\*\*/g, "<strong class='font-bold text-white'>$1</strong>");
                    text = text.replace(/\*(.*?)\*/g, "<em class='italic'>$1</em>");
                    // Entferne verbleibende einzelne * Zeichen
                    text = text.replace(/\*(?![*<])/g, "");
                    return (
                      <p key={i} className="mb-3" dangerouslySetInnerHTML={{ __html: text }} />
                    );
                  }
                  return <br key={i} />;
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Report Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      ) : (reportType === "standard" && currentStats) ||
        (reportType !== "standard" && currentStats && previousStats) ? (
        <>
          {/* Executive Summary */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Executive Summary</h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300 leading-relaxed whitespace-pre-line">{executiveSummary}</p>
            </div>
          </div>

          {/* Key Metrics */}
          {reportType === "standard" && currentStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Gesamt Klicks"
                value={currentStats.clicks}
              />
              <StatCard
                title="Gesamt Impressionen"
                value={currentStats.impressions}
              />
              <StatCard
                title="CTR"
                value={currentStats.ctr}
                format="percentage"
              />
              <StatCard
                title="Ø Position"
                value={currentStats.position}
                format="position"
              />
            </div>
          )}

          {reportType === "vergleich" && currentStats && previousStats && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Klicks"
                  value={currentStats.clicks}
                  subtitle={`vs. ${previousStats.clicks.toLocaleString("de-DE")}`}
                />
                <StatCard
                  title="Impressionen"
                  value={currentStats.impressions}
                  subtitle={`vs. ${previousStats.impressions.toLocaleString("de-DE")}`}
                />
                <StatCard
                  title="CTR"
                  value={currentStats.ctr}
                  format="percentage"
                  subtitle={`vs. ${(previousStats.ctr * 100).toFixed(2)}%`}
                />
                <StatCard
                  title="Ø Position"
                  value={currentStats.position}
                  format="position"
                  subtitle={`vs. ${previousStats.position.toFixed(1)}`}
                />
              </div>

              {/* Comparison Chart */}
              {chartData && chartData.comparison && (
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">Vergleichsübersicht</h3>
                  <LineChart
                    data={chartData.comparison}
                    xKey="name"
                    lines={[
                      { key: "clicks", name: "Klicks", color: "#3b82f6" },
                      { key: "impressions", name: "Impressionen", color: "#10b981" },
                    ]}
                    height={400}
                  />
                </div>
              )}
            </>
          )}

          {/* Charts for Standard Report */}
          {reportType === "standard" && chartData && chartData.topKeywords && chartData.topPages && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">Top 10 Keywords</h3>
                {chartData.topKeywords.length > 0 ? (
                  <BarChart
                    data={chartData.topKeywords}
                    xKey="keyword"
                    yKey="clicks"
                    height={400}
                    horizontal
                  />
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-slate-500">
                    Keine Daten verfügbar
                  </div>
                )}
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">Top 10 Seiten</h3>
                {chartData.topPages.length > 0 ? (
                  <BarChart
                    data={chartData.topPages}
                    xKey="page"
                    yKey="clicks"
                    height={400}
                    horizontal
                  />
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-slate-500">
                    Keine Daten verfügbar
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Device Distribution */}
          {reportType === "standard" && currentData.length > 0 && (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Geräte-Verteilung</h3>
              {(() => {
                const deviceData = currentData
                  .filter((d) => d.dimension === "device")
                  .map((d) => ({
                    name: d.key,
                    value: d.clicks,
                  }));

                return deviceData.length > 0 ? (
                  <PieChart data={deviceData} height={300} />
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-slate-500">
                    Keine Geräte-Daten verfügbar
                  </div>
                );
              })()}
            </div>
          )}

          {/* Keywords Comparison Charts */}
          {reportType === "keywords" && currentData.length > 0 && previousData.length > 0 && chartData && (
            <>
              {(() => {
                const keywords1 = new Set(currentData.filter((d) => d.dimension === "query").map((d) => d.key));
                const keywords2 = new Set(previousData.filter((d) => d.dimension === "query").map((d) => d.key));
                const common = new Set([...keywords1].filter((k) => keywords2.has(k)));
                const only1 = new Set([...keywords1].filter((k) => !keywords2.has(k)));
                const only2 = new Set([...keywords2].filter((k) => !keywords1.has(k)));

                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard title="Gemeinsame Keywords" value={common.size} />
                    <StatCard title="Nur aktuell" value={only1.size} />
                    <StatCard title="Nur Vorperiode" value={only2.size} />
                  </div>
                );
              })()}

              {chartData.commonKeywords && chartData.commonKeywords.length > 0 && (
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold text-white mb-4">Top 10 gemeinsame Keywords (nach Differenz)</h3>
                  <BarChart
                    data={chartData.commonKeywords.map((kw) => ({
                      keyword: kw.keyword,
                      clicksDiff: kw.clicksDiff,
                    }))}
                    xKey="keyword"
                    yKey="clicksDiff"
                    height={400}
                    horizontal
                  />
                </div>
              )}
            </>
          )}

          {/* Verzeichnisse Comparison Charts */}
          {reportType === "verzeichnisse" && currentData.length > 0 && previousData.length > 0 && chartData && chartData.topDirs && chartData.topDirs.length > 0 && (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Top 10 Verzeichnisse Vergleich</h3>
              <BarChart
                data={chartData.topDirs.map((dir) => ({
                  directory: dir.directory,
                  clicks1: dir.clicks1,
                  clicks2: dir.clicks2,
                }))}
                xKey="directory"
                yKey="clicks1"
                height={400}
                horizontal
              />
            </div>
          )}
        </>
      ) : (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center">
          <p className="text-slate-400">
            {reportType === "standard"
              ? "Lade Daten für den Standard-Report..."
              : "Lade Daten für den Vergleichs-Report..."}
          </p>
        </div>
      )}
    </div>
  );
}
