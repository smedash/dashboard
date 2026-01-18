"use client";

import { useState, useEffect, useMemo } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { PropertySelector } from "@/components/ui/PropertySelector";

interface PageRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export default function PagesPage() {
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [period, setPeriod] = useState("28d");
  const [data, setData] = useState<PageRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchData() {
      if (!selectedProperty) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/gsc/pages?siteUrl=${encodeURIComponent(selectedProperty)}&period=${period}&limit=25000`
        );
        const result = await response.json();
        setData(result.data || []);
      } catch (error) {
        console.error("Error fetching pages:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [selectedProperty, period]);

  const tableData = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();

    return data
      .filter((row) => {
        if (!searchLower) return true;
        return row.keys[0].toLowerCase().includes(searchLower);
      })
      .map((row, index) => ({
        id: index,
        page: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }));
  }, [data, searchQuery]);

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search;
    } catch {
      return url;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Seiten</h1>
        <div className="flex flex-wrap items-center gap-4">
          <PropertySelector value={selectedProperty} onChange={setSelectedProperty} />
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[300px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="URLs durchsuchen..."
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {tableData.length} von {data.length} Seiten
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <DataTable
            data={tableData}
            keyField="id"
            columns={[
              {
                key: "page",
                header: "Seite",
                sortable: true,
                render: (value) => (
                  <a
                    href={String(value)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate max-w-[400px] block"
                    title={String(value)}
                  >
                    {formatUrl(String(value))}
                  </a>
                ),
              },
              {
                key: "clicks",
                header: "Klicks",
                sortable: true,
                render: (value) => (
                  <span className="text-blue-600 dark:text-blue-400">{Number(value).toLocaleString("de-DE")}</span>
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
        )}
      </div>
    </div>
  );
}

