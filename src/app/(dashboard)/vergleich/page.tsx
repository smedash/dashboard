"use client";

import { useState, useEffect } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { LineChart } from "@/components/charts/LineChart";

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

export default function VergleichPage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedSnapshotIds, setSelectedSnapshotIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all snapshots
  useEffect(() => {
    async function fetchSnapshots() {
      try {
        const response = await fetch("/api/snapshots");
        const data = await response.json();
        setSnapshots(data.snapshots || []);
        // Select first two snapshots by default if available
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

  const selectedSnapshots = snapshots.filter((s) => selectedSnapshotIds.includes(s.id));

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Calculate comparison metrics
  // Snapshot 1 (erster ausgewählt) wird mit Snapshot 2 verglichen
  // Positive Werte = Snapshot 1 ist besser, Negative = Snapshot 1 ist schlechter
  const comparisonData = selectedSnapshots.length >= 2
    ? {
        // Snapshot 1 - Snapshot 2 (wenn positiv = Snapshot 1 hat mehr)
        clicksDiff: selectedSnapshots[0].totals.clicks - selectedSnapshots[1].totals.clicks,
        clicksPercent: selectedSnapshots[1].totals.clicks > 0
          ? ((selectedSnapshots[0].totals.clicks - selectedSnapshots[1].totals.clicks) / selectedSnapshots[1].totals.clicks) * 100
          : 0,
        impressionsDiff: selectedSnapshots[0].totals.impressions - selectedSnapshots[1].totals.impressions,
        impressionsPercent: selectedSnapshots[1].totals.impressions > 0
          ? ((selectedSnapshots[0].totals.impressions - selectedSnapshots[1].totals.impressions) / selectedSnapshots[1].totals.impressions) * 100
          : 0,
        // Position: niedriger ist besser, daher umgekehrte Logik
        positionDiff: selectedSnapshots[0].totals.position - selectedSnapshots[1].totals.position,
        ctrDiff: selectedSnapshots[0].totals.ctr - selectedSnapshots[1].totals.ctr,
        ctrPercent: selectedSnapshots[1].totals.ctr > 0
          ? ((selectedSnapshots[0].totals.ctr - selectedSnapshots[1].totals.ctr) / selectedSnapshots[1].totals.ctr) * 100
          : 0,
      }
    : null;

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
          Erstelle zuerst mindestens zwei Snapshots, um einen Vergleich durchzuführen.
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
        <h1 className="text-2xl font-bold text-white">Vergleich</h1>
      </div>

      {/* Snapshot Selection */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Snapshots auswählen</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((index) => (
            <div key={index}>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Snapshot {index + 1}
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
      {selectedSnapshots.length >= 2 && comparisonData && (
        <>
          {/* Overview Stats - Zeige Snapshot 1 Werte mit Vergleich zu Snapshot 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Klicks"
              value={selectedSnapshots[0].totals.clicks}
              subtitle={`${comparisonData.clicksDiff >= 0 ? "+" : ""}${comparisonData.clicksDiff.toLocaleString("de-DE")} (${comparisonData.clicksPercent >= 0 ? "+" : ""}${comparisonData.clicksPercent.toFixed(1)}%)`}
              trend={comparisonData.clicksDiff >= 0 ? "up" : "down"}
            />
            <StatCard
              title="Impressionen"
              value={selectedSnapshots[0].totals.impressions}
              subtitle={`${comparisonData.impressionsDiff >= 0 ? "+" : ""}${comparisonData.impressionsDiff.toLocaleString("de-DE")} (${comparisonData.impressionsPercent >= 0 ? "+" : ""}${comparisonData.impressionsPercent.toFixed(1)}%)`}
              trend={comparisonData.impressionsDiff >= 0 ? "up" : "down"}
            />
            <StatCard
              title="CTR"
              value={selectedSnapshots[0].totals.ctr}
              format="percentage"
              subtitle={`${comparisonData.ctrDiff >= 0 ? "+" : ""}${(comparisonData.ctrDiff * 100).toFixed(2)}% (${comparisonData.ctrPercent >= 0 ? "+" : ""}${comparisonData.ctrPercent.toFixed(1)}%)`}
              trend={comparisonData.ctrDiff >= 0 ? "up" : "down"}
            />
            <StatCard
              title="Ø Position"
              value={selectedSnapshots[0].totals.position}
              format="position"
              subtitle={`${comparisonData.positionDiff < 0 ? "Besser (-" : comparisonData.positionDiff > 0 ? "Schlechter (+" : "Gleich ("}${Math.abs(comparisonData.positionDiff).toFixed(1)})`}
              trend={comparisonData.positionDiff < 0 ? "down" : comparisonData.positionDiff > 0 ? "up" : undefined}
            />
          </div>

          {/* Comparison Table */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">Detaillierter Vergleich</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Metrik</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                      {selectedSnapshots[0].name} (Basis)
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                      {selectedSnapshots[1].name}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Differenz</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Änderung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">Klicks</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-white font-medium">
                      {selectedSnapshots[0].totals.clicks.toLocaleString("de-DE")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-300">
                      {selectedSnapshots[1].totals.clicks.toLocaleString("de-DE")}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      comparisonData.clicksDiff > 0 ? "text-green-400" : comparisonData.clicksDiff < 0 ? "text-red-400" : "text-slate-400"
                    }`}>
                      {comparisonData.clicksDiff > 0 ? "+" : ""}{comparisonData.clicksDiff.toLocaleString("de-DE")}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      comparisonData.clicksPercent > 0 ? "text-green-400" : comparisonData.clicksPercent < 0 ? "text-red-400" : "text-slate-400"
                    }`}>
                      {comparisonData.clicksPercent > 0 ? "+" : ""}{comparisonData.clicksPercent.toFixed(2)}%
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">Impressionen</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-white font-medium">
                      {selectedSnapshots[0].totals.impressions.toLocaleString("de-DE")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-300">
                      {selectedSnapshots[1].totals.impressions.toLocaleString("de-DE")}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      comparisonData.impressionsDiff > 0 ? "text-green-400" : comparisonData.impressionsDiff < 0 ? "text-red-400" : "text-slate-400"
                    }`}>
                      {comparisonData.impressionsDiff > 0 ? "+" : ""}{comparisonData.impressionsDiff.toLocaleString("de-DE")}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      comparisonData.impressionsPercent > 0 ? "text-green-400" : comparisonData.impressionsPercent < 0 ? "text-red-400" : "text-slate-400"
                    }`}>
                      {comparisonData.impressionsPercent > 0 ? "+" : ""}{comparisonData.impressionsPercent.toFixed(2)}%
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">CTR</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-white font-medium">
                      {(selectedSnapshots[0].totals.ctr * 100).toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-300">
                      {(selectedSnapshots[1].totals.ctr * 100).toFixed(2)}%
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      comparisonData.ctrDiff > 0 ? "text-green-400" : comparisonData.ctrDiff < 0 ? "text-red-400" : "text-slate-400"
                    }`}>
                      {comparisonData.ctrDiff > 0 ? "+" : ""}{(comparisonData.ctrDiff * 100).toFixed(2)}%
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      comparisonData.ctrPercent > 0 ? "text-green-400" : comparisonData.ctrPercent < 0 ? "text-red-400" : "text-slate-400"
                    }`}>
                      {comparisonData.ctrPercent > 0 ? "+" : ""}{comparisonData.ctrPercent.toFixed(2)}%
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">Ø Position</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-white font-medium">
                      {selectedSnapshots[0].totals.position.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-300">
                      {selectedSnapshots[1].totals.position.toFixed(1)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      comparisonData.positionDiff < 0 ? "text-green-400" : comparisonData.positionDiff > 0 ? "text-red-400" : "text-slate-400"
                    }`}>
                      {/* Position: negativ = besser (niedrigere Zahl), positiv = schlechter (höhere Zahl) */}
                      {comparisonData.positionDiff < 0 
                        ? `-${Math.abs(comparisonData.positionDiff).toFixed(1)} (besser)`
                        : comparisonData.positionDiff > 0 
                        ? `+${comparisonData.positionDiff.toFixed(1)} (schlechter)`
                        : "0.0"}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      comparisonData.positionDiff < 0 ? "text-green-400" : comparisonData.positionDiff > 0 ? "text-red-400" : "text-slate-400"
                    }`}>
                      {comparisonData.positionDiff < 0 ? "Besser" : comparisonData.positionDiff > 0 ? "Schlechter" : "Gleich"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Chart Comparison */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Vergleichsübersicht</h3>
            <LineChart
              data={[
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
              ]}
              xKey="name"
              lines={[
                { key: "clicks", name: "Klicks", color: "#3b82f6" },
                { key: "impressions", name: "Impressionen", color: "#10b981" },
              ]}
              height={400}
            />
          </div>
        </>
      )}

      {selectedSnapshots.length < 2 && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center">
          <p className="text-slate-400">
            Bitte wähle zwei Snapshots aus, um einen Vergleich durchzuführen.
          </p>
        </div>
      )}
    </div>
  );
}

