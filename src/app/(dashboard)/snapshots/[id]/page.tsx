"use client";

import { useState, useEffect, use } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { StatCard } from "@/components/ui/StatCard";
import { LineChart } from "@/components/charts/LineChart";
import { PieChart } from "@/components/charts/PieChart";
import Link from "next/link";
import { useLocale, useMessages } from "@/i18n/I18nProvider";
import { snapshotsMessages } from "@/i18n/messages/snapshots";

interface SnapshotData {
  id: string;
  dimension: string;
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface Snapshot {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  totals: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  createdAt: string;
  user: {
    name: string | null;
    email: string;
  };
  property: {
    siteUrl: string;
  };
  data: SnapshotData[];
}

export default function SnapshotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useMessages(snapshotsMessages).detail;
  const { intlLocale } = useLocale();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"queries" | "pages" | "countries" | "devices">("queries");
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    async function fetchSnapshot() {
      try {
        const response = await fetch(`/api/snapshots/${id}`);
        const data = await response.json();
        setSnapshot(data.snapshot);
      } catch (error) {
        console.error("Error fetching snapshot:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSnapshot();
  }, [id]);

  const handleExport = (format: "csv" | "xlsx" | "json", dimension?: string) => {
    const dimensionParam = dimension ? `&dimension=${dimension}` : "";
    window.open(`/api/snapshots/${id}/export?format=${format}${dimensionParam}`, "_blank");
    setShowExportMenu(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-white mb-2">{t.notFound}</h2>
        <Link href="/snapshots" className="text-blue-400 hover:text-blue-300">
          {t.backToOverview}
        </Link>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(intlLocale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getDimensionKey = () => {
    switch (activeTab) {
      case "queries": return "query";
      case "pages": return "page";
      case "countries": return "country";
      case "devices": return "device";
    }
  };

  const getDataByDimension = (dimension: string) => {
    return snapshot.data
      .filter((d) => d.dimension === dimension)
      .map((d, index) => ({
        id: index,
        key: d.key,
        clicks: d.clicks,
        impressions: d.impressions,
        ctr: d.ctr,
        position: d.position,
      }));
  };

  const dateData = snapshot.data
    .filter((d) => d.dimension === "date")
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((d) => ({
      date: d.key,
      clicks: d.clicks,
      impressions: d.impressions,
    }));

  const deviceData = snapshot.data
    .filter((d) => d.dimension === "device")
    .map((d) => ({
      name: d.key === "DESKTOP" ? t.deviceNames.DESKTOP : d.key === "MOBILE" ? t.deviceNames.MOBILE : t.deviceNames.TABLET,
      value: d.clicks,
    }));

  const tabs = [
    { key: "queries", label: t.tabs.queries },
    { key: "pages", label: t.tabs.pages },
    { key: "countries", label: t.tabs.countries },
    { key: "devices", label: t.tabs.devices },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/snapshots"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{snapshot.name}</h1>
            <p className="text-slate-400 text-sm">
              {formatDate(snapshot.startDate)} - {formatDate(snapshot.endDate)} • {t.createdBy(snapshot.user.name || snapshot.user.email)}
            </p>
          </div>
        </div>

        {/* Export Button */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {t.export}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-slate-700 rounded-lg shadow-xl border border-slate-600 py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-600">
                <p className="text-xs text-slate-400 uppercase font-medium">{t.allData}</p>
              </div>
              <button
                onClick={() => handleExport("xlsx")}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-600 flex items-center gap-3"
              >
                <span className="w-8 h-8 rounded bg-green-600 flex items-center justify-center text-xs font-bold">XLS</span>
                Excel (.xlsx)
              </button>
              <button
                onClick={() => handleExport("csv")}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-600 flex items-center gap-3"
              >
                <span className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-xs font-bold">CSV</span>
                CSV (.csv)
              </button>
              <button
                onClick={() => handleExport("json")}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-600 flex items-center gap-3"
              >
                <span className="w-8 h-8 rounded bg-amber-600 flex items-center justify-center text-xs font-bold">{ }</span>
                JSON (.json)
              </button>

              <div className="px-4 py-2 border-t border-slate-600 mt-2">
                <p className="text-xs text-slate-400 uppercase font-medium">{t.currentView(tabs.find((tab) => tab.key === activeTab)?.label ?? "")}</p>
              </div>
              <button
                onClick={() => handleExport("xlsx", getDimensionKey())}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-600 flex items-center gap-3"
              >
                <span className="w-8 h-8 rounded bg-green-600 flex items-center justify-center text-xs font-bold">XLS</span>
                Excel (.xlsx)
              </button>
              <button
                onClick={() => handleExport("csv", getDimensionKey())}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-600 flex items-center gap-3"
              >
                <span className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-xs font-bold">CSV</span>
                CSV (.csv)
              </button>
              <button
                onClick={() => handleExport("json", getDimensionKey())}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-600 flex items-center gap-3"
              >
                <span className="w-8 h-8 rounded bg-amber-600 flex items-center justify-center text-xs font-bold">{ }</span>
                JSON (.json)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title={t.kpis.clicks} value={snapshot.totals.clicks} />
        <StatCard title={t.kpis.impressions} value={snapshot.totals.impressions} />
        <StatCard title={t.kpis.ctr} value={snapshot.totals.ctr} format="percentage" />
        <StatCard title={t.kpis.avgPosition} value={snapshot.totals.position} format="position" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">{t.clicksAndImpressions}</h3>
          {dateData.length > 0 ? (
            <LineChart
              data={dateData}
              xKey="date"
              lines={[
                { key: "clicks", name: t.kpis.clicks, color: "#3b82f6" },
                { key: "impressions", name: t.kpis.impressions, color: "#10b981" },
              ]}
              height={300}
            />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-500">
              {t.noTimeSeries}
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">{t.devices}</h3>
          {deviceData.length > 0 ? (
            <PieChart data={deviceData} height={300} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-500">
              {t.noDeviceData}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="flex border-b border-slate-700">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "text-white border-b-2 border-blue-500"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <DataTable
          data={getDataByDimension(getDimensionKey())}
          keyField="id"
          columns={[
            {
              key: "key",
              header: activeTab === "queries" ? t.columns.query : activeTab === "pages" ? t.columns.page : activeTab === "countries" ? t.columns.country : t.columns.device,
              sortable: true,
              render: (value) => (
                <span className="font-medium text-white truncate max-w-[300px] block">
                  {String(value)}
                </span>
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
          ]}
        />
      </div>
    </div>
  );
}
