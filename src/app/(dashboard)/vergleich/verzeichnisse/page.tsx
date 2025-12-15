"use client";

import { useState, useEffect, useMemo } from "react";
import { DataTable } from "@/components/ui/DataTable";
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
}

interface SnapshotData {
  dimension: string;
  key: string;
  pageUrl?: string | null;
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
  topKeywords: Array<{
    keyword: string;
    clicks: number;
    impressions: number;
  }>;
}

interface DirectoryComparison {
  path1: string;
  path2: string;
  snapshot1?: DirectoryStats;
  snapshot2?: DirectoryStats;
  similarityScore: number;
  commonKeywords: string[];
  clicksDiff: number;
  impressionsDiff: number;
  positionDiff: number;
  pageCountDiff: number;
}

export default function VerzeichnisseVergleichPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshotIds, setSelectedSnapshotIds] = useState<string[]>([]);
  const [snapshot1Data, setSnapshot1Data] = useState<SnapshotData[]>([]);
  const [snapshot2Data, setSnapshot2Data] = useState<SnapshotData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [sortBy, setSortBy] = useState<"similarity" | "clicks" | "impressions" | "position">("similarity");
  const [directoryDepth, setDirectoryDepth] = useState(4);
  const [minSimilarity, setMinSimilarity] = useState(0.3); // Mindest-Ähnlichkeit (0-1)
  const [topKeywordsCount, setTopKeywordsCount] = useState(20); // Anzahl Top-Keywords für Matching

  // Fetch all snapshots
  useEffect(() => {
    async function fetchSnapshots() {
      try {
        const response = await fetch("/api/snapshots");
        const data = await response.json();
        setSnapshots(data.snapshots || []);
        if (data.snapshots?.length >= 2) {
          setSelectedSnapshotIds([data.snapshots[0].id, data.snapshots[1].id]);
        } else if (data.snapshots?.length === 1) {
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

  // Extract directory path from URL
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

  // Calculate directory statistics for a snapshot with keywords
  const calculateDirectoryStats = (data: SnapshotData[], depth: number): Record<string, DirectoryStats> => {
    const pageData = data.filter((d) => d.dimension === "page");
    const queryPageData = data.filter((d) => d.dimension === "query_page");
    const dirMap = new Map<string, DirectoryStats>();

    // First, collect pages per directory
    pageData.forEach((page) => {
      const dirPath = extractDirectoryPath(page.key, depth);

      if (!dirMap.has(dirPath)) {
        dirMap.set(dirPath, {
          path: dirPath,
          clicks: 0,
          impressions: 0,
          ctr: 0,
          position: 0,
          pageCount: 0,
          topKeywords: [],
        });
      }

      const dir = dirMap.get(dirPath)!;
      dir.clicks += page.clicks;
      dir.impressions += page.impressions;
      dir.pageCount += 1;
      dir.position += page.position;
    });

    // Calculate averages
    dirMap.forEach((dir) => {
      dir.ctr = dir.impressions > 0 ? dir.clicks / dir.impressions : 0;
      dir.position = dir.pageCount > 0 ? dir.position / dir.pageCount : 0;
    });

    // Get page URLs per directory
    const dirPageUrls = new Map<string, Set<string>>();
    pageData.forEach((page) => {
      const dirPath = extractDirectoryPath(page.key, depth);
      if (!dirPageUrls.has(dirPath)) {
        dirPageUrls.set(dirPath, new Set());
      }
      dirPageUrls.get(dirPath)!.add(page.key);
    });

    // Extract top keywords per directory
    dirMap.forEach((dir) => {
      const pageUrls = dirPageUrls.get(dir.path) || new Set();
      const keywordMap = new Map<string, { clicks: number; impressions: number }>();

      queryPageData.forEach((qp) => {
        if (qp.pageUrl && pageUrls.has(qp.pageUrl)) {
          const existing = keywordMap.get(qp.key);
          if (existing) {
            existing.clicks += qp.clicks;
            existing.impressions += qp.impressions;
          } else {
            keywordMap.set(qp.key, {
              clicks: qp.clicks,
              impressions: qp.impressions,
            });
          }
        }
      });

      // Get top keywords by clicks
      dir.topKeywords = Array.from(keywordMap.entries())
        .map(([keyword, stats]) => ({ keyword, ...stats }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, topKeywordsCount);
    });

    return Object.fromEntries(dirMap);
  };

  // Calculate similarity score between two directories based on common keywords
  const calculateSimilarity = (dir1: DirectoryStats, dir2: DirectoryStats): number => {
    if (dir1.topKeywords.length === 0 && dir2.topKeywords.length === 0) return 0;
    if (dir1.topKeywords.length === 0 || dir2.topKeywords.length === 0) return 0;

    const keywords1 = new Set(dir1.topKeywords.map((k) => k.keyword.toLowerCase()));
    const keywords2 = new Set(dir2.topKeywords.map((k) => k.keyword.toLowerCase()));

    const intersection = new Set([...keywords1].filter((k) => keywords2.has(k)));
    const union = new Set([...keywords1, ...keywords2]);

    // Jaccard similarity coefficient
    return union.size > 0 ? intersection.size / union.size : 0;
  };

  // Calculate directory comparison with keyword-based matching
  const directoryComparison = useMemo(() => {
    if (selectedSnapshotIds.length < 2) return [];

    const directories1 = calculateDirectoryStats(snapshot1Data, directoryDepth);
    const directories2 = calculateDirectoryStats(snapshot2Data, directoryDepth);

    const dirs1Array = Object.values(directories1);
    const dirs2Array = Object.values(directories2);

    // Calculate similarity matrix
    const comparisons: DirectoryComparison[] = [];

    dirs1Array.forEach((dir1) => {
      let bestMatchDir: DirectoryStats | undefined = undefined;
      let bestMatchScore = 0;

      dirs2Array.forEach((dir2) => {
        const similarity = calculateSimilarity(dir1, dir2);
        if (similarity >= minSimilarity && similarity > bestMatchScore) {
          bestMatchDir = dir2;
          bestMatchScore = similarity;
        }
      });

      if (bestMatchDir) {
        const matchedDir: DirectoryStats = bestMatchDir;
        const keywords1Lower = new Set(dir1.topKeywords.map((k) => k.keyword.toLowerCase()));
        const keywords2Lower = new Set(matchedDir.topKeywords.map((k) => k.keyword.toLowerCase()));
        const commonKeywords = dir1.topKeywords
          .filter((k1) => keywords2Lower.has(k1.keyword.toLowerCase()))
          .map((k) => k.keyword);

        comparisons.push({
          path1: dir1.path,
          path2: matchedDir.path,
          snapshot1: dir1,
          snapshot2: matchedDir,
          similarityScore: bestMatchScore,
          commonKeywords,
          clicksDiff: dir1.clicks - matchedDir.clicks,
          impressionsDiff: dir1.impressions - matchedDir.impressions,
          positionDiff: dir1.position - matchedDir.position,
          pageCountDiff: dir1.pageCount - matchedDir.pageCount,
        });
      }
    });

    // Sort
    comparisons.sort((a, b) => {
      switch (sortBy) {
        case "similarity":
          return b.similarityScore - a.similarityScore;
        case "clicks":
          return Math.abs(b.clicksDiff) - Math.abs(a.clicksDiff);
        case "impressions":
          return Math.abs(b.impressionsDiff) - Math.abs(a.impressionsDiff);
        case "position":
          return Math.abs(b.positionDiff) - Math.abs(a.positionDiff);
        default:
          return 0;
      }
    });

    return comparisons;
  }, [snapshot1Data, snapshot2Data, selectedSnapshotIds, sortBy, directoryDepth, minSimilarity, topKeywordsCount]);

  const selectedSnapshots = snapshots.filter((s) => selectedSnapshotIds.includes(s.id));

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const matched = directoryComparison.length;
    const avgSimilarity = matched > 0
      ? directoryComparison.reduce((sum, dir) => sum + dir.similarityScore, 0) / matched
      : 0;

    return { matched, avgSimilarity };
  }, [directoryComparison]);

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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Keine Snapshots vorhanden</h2>
        <p className="text-slate-400 mb-4">
          Erstelle zuerst mindestens zwei Snapshots, um einen Verzeichnis-Vergleich durchzuführen.
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
        <h1 className="text-2xl font-bold text-white">Verzeichnisse-Vergleich</h1>
      </div>

      {/* Snapshot Selection */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Snapshots auswählen</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((index) => (
            <div key={index}>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Snapshot {index + 1} {index === 0 && "(Basis)"}
              </label>
              <select
                value={selectedSnapshotIds[index] || ""}
                onChange={(e) => {
                  const newIds = [...selectedSnapshotIds];
                  newIds[index] = e.target.value;
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
          ))}
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Verzeichnis-Tiefe
          </label>
          <select
            value={directoryDepth}
            onChange={(e) => setDirectoryDepth(parseInt(e.target.value))}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[1, 2, 3, 4, 5].map((depth) => (
              <option key={depth} value={depth}>
                {depth} {depth === 1 ? "Ebene" : "Ebenen"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Comparison Results */}
      {selectedSnapshotIds.length >= 2 && selectedSnapshots.length >= 2 && (
        <>
          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard title="Gefundene Matches" value={stats.matched} />
            <StatCard 
              title="Ø Ähnlichkeit" 
              value={`${(stats.avgSimilarity * 100).toFixed(1)}%`}
            />
          </div>

          {/* Filters and Sort */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300">Mindest-Ähnlichkeit:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={minSimilarity}
                onChange={(e) => setMinSimilarity(parseFloat(e.target.value))}
                className="w-32"
              />
              <span className="text-sm text-white w-12">{(minSimilarity * 100).toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300">Top Keywords:</span>
              <select
                value={topKeywordsCount}
                onChange={(e) => setTopKeywordsCount(parseInt(e.target.value))}
                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="30">30</option>
                <option value="50">50</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300">Sortieren nach:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="similarity">Ähnlichkeit</option>
                <option value="clicks">Klicks-Differenz</option>
                <option value="impressions">Impressionen-Differenz</option>
                <option value="position">Position-Differenz</option>
              </select>
            </div>
          </div>

          {/* Directories Table */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Verzeichnisse-Vergleich</h3>
            </div>
            {isLoadingData ? (
              <div className="p-8 flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : (
              <DataTable
                data={directoryComparison.map((dir, index) => ({
                  id: index,
                  path1: dir.path1,
                  path2: dir.path2,
                  similarityScore: dir.similarityScore,
                  commonKeywords: dir.commonKeywords,
                  snapshot1Clicks: dir.snapshot1?.clicks || 0,
                  snapshot1Impressions: dir.snapshot1?.impressions || 0,
                  snapshot1Position: dir.snapshot1?.position || 0,
                  snapshot1PageCount: dir.snapshot1?.pageCount || 0,
                  snapshot2Clicks: dir.snapshot2?.clicks || 0,
                  snapshot2Impressions: dir.snapshot2?.impressions || 0,
                  snapshot2Position: dir.snapshot2?.position || 0,
                  snapshot2PageCount: dir.snapshot2?.pageCount || 0,
                  clicksDiff: dir.clicksDiff,
                  impressionsDiff: dir.impressionsDiff,
                  positionDiff: dir.positionDiff,
                  pageCountDiff: dir.pageCountDiff,
                }))}
                keyField="id"
                columns={[
                  {
                    key: "path1",
                    header: `${selectedSnapshots[0]?.name} - Verzeichnis`,
                    sortable: true,
                    render: (value) => (
                      <span className="font-medium text-white">{String(value)}</span>
                    ),
                  },
                  {
                    key: "path2",
                    header: `${selectedSnapshots[1]?.name} - Verzeichnis`,
                    sortable: true,
                    render: (value) => (
                      <span className="font-medium text-slate-300">{String(value)}</span>
                    ),
                  },
                  {
                    key: "similarityScore",
                    header: "Ähnlichkeit",
                    sortable: true,
                    render: (value) => {
                      const score = Number(value);
                      return (
                        <span className={`font-medium ${
                          score >= 0.7 ? "text-green-400" : 
                          score >= 0.5 ? "text-yellow-400" : 
                          "text-orange-400"
                        }`}>
                          {(score * 100).toFixed(1)}%
                        </span>
                      );
                    },
                  },
                  {
                    key: "commonKeywords",
                    header: "Gemeinsame Keywords",
                    sortable: false,
                    render: (value) => {
                      const keywords = value as string[];
                      return (
                        <span className="text-sm text-slate-400" title={keywords.join(", ")}>
                          {keywords.length} {keywords.length === 1 ? "Keyword" : "Keywords"}
                        </span>
                      );
                    },
                  },
                  {
                    key: "snapshot1Clicks",
                    header: `${selectedSnapshots[0]?.name} - Klicks`,
                    sortable: true,
                    render: (value) => (
                      <span className="text-white">{Number(value).toLocaleString("de-DE")}</span>
                    ),
                  },
                  {
                    key: "snapshot2Clicks",
                    header: `${selectedSnapshots[1]?.name} - Klicks`,
                    sortable: true,
                    render: (value) => (
                      <span className="text-slate-300">{Number(value).toLocaleString("de-DE")}</span>
                    ),
                  },
                  {
                    key: "clicksDiff",
                    header: "Klicks-Differenz",
                    sortable: true,
                    render: (value) => {
                      const diff = Number(value);
                      return (
                        <span className={`font-medium ${diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-slate-400"}`}>
                          {diff > 0 ? "+" : ""}{diff.toLocaleString("de-DE")}
                        </span>
                      );
                    },
                  },
                  {
                    key: "snapshot1Impressions",
                    header: `${selectedSnapshots[0]?.name} - Impr.`,
                    sortable: true,
                    render: (value) => (
                      <span className="text-white">{Number(value).toLocaleString("de-DE")}</span>
                    ),
                  },
                  {
                    key: "snapshot2Impressions",
                    header: `${selectedSnapshots[1]?.name} - Impr.`,
                    sortable: true,
                    render: (value) => (
                      <span className="text-slate-300">{Number(value).toLocaleString("de-DE")}</span>
                    ),
                  },
                  {
                    key: "impressionsDiff",
                    header: "Impr.-Differenz",
                    sortable: true,
                    render: (value) => {
                      const diff = Number(value);
                      return (
                        <span className={`font-medium ${diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-slate-400"}`}>
                          {diff > 0 ? "+" : ""}{diff.toLocaleString("de-DE")}
                        </span>
                      );
                    },
                  },
                  {
                    key: "snapshot1Position",
                    header: `${selectedSnapshots[0]?.name} - Pos.`,
                    sortable: true,
                    render: (value) => (
                      <span className="text-white">{Number(value).toFixed(1)}</span>
                    ),
                  },
                  {
                    key: "snapshot2Position",
                    header: `${selectedSnapshots[1]?.name} - Pos.`,
                    sortable: true,
                    render: (value) => (
                      <span className="text-slate-300">{Number(value).toFixed(1)}</span>
                    ),
                  },
                  {
                    key: "positionDiff",
                    header: "Pos.-Differenz",
                    sortable: true,
                    render: (value) => {
                      const diff = Number(value);
                      return (
                        <span className={`font-medium ${diff < 0 ? "text-green-400" : diff > 0 ? "text-red-400" : "text-slate-400"}`}>
                          {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                        </span>
                      );
                    },
                  },
                  {
                    key: "snapshot1PageCount",
                    header: `${selectedSnapshots[0]?.name} - Seiten`,
                    sortable: true,
                    render: (value) => (
                      <span className="text-white">{Number(value).toLocaleString("de-DE")}</span>
                    ),
                  },
                  {
                    key: "snapshot2PageCount",
                    header: `${selectedSnapshots[1]?.name} - Seiten`,
                    sortable: true,
                    render: (value) => (
                      <span className="text-slate-300">{Number(value).toLocaleString("de-DE")}</span>
                    ),
                  },
                  {
                    key: "pageCountDiff",
                    header: "Seiten-Differenz",
                    sortable: true,
                    render: (value) => {
                      const diff = Number(value);
                      return (
                        <span className={`font-medium ${diff > 0 ? "text-green-400" : diff < 0 ? "text-red-400" : "text-slate-400"}`}>
                          {diff > 0 ? "+" : ""}{diff.toLocaleString("de-DE")}
                        </span>
                      );
                    },
                  },
                ]}
              />
            )}
          </div>
        </>
      )}

      {selectedSnapshotIds.length < 2 && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center">
          <p className="text-slate-400">
            Bitte wähle zwei Snapshots aus, um einen Verzeichnis-Vergleich durchzuführen.
          </p>
        </div>
      )}
    </div>
  );
}

