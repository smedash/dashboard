"use client";

import { useState, useEffect } from "react";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { PropertySelector } from "@/components/ui/PropertySelector";
import { PieChart } from "@/components/charts/PieChart";
import { StatCard } from "@/components/ui/StatCard";

interface DeviceRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

const deviceNames: Record<string, string> = {
  DESKTOP: "Desktop",
  MOBILE: "Mobile",
  TABLET: "Tablet",
};

const deviceIcons: Record<string, React.ReactNode> = {
  DESKTOP: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  MOBILE: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  TABLET: (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
};

export default function DevicesPage() {
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [period, setPeriod] = useState("28d");
  const [data, setData] = useState<DeviceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!selectedProperty) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/gsc/devices?siteUrl=${encodeURIComponent(selectedProperty)}&period=${period}`
        );
        const result = await response.json();
        setData(result.data || []);
      } catch (error) {
        console.error("Error fetching devices:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [selectedProperty, period]);

  const totalClicks = data.reduce((sum, d) => sum + d.clicks, 0);
  const totalImpressions = data.reduce((sum, d) => sum + d.impressions, 0);

  const pieDataClicks = data.map((d) => ({
    name: deviceNames[d.keys[0]] || d.keys[0],
    value: d.clicks,
  }));

  const pieDataImpressions = data.map((d) => ({
    name: deviceNames[d.keys[0]] || d.keys[0],
    value: d.impressions,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Geräte</h1>
        <div className="flex flex-wrap items-center gap-4">
          <PropertySelector value={selectedProperty} onChange={setSelectedProperty} />
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-slate-800 rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {data.map((device) => {
              const deviceType = device.keys[0];
              const percentage = totalClicks > 0 ? (device.clicks / totalClicks) * 100 : 0;
              
              return (
                <div
                  key={deviceType}
                  className="bg-slate-800 rounded-xl p-6 border border-slate-700"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400">
                      {deviceIcons[deviceType]}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {deviceNames[deviceType] || deviceType}
                      </h3>
                      <p className="text-sm text-slate-400">{percentage.toFixed(1)}% der Klicks</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-400">Klicks</p>
                      <p className="text-xl font-bold text-white">
                        {device.clicks.toLocaleString("de-DE")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Impressionen</p>
                      <p className="text-xl font-bold text-white">
                        {device.impressions.toLocaleString("de-DE")}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">CTR</p>
                      <p className="text-xl font-bold text-white">
                        {(device.ctr * 100).toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Position</p>
                      <p className="text-xl font-bold text-white">
                        {device.position.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Klicks nach Gerät</h3>
              {pieDataClicks.length > 0 ? (
                <PieChart data={pieDataClicks} height={300} />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-500">
                  Keine Daten verfügbar
                </div>
              )}
            </div>

            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Impressionen nach Gerät</h3>
              {pieDataImpressions.length > 0 ? (
                <PieChart data={pieDataImpressions} height={300} />
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


