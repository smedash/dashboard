"use client";

import { useState, useEffect } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { LineChart } from "@/components/charts/LineChart";
import { PieChart } from "@/components/charts/PieChart";
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
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState("28d");
  const [stats, setStats] = useState<StatsData | null>(null);
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [needsGoogleConnection, setNeedsGoogleConnection] = useState(false);

  // Set mounted to true after component mounts to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!mounted || !selectedProperty) return;
      
      setIsLoading(true);
      setNeedsGoogleConnection(false);
      try {
        const [statsRes, devicesRes] = await Promise.all([
          fetch(`/api/gsc/stats?siteUrl=${encodeURIComponent(selectedProperty)}&period=${period}&dimension=date`),
          fetch(`/api/gsc/devices?siteUrl=${encodeURIComponent(selectedProperty)}&period=${period}`),
        ]);

        // Check HTTP status codes first
        if (!statsRes.ok || !devicesRes.ok) {
          const errorResponse = !statsRes.ok 
            ? await statsRes.json() 
            : await devicesRes.json();
          
          // Check if Google account needs to be connected
          if (errorResponse.needsConnection || statsRes.status === 403 || devicesRes.status === 403) {
            setNeedsGoogleConnection(true);
            setIsLoading(false);
            return;
          }
          
          const errorText = errorResponse.error || JSON.stringify(errorResponse);
          console.error("API Error:", errorText);
          setIsLoading(false);
          return;
        }

        const statsData = await statsRes.json();
        const devicesData = await devicesRes.json();

        // Check if error indicates missing Google connection
        if (statsData.needsConnection || devicesData.needsConnection) {
          setNeedsGoogleConnection(true);
          setIsLoading(false);
          return;
        }

        // Reset needsGoogleConnection if data loads successfully
        setNeedsGoogleConnection(false);

        // Only set stats if there's no error and data structure is valid
        if (statsData.error) {
          console.error("Error in stats data:", statsData.error);
          setStats(null);
        } else if (statsData.current && statsData.changes) {
          setStats(statsData);
        } else {
          console.error("Invalid stats data structure:", statsData);
          setStats(null);
        }
        
        setDevices(devicesData.data || []);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [mounted, selectedProperty, period]);

  if (needsGoogleConnection) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        </div>
        <div className="bg-blue-500/20 border border-blue-500/50 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-blue-400 font-semibold mb-2">Google Account nicht verbunden</h3>
              <p className="text-blue-300 mb-4">
                Du hast Dich noch nicht via Google OAuth mit Deinem Google Account verbunden und kannst deshalb hier keine Daten sehen.
              </p>
              <a
                href="/settings"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Zu den Einstellungen gehen
              </a>
            </div>
          </div>
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
              value={stats?.current?.clicks || 0}
              change={stats?.changes?.clicks}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              }
            />
            <StatCard
              title="Impressionen"
              value={stats?.current?.impressions || 0}
              change={stats?.changes?.impressions}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              }
            />
            <StatCard
              title="CTR"
              value={stats?.current?.ctr || 0}
              change={stats?.changes?.ctr}
              format="percentage"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
            />
            <StatCard
              title="Ø Position"
              value={stats?.current?.position || 0}
              change={stats?.changes?.position}
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


