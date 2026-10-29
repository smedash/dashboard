"use client";

import { useState, useEffect } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { LineChart } from "@/components/charts/LineChart";
import { useLocale, useMessages } from "@/i18n/I18nProvider";
import { comparisonMessages } from "@/i18n/messages/comparison";

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
  const t = useMessages(comparisonMessages);
  const { intlLocale } = useLocale();
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
    return new Date(dateString).toLocaleDateString(intlLocale, {
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
        <h2 className="text-xl font-bold text-white mb-2">{t.noSnapshotsTitle}</h2>
        <p className="text-slate-400 mb-4">
          {t.noSnapshotsHint}
        </p>
        <a
          href="/snapshots"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
        >
          {t.toSnapshots}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">{t.title}</h1>
      </div>

      {/* Snapshot Selection */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">{t.selectSnapshots}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((index) => (
            <div key={index}>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                {t.snapshotLabel(index + 1)}
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
                <option value="">{t.pleaseSelect}</option>
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
              title={t.clicks}
              value={selectedSnapshots[0].totals.clicks}
              subtitle={`${comparisonData.clicksDiff >= 0 ? "+" : ""}${comparisonData.clicksDiff.toLocaleString(intlLocale)} (${comparisonData.clicksPercent >= 0 ? "+" : ""}${comparisonData.clicksPercent.toFixed(1)}%)`}
              trend={comparisonData.clicksDiff >= 0 ? "up" : "down"}
            />
            <StatCard
              title={t.impressions}
              value={selectedSnapshots[0].totals.impressions}
              subtitle={`${comparisonData.impressionsDiff >= 0 ? "+" : ""}${comparisonData.impressionsDiff.toLocaleString(intlLocale)} (${comparisonData.impressionsPercent >= 0 ? "+" : ""}${comparisonData.impressionsPercent.toFixed(1)}%)`}
              trend={comparisonData.impressionsDiff >= 0 ? "up" : "down"}
            />
            <StatCard
              title={t.ctr}
              value={selectedSnapshots[0].totals.ctr}
              format="percentage"
              subtitle={`${comparisonData.ctrDiff >= 0 ? "+" : ""}${(comparisonData.ctrDiff * 100).toFixed(2)}% (${comparisonData.ctrPercent >= 0 ? "+" : ""}${comparisonData.ctrPercent.toFixed(1)}%)`}
              trend={comparisonData.ctrDiff >= 0 ? "up" : "down"}
            />
            <StatCard
              title={t.avgPosition}
              value={selectedSnapshots[0].totals.position}
              format="position"
              subtitle={`${comparisonData.positionDiff < 0 ? `${t.better} (-` : comparisonData.positionDiff > 0 ? `${t.worse} (+` : `${t.equal} (`}${Math.abs(comparisonData.positionDiff).toFixed(1)})`}
              trend={comparisonData.positionDiff < 0 ? "down" : comparisonData.positionDiff > 0 ? "up" : undefined}
            />
          </div>

          {/* Comparison Table */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">{t.detailedComparison}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{t.columns.metric}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                      {t.columns.base(selectedSnapshots[0].name)}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                      {selectedSnapshots[1].name}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">{t.columns.difference}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">{t.columns.change}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{t.clicks}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-white font-medium">
                      {selectedSnapshots[0].totals.clicks.toLocaleString(intlLocale)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-300">
                      {selectedSnapshots[1].totals.clicks.toLocaleString(intlLocale)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      comparisonData.clicksDiff > 0 ? "text-green-400" : comparisonData.clicksDiff < 0 ? "text-red-400" : "text-slate-400"
                    }`}>
                      {comparisonData.clicksDiff > 0 ? "+" : ""}{comparisonData.clicksDiff.toLocaleString(intlLocale)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      comparisonData.clicksPercent > 0 ? "text-green-400" : comparisonData.clicksPercent < 0 ? "text-red-400" : "text-slate-400"
                    }`}>
                      {comparisonData.clicksPercent > 0 ? "+" : ""}{comparisonData.clicksPercent.toFixed(2)}%
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{t.impressions}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-white font-medium">
                      {selectedSnapshots[0].totals.impressions.toLocaleString(intlLocale)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-300">
                      {selectedSnapshots[1].totals.impressions.toLocaleString(intlLocale)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      comparisonData.impressionsDiff > 0 ? "text-green-400" : comparisonData.impressionsDiff < 0 ? "text-red-400" : "text-slate-400"
                    }`}>
                      {comparisonData.impressionsDiff > 0 ? "+" : ""}{comparisonData.impressionsDiff.toLocaleString(intlLocale)}
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{t.avgPosition}</td>
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
                        ? `-${Math.abs(comparisonData.positionDiff).toFixed(1)} (${t.betterSuffix})`
                        : comparisonData.positionDiff > 0 
                        ? `+${comparisonData.positionDiff.toFixed(1)} (${t.worseSuffix})`
                        : "0.0"}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      comparisonData.positionDiff < 0 ? "text-green-400" : comparisonData.positionDiff > 0 ? "text-red-400" : "text-slate-400"
                    }`}>
                      {comparisonData.positionDiff < 0 ? t.better : comparisonData.positionDiff > 0 ? t.worse : t.equal}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Chart Comparison */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">{t.overviewChart}</h3>
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
                { key: "clicks", name: t.clicks, color: "#3b82f6" },
                { key: "impressions", name: t.impressions, color: "#10b981" },
              ]}
              height={400}
            />
          </div>
        </>
      )}

      {selectedSnapshots.length < 2 && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center">
          <p className="text-slate-400">
            {t.selectTwoHint}
          </p>
        </div>
      )}
    </div>
  );
}

