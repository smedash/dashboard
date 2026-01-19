"use client";

import { useState, useEffect } from "react";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { BarChart } from "@/components/charts/BarChart";
import { DataTable } from "@/components/ui/DataTable";
import { useProperty } from "@/contexts/PropertyContext";

interface CountryRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

const countryNames: Record<string, string> = {
  deu: "Deutschland",
  aut: "Österreich",
  che: "Schweiz",
  usa: "USA",
  gbr: "Großbritannien",
  fra: "Frankreich",
  nld: "Niederlande",
  bel: "Belgien",
  ita: "Italien",
  esp: "Spanien",
  pol: "Polen",
  cze: "Tschechien",
  dnk: "Dänemark",
  swe: "Schweden",
  nor: "Norwegen",
  fin: "Finnland",
  rus: "Russland",
  jpn: "Japan",
  chn: "China",
  ind: "Indien",
  bra: "Brasilien",
  can: "Kanada",
  aus: "Australien",
};

export default function CountriesPage() {
  const { selectedProperty } = useProperty();
  const [period, setPeriod] = useState("28d");
  const [data, setData] = useState<CountryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!selectedProperty) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/gsc/countries?siteUrl=${encodeURIComponent(selectedProperty)}&period=${period}&limit=50`
        );
        const result = await response.json();
        setData(result.data || []);
      } catch (error) {
        console.error("Error fetching countries:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [selectedProperty, period]);

  const getCountryName = (code: string) => {
    return countryNames[code.toLowerCase()] || code.toUpperCase();
  };

  const chartData = data.slice(0, 10).map((row) => ({
    country: getCountryName(row.keys[0]),
    clicks: row.clicks,
  }));

  const tableData = data.map((row, index) => ({
    id: index,
    country: row.keys[0],
    countryName: getCountryName(row.keys[0]),
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Länder</h1>
        <div className="flex flex-wrap items-center gap-4">
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
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
      ) : (
        <>
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">Top 10 Länder nach Klicks</h3>
            {chartData.length > 0 ? (
              <BarChart
                data={chartData}
                xKey="country"
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

          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <DataTable
              data={tableData}
              keyField="id"
              columns={[
                {
                  key: "countryName",
                  header: "Land",
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
                  header: "Position",
                  sortable: true,
                  render: (value) => Number(value).toFixed(1),
                },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}


