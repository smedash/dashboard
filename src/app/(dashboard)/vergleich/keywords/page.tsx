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
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface KeywordComparison {
  keyword: string;
  snapshot1?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  snapshot2?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  status: "common" | "missing_snapshot1" | "missing_snapshot2";
  clicksDiff: number;
  impressionsDiff: number;
  positionDiff: number;
}

export default function KeywordsVergleichPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshotIds, setSelectedSnapshotIds] = useState<string[]>([]);
  const [snapshot1Data, setSnapshot1Data] = useState<SnapshotData[]>([]);
  const [snapshot2Data, setSnapshot2Data] = useState<SnapshotData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "common" | "missing_snapshot1" | "missing_snapshot2">("all");
  const [sortBy, setSortBy] = useState<"keyword" | "clicks" | "impressions" | "position">("clicks");

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

  // Calculate keyword comparison
  const keywordComparison = useMemo(() => {
    if (selectedSnapshotIds.length < 2) return [];

    const keywords1 = snapshot1Data
      .filter((d) => d.dimension === "query")
      .reduce((acc, d) => {
        acc[d.key] = {
          clicks: d.clicks,
          impressions: d.impressions,
          ctr: d.ctr,
          position: d.position,
        };
        return acc;
      }, {} as Record<string, { clicks: number; impressions: number; ctr: number; position: number }>);

    const keywords2 = snapshot2Data
      .filter((d) => d.dimension === "query")
      .reduce((acc, d) => {
        acc[d.key] = {
          clicks: d.clicks,
          impressions: d.impressions,
          ctr: d.ctr,
          position: d.position,
        };
        return acc;
      }, {} as Record<string, { clicks: number; impressions: number; ctr: number; position: number }>);

    const allKeywords = new Set([...Object.keys(keywords1), ...Object.keys(keywords2)]);

    const comparison: KeywordComparison[] = Array.from(allKeywords).map((keyword) => {
      const kw1 = keywords1[keyword];
      const kw2 = keywords2[keyword];

      let status: "common" | "missing_snapshot1" | "missing_snapshot2";
      if (kw1 && kw2) {
        status = "common";
      } else if (kw1 && !kw2) {
        status = "missing_snapshot2";
      } else {
        status = "missing_snapshot1";
      }

      const clicksDiff = (kw1?.clicks || 0) - (kw2?.clicks || 0);
      const impressionsDiff = (kw1?.impressions || 0) - (kw2?.impressions || 0);
      const positionDiff = (kw1?.position || 0) - (kw2?.position || 0);

      return {
        keyword,
        snapshot1: kw1,
        snapshot2: kw2,
        status,
        clicksDiff,
        impressionsDiff,
        positionDiff,
      };
    });

    // Sort
    comparison.sort((a, b) => {
      switch (sortBy) {
        case "keyword":
          return a.keyword.localeCompare(b.keyword);
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

    // Filter
    if (filterStatus === "all") return comparison;
    return comparison.filter((kw) => kw.status === filterStatus);
  }, [snapshot1Data, snapshot2Data, selectedSnapshotIds, filterStatus, sortBy]);

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
    const common = keywordComparison.filter((kw) => kw.status === "common").length;
    const missing1 = keywordComparison.filter((kw) => kw.status === "missing_snapshot1").length;
    const missing2 = keywordComparison.filter((kw) => kw.status === "missing_snapshot2").length;
    const total = keywordComparison.length;

    return { common, missing1, missing2, total };
  }, [keywordComparison]);

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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Keine Snapshots vorhanden</h2>
        <p className="text-slate-400 mb-4">
          Erstelle zuerst mindestens zwei Snapshots, um einen Keyword-Vergleich durchzuführen.
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
        <h1 className="text-2xl font-bold text-white">Keywords-Vergleich</h1>
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
      </div>

      {/* Comparison Results */}
      {selectedSnapshotIds.length >= 2 && selectedSnapshots.length >= 2 && (
        <>
          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Gemeinsame Keywords" value={stats.common} />
            <StatCard title="Nur in Snapshot 1" value={stats.missing2} />
            <StatCard title="Nur in Snapshot 2" value={stats.missing1} />
            <StatCard title="Gesamt Keywords" value={stats.total} />
          </div>

          {/* Filters and Sort */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300">Filter:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Alle</option>
                <option value="common">Gemeinsam</option>
                <option value="missing_snapshot2">Nur Snapshot 1</option>
                <option value="missing_snapshot1">Nur Snapshot 2</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300">Sortieren nach:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="clicks">Klicks-Differenz</option>
                <option value="impressions">Impressionen-Differenz</option>
                <option value="position">Position-Differenz</option>
                <option value="keyword">Keyword (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Keywords Table */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Keywords-Vergleich</h3>
            </div>
            {isLoadingData ? (
              <div className="p-8 flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            ) : (
              <DataTable
                data={keywordComparison.map((kw, index) => ({
                  id: index,
                  keyword: kw.keyword,
                  status: kw.status,
                  snapshot1Clicks: kw.snapshot1?.clicks || 0,
                  snapshot1Impressions: kw.snapshot1?.impressions || 0,
                  snapshot1Position: kw.snapshot1?.position || 0,
                  snapshot2Clicks: kw.snapshot2?.clicks || 0,
                  snapshot2Impressions: kw.snapshot2?.impressions || 0,
                  snapshot2Position: kw.snapshot2?.position || 0,
                  clicksDiff: kw.clicksDiff,
                  impressionsDiff: kw.impressionsDiff,
                  positionDiff: kw.positionDiff,
                }))}
                keyField="id"
                columns={[
                  {
                    key: "keyword",
                    header: "Keyword",
                    sortable: true,
                    render: (value) => (
                      <span className="font-medium text-white">{String(value)}</span>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    sortable: true,
                    render: (value) => {
                      const statusLabels = {
                        common: "Gemeinsam",
                        missing_snapshot1: "Nur Snapshot 2",
                        missing_snapshot2: "Nur Snapshot 1",
                      };
                      const statusColors = {
                        common: "bg-blue-500/20 text-blue-400",
                        missing_snapshot1: "bg-yellow-500/20 text-yellow-400",
                        missing_snapshot2: "bg-orange-500/20 text-orange-400",
                      };
                      return (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[value as keyof typeof statusColors]}`}>
                          {statusLabels[value as keyof typeof statusLabels]}
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
                ]}
              />
            )}
          </div>
        </>
      )}

      {selectedSnapshotIds.length < 2 && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center">
          <p className="text-slate-400">
            Bitte wähle zwei Snapshots aus, um einen Keyword-Vergleich durchzuführen.
          </p>
        </div>
      )}
    </div>
  );
}


