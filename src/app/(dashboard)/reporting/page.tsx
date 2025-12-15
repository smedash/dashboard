"use client";

import { useState, useEffect, useMemo } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { BarChart, LineChart, PieChart } from "@/components/charts";

interface Snapshot {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  totals: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  property: {
    siteUrl: string;
  };
}

interface SnapshotData {
  dimension: string;
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

type ReportType = "standard" | "vergleich" | "keywords" | "verzeichnisse";

export default function ReportingPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshotIds, setSelectedSnapshotIds] = useState<string[]>([]);
  const [reportType, setReportType] = useState<ReportType>("standard");
  const [snapshot1Data, setSnapshot1Data] = useState<SnapshotData[]>([]);
  const [snapshot2Data, setSnapshot2Data] = useState<SnapshotData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Fetch all snapshots
  useEffect(() => {
    async function fetchSnapshots() {
      try {
        const response = await fetch("/api/snapshots");
        const data = await response.json();
        setSnapshots(data.snapshots || []);
        if (data.snapshots?.length > 0) {
          setSelectedSnapshotIds([data.snapshots[0].id]);
        }
      } catch (error) {
        console.error("Error fetching snapshots:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSnapshots();
  }, []);

  // Fetch snapshot data when selected
  useEffect(() => {
    async function fetchSnapshotData() {
      if (selectedSnapshotIds.length === 0) return;

      setIsLoadingData(true);
      try {
        const [response1, response2] = await Promise.all([
          selectedSnapshotIds[0] ? fetch(`/api/snapshots/${selectedSnapshotIds[0]}`) : Promise.resolve(null),
          selectedSnapshotIds[1] ? fetch(`/api/snapshots/${selectedSnapshotIds[1]}`) : Promise.resolve(null),
        ]);

        if (response1) {
          const data1 = await response1.json();
          setSnapshot1Data(data1.snapshot?.data || []);
        } else {
          setSnapshot1Data([]);
        }

        if (response2) {
          const data2 = await response2.json();
          setSnapshot2Data(data2.snapshot?.data || []);
        } else {
          setSnapshot2Data([]);
        }
      } catch (error) {
        console.error("Error fetching snapshot data:", error);
      } finally {
        setIsLoadingData(false);
      }
    }
    fetchSnapshotData();
  }, [selectedSnapshotIds]);

  const selectedSnapshots = snapshots.filter((s) => selectedSnapshotIds.includes(s.id));

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Generate Executive Summary
  const executiveSummary = useMemo(() => {
    if (reportType === "standard" && selectedSnapshots.length >= 1) {
      const snapshot = selectedSnapshots[0];
      const totalClicks = snapshot.totals.clicks;
      const totalImpressions = snapshot.totals.impressions;
      const avgCTR = snapshot.totals.ctr;
      const avgPosition = snapshot.totals.position;

      // Get top keywords
      const topKeywords = snapshot1Data
        .filter((d) => d.dimension === "query")
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5)
        .map((d) => d.key);

      // Get top pages
      const topPages = snapshot1Data
        .filter((d) => d.dimension === "page")
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5)
        .map((d) => d.key);

      return `Im Zeitraum vom ${formatDate(snapshot.startDate)} bis ${formatDate(snapshot.endDate)} verzeichnete die Website ${totalClicks.toLocaleString("de-DE")} Klicks aus ${totalImpressions.toLocaleString("de-DE")} Impressionen. Die durchschnittliche Click-Through-Rate (CTR) lag bei ${(avgCTR * 100).toFixed(2)}%, während die durchschnittliche Position bei ${avgPosition.toFixed(1)} lag.

Die wichtigsten Keywords waren: ${topKeywords.join(", ")}. Die Top-Performer-Seiten umfassen ${topPages.length} Seiten, die zusammen einen erheblichen Anteil des organischen Traffics generieren.

Die Performance zeigt ${avgCTR >= 0.05 ? "eine gute" : avgCTR >= 0.03 ? "eine durchschnittliche" : "eine verbesserungswürdige"} CTR, was auf ${avgPosition <= 5 ? "starke Rankings" : avgPosition <= 10 ? "solide Rankings" : "Potenzial für Verbesserungen"} hindeutet.`;
    }

    if (reportType === "vergleich" && selectedSnapshots.length >= 2) {
      const snap1 = selectedSnapshots[0];
      const snap2 = selectedSnapshots[1];
      const clicksDiff = snap2.totals.clicks - snap1.totals.clicks;
      const clicksPercent = snap1.totals.clicks > 0
        ? ((snap2.totals.clicks - snap1.totals.clicks) / snap1.totals.clicks) * 100
        : 0;
      const impressionsDiff = snap2.totals.impressions - snap1.totals.impressions;
      const positionDiff = snap2.totals.position - snap1.totals.position;

      return `Vergleich zwischen ${snap1.name} (${formatDate(snap1.startDate)} - ${formatDate(snap1.endDate)}) und ${snap2.name} (${formatDate(snap2.startDate)} - ${formatDate(snap2.endDate)}):

Die Klicks ${clicksDiff >= 0 ? "stiegen" : "sanken"} um ${Math.abs(clicksDiff).toLocaleString("de-DE")} (${clicksPercent >= 0 ? "+" : ""}${clicksPercent.toFixed(1)}%), während die Impressionen ${impressionsDiff >= 0 ? "anstiegen" : "zurückgingen"} um ${Math.abs(impressionsDiff).toLocaleString("de-DE")}.

Die durchschnittliche Position ${positionDiff <= 0 ? "verbesserte sich" : "verschlechterte sich"} um ${Math.abs(positionDiff).toFixed(1)} Positionen. ${positionDiff <= 0 ? "Dies deutet auf erfolgreiche SEO-Maßnahmen hin." : "Hier besteht Handlungsbedarf zur Verbesserung der Rankings."}`;
    }

    if (reportType === "keywords" && selectedSnapshots.length >= 2) {
      const keywords1 = new Set(snapshot1Data.filter((d) => d.dimension === "query").map((d) => d.key));
      const keywords2 = new Set(snapshot2Data.filter((d) => d.dimension === "query").map((d) => d.key));
      const common = new Set([...keywords1].filter((k) => keywords2.has(k)));
      const only1 = new Set([...keywords1].filter((k) => !keywords2.has(k)));
      const only2 = new Set([...keywords2].filter((k) => !keywords1.has(k)));

      // Calculate total clicks for common keywords
      const commonKeywordsData = snapshot1Data
        .filter((d) => d.dimension === "query" && keywords2.has(d.key))
        .reduce((sum, d) => sum + d.clicks, 0);
      const commonKeywordsData2 = snapshot2Data
        .filter((d) => d.dimension === "query" && keywords1.has(d.key))
        .reduce((sum, d) => sum + d.clicks, 0);

      return `Keyword-Vergleich zwischen ${selectedSnapshots[0]?.name} und ${selectedSnapshots[1]?.name}:

Es wurden ${common.size} gemeinsame Keywords identifiziert, die in beiden Snapshots ranken. Diese generierten im ersten Snapshot ${commonKeywordsData.toLocaleString("de-DE")} Klicks und im zweiten Snapshot ${commonKeywordsData2.toLocaleString("de-DE")} Klicks.

${only1.size} Keywords sind nur im ersten Snapshot vorhanden, während ${only2.size} Keywords nur im zweiten Snapshot auftauchen. Die gemeinsamen Keywords zeigen die Kernkompetenzen der Website, während die Unterschiede auf Veränderungen in der Keyword-Strategie oder Marktentwicklung hindeuten.

${commonKeywordsData2 > commonKeywordsData ? "Die gemeinsamen Keywords zeigen eine positive Entwicklung mit steigenden Klicks." : commonKeywordsData2 < commonKeywordsData ? "Die gemeinsamen Keywords zeigen einen Rückgang der Performance." : "Die Performance der gemeinsamen Keywords blieb stabil."}`;
    }

    if (reportType === "verzeichnisse" && selectedSnapshots.length >= 2) {
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
      const calculateDirStats = (data: SnapshotData[], depth: number) => {
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
          const dirPath = extractDir(qp.key, depth);
          if (dirMap.has(dirPath)) {
            const dir = dirMap.get(dirPath)!;
            // Extract keyword from query_page dimension
            const parts = qp.key.split("|");
            if (parts.length > 1) {
              dir.keywords.add(parts[0]);
            }
          }
        });

        return dirMap;
      };

      const dirs1 = calculateDirStats(snapshot1Data, 3);
      const dirs2 = calculateDirStats(snapshot2Data, 3);

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

      return `Verzeichnis-Vergleich zwischen ${selectedSnapshots[0]?.name} und ${selectedSnapshots[1]?.name}:

Es wurden ${matchCount} ähnliche Verzeichnisse identifiziert, die auf gemeinsamen Keywords basieren (Ähnlichkeit ≥ 30%). Diese Verzeichnisse generierten im ersten Snapshot ${totalClicks1.toLocaleString("de-DE")} Klicks und im zweiten Snapshot ${totalClicks2.toLocaleString("de-DE")} Klicks.

Die Verzeichnisse zeigen strukturelle Ähnlichkeiten zwischen den beiden Snapshots und ermöglichen einen direkten Vergleich der Performance. ${totalClicks2 > totalClicks1 ? "Die Performance der ähnlichen Verzeichnisse hat sich verbessert." : totalClicks2 < totalClicks1 ? "Die Performance der ähnlichen Verzeichnisse ist zurückgegangen." : "Die Performance der ähnlichen Verzeichnisse blieb stabil."}`;
    }

    return "Bitte wähle einen Report-Typ und die entsprechenden Snapshots aus.";
  }, [reportType, selectedSnapshots, snapshot1Data, snapshot2Data]);

  // Chart data for standard report
  const chartData = useMemo(() => {
    if (reportType === "standard" && snapshot1Data.length > 0) {
      const topKeywords = snapshot1Data
        .filter((d) => d.dimension === "query")
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10)
        .map((d) => ({
          keyword: d.key.length > 30 ? d.key.substring(0, 30) + "..." : d.key,
          clicks: d.clicks,
        }));

      const topPages = snapshot1Data
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

    if (reportType === "vergleich" && selectedSnapshots.length >= 2) {
      return {
        comparison: [
          {
            name: selectedSnapshots[0].name,
            clicks: selectedSnapshots[0].totals.clicks,
            impressions: selectedSnapshots[0].totals.impressions,
            ctr: selectedSnapshots[0].totals.ctr * 100,
            position: selectedSnapshots[0].totals.position,
          },
          {
            name: selectedSnapshots[1].name,
            clicks: selectedSnapshots[1].totals.clicks,
            impressions: selectedSnapshots[1].totals.impressions,
            ctr: selectedSnapshots[1].totals.ctr * 100,
            position: selectedSnapshots[1].totals.position,
          },
        ],
      };
    }

    if (reportType === "keywords" && selectedSnapshots.length >= 2) {
      const keywords1Map = new Map<string, SnapshotData>();
      snapshot1Data.filter((d) => d.dimension === "query").forEach((d) => keywords1Map.set(d.key, d));
      const keywords2Map = new Map<string, SnapshotData>();
      snapshot2Data.filter((d) => d.dimension === "query").forEach((d) => keywords2Map.set(d.key, d));

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

    if (reportType === "verzeichnisse" && selectedSnapshots.length >= 2) {
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
      snapshot1Data
        .filter((d) => d.dimension === "page")
        .forEach((d) => {
          const dir = extractDir(d.key, 3);
          dirs1.set(dir, (dirs1.get(dir) || 0) + d.clicks);
        });

      const dirs2 = new Map<string, number>();
      snapshot2Data
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
  }, [reportType, snapshot1Data, snapshot2Data, selectedSnapshots]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Reporting</h1>
      </div>

      {/* Report Configuration */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Report konfigurieren</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Report-Typ</label>
            <select
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value as ReportType);
                if (e.target.value === "standard") {
                  setSelectedSnapshotIds(selectedSnapshotIds.slice(0, 1));
                } else if (e.target.value !== "standard" && selectedSnapshotIds.length < 2) {
                  if (selectedSnapshotIds.length === 1 && snapshots.length >= 2) {
                    setSelectedSnapshotIds([selectedSnapshotIds[0], snapshots.find((s) => s.id !== selectedSnapshotIds[0])?.id || ""]);
                  }
                }
              }}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="standard">Standard Report</option>
              <option value="vergleich">Vergleichs-Report</option>
              <option value="keywords">Keywords-Vergleich</option>
              <option value="verzeichnisse">Verzeichnisse-Vergleich</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Snapshot {reportType === "standard" ? "" : "1 (Basis)"}
            </label>
            <select
              value={selectedSnapshotIds[0] || ""}
              onChange={(e) => {
                const newIds = [...selectedSnapshotIds];
                newIds[0] = e.target.value;
                setSelectedSnapshotIds(newIds.filter(Boolean));
              }}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Bitte wählen --</option>
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {snapshot.name} ({formatDate(snapshot.startDate)} - {formatDate(snapshot.endDate)})
                </option>
              ))}
            </select>
          </div>

          {reportType !== "standard" && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Snapshot 2</label>
              <select
                value={selectedSnapshotIds[1] || ""}
                onChange={(e) => {
                  const newIds = [...selectedSnapshotIds];
                  newIds[1] = e.target.value;
                  setSelectedSnapshotIds(newIds.filter(Boolean));
                }}
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Bitte wählen --</option>
                {snapshots.map((snapshot) => (
                  <option key={snapshot.id} value={snapshot.id}>
                    {snapshot.name} ({formatDate(snapshot.startDate)} - {formatDate(snapshot.endDate)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Report Content */}
      {(reportType === "standard" && selectedSnapshots.length >= 1) ||
      (reportType !== "standard" && selectedSnapshots.length >= 2) ? (
        <>
          {/* Executive Summary */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">Executive Summary</h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300 leading-relaxed whitespace-pre-line">{executiveSummary}</p>
            </div>
          </div>

          {/* Key Metrics */}
          {reportType === "standard" && selectedSnapshots.length >= 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Gesamt Klicks"
                value={selectedSnapshots[0].totals.clicks}
              />
              <StatCard
                title="Gesamt Impressionen"
                value={selectedSnapshots[0].totals.impressions}
              />
              <StatCard
                title="CTR"
                value={selectedSnapshots[0].totals.ctr}
                format="percentage"
              />
              <StatCard
                title="Ø Position"
                value={selectedSnapshots[0].totals.position}
                format="position"
              />
            </div>
          )}

          {reportType === "vergleich" && selectedSnapshots.length >= 2 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                  title="Klicks"
                  value={selectedSnapshots[0].totals.clicks}
                  subtitle={`vs. ${selectedSnapshots[1].totals.clicks.toLocaleString("de-DE")}`}
                />
                <StatCard
                  title="Impressionen"
                  value={selectedSnapshots[0].totals.impressions}
                  subtitle={`vs. ${selectedSnapshots[1].totals.impressions.toLocaleString("de-DE")}`}
                />
                <StatCard
                  title="CTR"
                  value={selectedSnapshots[0].totals.ctr}
                  format="percentage"
                  subtitle={`vs. ${(selectedSnapshots[1].totals.ctr * 100).toFixed(2)}%`}
                />
                <StatCard
                  title="Ø Position"
                  value={selectedSnapshots[0].totals.position}
                  format="position"
                  subtitle={`vs. ${selectedSnapshots[1].totals.position.toFixed(1)}`}
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
          {reportType === "standard" && snapshot1Data.length > 0 && (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Geräte-Verteilung</h3>
              {(() => {
                const deviceData = snapshot1Data
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
          {reportType === "keywords" && selectedSnapshots.length >= 2 && chartData && (
            <>
              {(() => {
                const keywords1 = new Set(snapshot1Data.filter((d) => d.dimension === "query").map((d) => d.key));
                const keywords2 = new Set(snapshot2Data.filter((d) => d.dimension === "query").map((d) => d.key));
                const common = new Set([...keywords1].filter((k) => keywords2.has(k)));
                const only1 = new Set([...keywords1].filter((k) => !keywords2.has(k)));
                const only2 = new Set([...keywords2].filter((k) => !keywords1.has(k)));

                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard title="Gemeinsame Keywords" value={common.size} />
                    <StatCard title={`Nur in ${selectedSnapshots[0]?.name}`} value={only1.size} />
                    <StatCard title={`Nur in ${selectedSnapshots[1]?.name}`} value={only2.size} />
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
          {reportType === "verzeichnisse" && selectedSnapshots.length >= 2 && chartData && chartData.topDirs && chartData.topDirs.length > 0 && (
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
              ? "Bitte wähle einen Snapshot aus, um einen Report zu generieren."
              : "Bitte wähle zwei Snapshots aus, um einen Vergleichs-Report zu generieren."}
          </p>
        </div>
      )}
    </div>
  );
}

