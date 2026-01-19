"use client";

import { useState, useEffect } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { LineChart } from "@/components/charts/LineChart";
import { PieChart } from "@/components/charts/PieChart";
import { signIn } from "next-auth/react";
import { useProperty } from "@/contexts/PropertyContext";

interface StatsData {
  current: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  changes: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  chartData: Array<{
    keys: string[];
    clicks: number;
    impressions: number;
  }>;
}

interface DeviceData {
  keys: string[];
  clicks: number;
  impressions: number;
}

export default function DashboardPage() {
  const { selectedProperty } = useProperty();
  const [period, setPeriod] = useState("28d");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [needsGoogleConnection, setNeedsGoogleConnection] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!selectedProperty) return;
      
      setIsLoading(true);
      try {
        const [statsRes, devicesRes] = await Promise.all([
          fetch(`/api/gsc/stats?siteUrl=${encodeURIComponent(selectedProperty)}&period=${period}&dimension=date`),
          fetch(`/api/gsc/devices?siteUrl=${encodeURIComponent(selectedProperty)}&period=${period}`),
        ]);

        const statsData = await statsRes.json();
        const devicesData = await devicesRes.json();

        if (statsData.error && statsRes.status === 403) {
          setNeedsGoogleConnection(true);
          return;
        }

        setStats(statsData);
        setDevices(devicesData.data || []);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [selectedProperty, period]);

  if (needsGoogleConnection) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-500/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Google Verbindung erforderlich</h2>
          <p className="text-slate-400 mb-6">
            Um auf die Search Console Daten zuzugreifen, musst Du Dein Google-Konto verbinden.
          </p>
          <button
            onClick={() => signIn("google")}
            className="inline-flex items-center gap-3 px-6 py-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold rounded-lg transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Mit Google verbinden
          </button>
        </div>
      </div>
    );
  }

  const chartData = stats?.chartData?.map((row) => ({
    date: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
  })) || [];

  const deviceData = devices.map((d) => ({
    name: d.keys[0] === "DESKTOP" ? "Desktop" : d.keys[0] === "MOBILE" ? "Mobile" : "Tablet",
    value: d.clicks,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-4">
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center py-12 bg-slate-800 rounded-xl border border-slate-700">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-slate-800 rounded-xl animate-pulse"></div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Klicks"
              value={stats?.current.clicks || 0}
              change={stats?.changes.clicks}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              }
            />
            <StatCard
              title="Impressionen"
              value={stats?.current.impressions || 0}
              change={stats?.changes.impressions}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              }
            />
            <StatCard
              title="CTR"
              value={stats?.current.ctr || 0}
              change={stats?.changes.ctr}
              format="percentage"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
            />
            <StatCard
              title="Ø Position"
              value={stats?.current.position || 0}
              change={stats?.changes.position}
              format="position"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Klicks & Impressionen</h3>
              {chartData.length > 0 ? (
                <LineChart
                  data={chartData}
                  xKey="date"
                  lines={[
                    { key: "clicks", name: "Klicks", color: "#3b82f6" },
                    { key: "impressions", name: "Impressionen", color: "#10b981" },
                  ]}
                  height={300}
                />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-500">
                  Keine Daten verfügbar
                </div>
              )}
            </div>

            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Geräte</h3>
              {deviceData.length > 0 ? (
                <PieChart data={deviceData} height={300} />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-500">
                  Keine Daten verfügbar
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}


