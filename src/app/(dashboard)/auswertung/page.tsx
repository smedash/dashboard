"use client";

import { useState, useEffect, useMemo } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { BarChart } from "@/components/charts/BarChart";
import { StatCard } from "@/components/ui/StatCard";

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

interface DirectoryStats {
  path: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  pageCount: number;
  pages: Array<{
    url: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  keywords: Array<{
    keyword: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

export default function AuswertungPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [snapshotData, setSnapshotData] = useState<SnapshotData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [selectedDirectory, setSelectedDirectory] = useState<string | null>(null);
  const [directoryDepth, setDirectoryDepth] = useState(2);
  const [viewMode, setViewMode] = useState<"directories" | "keywords">("directories");
  const [brandFilter, setBrandFilter] = useState("raiffeisen");
  const [excludeBrand, setExcludeBrand] = useState(true);

  // Fetch all snapshots
  useEffect(() => {
    async function fetchSnapshots() {
      try {
        const response = await fetch("/api/snapshots");
        const data = await response.json();
        setSnapshots(data.snapshots || []);
        if (data.snapshots?.length > 0) {
          setSelectedSnapshotId(data.snapshots[0].id);
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
      if (!selectedSnapshotId) return;

      setIsLoadingData(true);
      try {
        const response = await fetch(`/api/snapshots/${selectedSnapshotId}`);
        const data = await response.json();
        setSnapshotData(data.snapshot?.data || []);
        setSelectedDirectory(null);
      } catch (error) {
        console.error("Error fetching snapshot data:", error);
      } finally {
        setIsLoadingData(false);
      }
    }
    fetchSnapshotData();
  }, [selectedSnapshotId]);

  // Parse URL and extract directory path
  const extractDirectoryPath = (url: string, depth: number): string => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/").filter(Boolean);
      const dirParts = pathParts.slice(0, depth);
      return "/" + dirParts.join("/");
    } catch {
      return "/";
    }
  };

  // Calculate directory statistics
  const directoryStats = useMemo(() => {
    const pageData = snapshotData.filter((d) => d.dimension === "page");
    const queryData = snapshotData.filter((d) => d.dimension === "query");

    const dirMap = new Map<string, DirectoryStats>();

    // Group pages by directory
    pageData.forEach((page) => {
      const dirPath = extractDirectoryPath(page.key, directoryDepth);

      if (!dirMap.has(dirPath)) {
        dirMap.set(dirPath, {
          path: dirPath,
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0,
          pageCount: 0,
          pages: [],
          keywords: [],
        });
      }

      const dir = dirMap.get(dirPath)!;
      dir.clicks += page.clicks;
      dir.impressions += page.impressions;
      dir.pageCount += 1;
      dir.position += page.position;
      dir.pages.push({
        url: page.key,
        clicks: page.clicks,
        impressions: page.impressions,
        ctr: page.ctr,
        position: page.position,
      });
    });

    // Calculate averages and CTR
    dirMap.forEach((dir) => {
      dir.ctr = dir.impressions > 0 ? dir.clicks / dir.impressions : 0;
      dir.position = dir.pageCount > 0 ? dir.position / dir.pageCount : 0;
      dir.pages.sort((a, b) => b.clicks - a.clicks);
    });

    // Add keywords (for the entire snapshot, will filter by selected directory)
    const stats = Array.from(dirMap.values()).sort((a, b) => b.clicks - a.clicks);

    return { directories: stats, allKeywords: queryData };
  }, [snapshotData, directoryDepth]);

  // Get keywords for selected directory (based on URL patterns)
  const directoryKeywords = useMemo(() => {
    if (!selectedDirectory) return [];

    // Filter keywords based on brand filter
    const brandTerms = brandFilter
      .toLowerCase()
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    return directoryStats.allKeywords
      .map((kw) => ({
        keyword: kw.key,
        clicks: kw.clicks,
        impressions: kw.impressions,
        ctr: kw.ctr,
        position: kw.position,
      }))
      .filter((kw) => {
        if (!excludeBrand || brandTerms.length === 0) return true;
        const kwLower = kw.keyword.toLowerCase();
        return !brandTerms.some((term) => kwLower.includes(term));
      })
      .sort((a, b) => b.clicks - a.clicks);
  }, [selectedDirectory, directoryStats.allKeywords, brandFilter, excludeBrand]);

  const selectedSnapshot = snapshots.find((s) => s.id === selectedSnapshotId);
  const selectedDir = directoryStats.directories.find((d) => d.path === selectedDirectory);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const chartData = directoryStats.directories.slice(0, 10).map((dir) => ({
    directory: dir.path.length > 20 ? "..." + dir.path.slice(-20) : dir.path,
    clicks: dir.clicks,
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Keine Snapshots vorhanden</h2>
        <p className="text-slate-400 mb-4">
          Erstelle zuerst einen Snapshot, um die Auswertung zu nutzen.
        </p>
        <a
          href="/snapshots"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
        >
          Zu den Snapshots
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Auswertung</h1>

        <div className="flex flex-wrap items-center gap-4">
          {/* Snapshot Selector */}
          <select
            value={selectedSnapshotId || ""}
            onChange={(e) => setSelectedSnapshotId(e.target.value)}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {snapshots.map((snapshot) => (
              <option key={snapshot.id} value={snapshot.id}>
                {snapshot.name} ({formatDate(snapshot.startDate)} - {formatDate(snapshot.endDate)})
              </option>
            ))}
          </select>

          {/* Directory Depth */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Tiefe:</span>
            <select
              value={directoryDepth}
              onChange={(e) => setDirectoryDepth(parseInt(e.target.value))}
              className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[1, 2, 3, 4, 5].map((depth) => (
                <option key={depth} value={depth}>
                  {depth} {depth === 1 ? "Ebene" : "Ebenen"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoadingData ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <>
          {/* Overview Stats */}
          {selectedSnapshot && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Verzeichnisse"
                value={directoryStats.directories.length}
              />
              <StatCard
                title="Gesamt Klicks"
                value={selectedSnapshot.totals.clicks}
              />
              <StatCard
                title="Gesamt Impressionen"
                value={selectedSnapshot.totals.impressions}
              />
              <StatCard
                title="Ø Position"
                value={selectedSnapshot.totals.position}
                format="position"
              />
            </div>
          )}

          {/* Chart */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Top 10 Verzeichnisse nach Klicks</h3>
            {chartData.length > 0 ? (
              <BarChart data={chartData} xKey="directory" yKey="clicks" height={400} horizontal />
            ) : (
              <div className="h-[400px] flex items-center justify-center text-slate-500">
                Keine Daten verfügbar
              </div>
            )}
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Directory List */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-lg font-semibold text-white">Verzeichnisse</h3>
                <p className="text-sm text-slate-400">Klicke auf ein Verzeichnis für Details</p>
              </div>
              <div className="max-h-[500px] overflow-y-auto">
                {directoryStats.directories.map((dir) => (
                  <button
                    key={dir.path}
                    onClick={() => {
                      setSelectedDirectory(dir.path);
                      setViewMode("directories");
                    }}
                    className={`w-full px-4 py-3 text-left border-b border-slate-700/50 hover:bg-slate-700/50 transition-colors ${
                      selectedDirectory === dir.path ? "bg-blue-600/20 border-l-4 border-l-blue-500" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-white truncate max-w-[70%]" title={dir.path}>
                        {dir.path}
                      </span>
                      <span className="text-blue-400 font-medium">
                        {dir.clicks.toLocaleString("de-DE")}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-slate-400">
                      <span>{dir.impressions.toLocaleString("de-DE")} Impr.</span>
                      <span>{(dir.ctr * 100).toFixed(1)}% CTR</span>
                      <span>Pos. {dir.position.toFixed(1)}</span>
                      <span>{dir.pageCount} Seiten</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Detail View */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              {selectedDir ? (
                <>
                  <div className="p-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold text-white truncate" title={selectedDir.path}>
                      {selectedDir.path}
                    </h3>
                    <div className="flex gap-4 mt-2 text-sm">
                      <span className="text-blue-400">{selectedDir.clicks.toLocaleString("de-DE")} Klicks</span>
                      <span className="text-slate-400">{selectedDir.impressions.toLocaleString("de-DE")} Impr.</span>
                      <span className="text-slate-400">{(selectedDir.ctr * 100).toFixed(2)}% CTR</span>
                    </div>

                    {/* View Toggle */}
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => setViewMode("directories")}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          viewMode === "directories"
                            ? "bg-blue-600 text-white"
                            : "bg-slate-700 text-slate-300 hover:text-white"
                        }`}
                      >
                        Seiten ({selectedDir.pageCount})
                      </button>
                      <button
                        onClick={() => setViewMode("keywords")}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                          viewMode === "keywords"
                            ? "bg-blue-600 text-white"
                            : "bg-slate-700 text-slate-300 hover:text-white"
                        }`}
                      >
                        Keywords ({directoryKeywords.length})
                      </button>
                    </div>

                    {/* Brand Filter - only show in keywords mode */}
                    {viewMode === "keywords" && (
                      <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
                        <div className="flex items-center gap-3">
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
                            placeholder="z.B. raiffeisen, bank"
                            disabled={!excludeBrand}
                            className="flex-1 px-3 py-1.5 text-sm bg-slate-600 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          Mehrere Begriffe mit Komma trennen
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="max-h-[400px] overflow-y-auto">
                    {viewMode === "directories" ? (
                      // Pages in this directory
                      <table className="w-full">
                        <thead className="bg-slate-700/50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">Seite</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Klicks</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Pos.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDir.pages.map((page, index) => (
                            <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                              <td className="px-4 py-2">
                                <a
                                  href={page.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-400 hover:text-blue-300 truncate block max-w-[250px]"
                                  title={page.url}
                                >
                                  {new URL(page.url).pathname}
                                </a>
                              </td>
                              <td className="px-4 py-2 text-right text-sm text-white">
                                {page.clicks.toLocaleString("de-DE")}
                              </td>
                              <td className="px-4 py-2 text-right text-sm text-slate-400">
                                {page.position.toFixed(1)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      // Keywords
                      <table className="w-full">
                        <thead className="bg-slate-700/50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-slate-400">Keyword</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Klicks</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-slate-400">Pos.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {directoryKeywords.slice(0, 100).map((kw, index) => (
                            <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                              <td className="px-4 py-2">
                                <span className="text-sm text-white">{kw.keyword}</span>
                              </td>
                              <td className="px-4 py-2 text-right text-sm text-blue-400">
                                {kw.clicks.toLocaleString("de-DE")}
                              </td>
                              <td className="px-4 py-2 text-right text-sm text-slate-400">
                                {kw.position.toFixed(1)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[500px] text-slate-500">
                  <div className="text-center">
                    <svg className="w-12 h-12 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    <p>Wähle ein Verzeichnis aus der Liste</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Full Directory Table */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Alle Verzeichnisse</h3>
            </div>
            <DataTable
              data={directoryStats.directories.map((dir, index) => ({
                id: index,
                path: dir.path,
                clicks: dir.clicks,
                impressions: dir.impressions,
                ctr: dir.ctr,
                position: dir.position,
                pageCount: dir.pageCount,
              }))}
              keyField="id"
              columns={[
                {
                  key: "path",
                  header: "Verzeichnis",
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
                  header: "Ø Position",
                  sortable: true,
                  render: (value) => Number(value).toFixed(1),
                },
                {
                  key: "pageCount",
                  header: "Seiten",
                  sortable: true,
                  render: (value) => Number(value).toLocaleString("de-DE"),
                },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}

