"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import { DataTable } from "@/components/ui/DataTable";
import { PeriodSelector } from "@/components/ui/PeriodSelector";
import { useProperty } from "@/contexts/PropertyContext";

interface QueryRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export default function QueriesPage() {
  const { selectedProperty } = useProperty();
  const [period, setPeriod] = useState("28d");
  const [data, setData] = useState<QueryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [brandFilter, setBrandFilter] = useState("ubs");
  const [excludeBrand, setExcludeBrand] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchData() {
      if (!selectedProperty) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/gsc/queries?siteUrl=${encodeURIComponent(selectedProperty)}&period=${period}&limit=25000`
        );
        const result = await response.json();
        setData(result.data || []);
      } catch (error) {
        console.error("Error fetching queries:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [selectedProperty, period]);

  const tableData = useMemo(() => {
    const brandTerms = brandFilter
      .toLowerCase()
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const searchLower = searchQuery.toLowerCase().trim();

    return data
      .filter((row) => {
        const queryLower = row.keys[0].toLowerCase();
        
        // Search filter
        if (searchLower && !queryLower.includes(searchLower)) {
          return false;
        }
        
        // Brand filter
        if (excludeBrand && brandTerms.length > 0) {
          if (brandTerms.some((term) => queryLower.includes(term))) {
            return false;
          }
        }
        
        return true;
      })
      .map((row, index) => ({
        id: index,
        query: row.keys[0],
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }));
  }, [data, excludeBrand, brandFilter, searchQuery]);

  const exportToXlsx = useCallback(() => {
    if (tableData.length === 0) return;

    const rows = tableData.map((r) => ({
      Suchanfrage: r.query,
      Klicks: r.clicks,
      Impressionen: r.impressions,
      "CTR (%)": Math.round(r.ctr * 10000) / 100,
      Position: Math.round(r.position * 10) / 10,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Suchanfragen");

    const host = (() => {
      try {
        return new URL(selectedProperty || "").hostname.replace(/[^a-zA-Z0-9._-]/g, "_") || "property";
      } catch {
        return "property";
      }
    })();
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `gsc-suchanfragen_${host}_${period}_${stamp}.xlsx`);
  }, [tableData, selectedProperty, period]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Suchanfragen</h1>
        <div className="flex flex-wrap items-center gap-4">
          <PeriodSelector value={period} onChange={setPeriod} />
          <button
            type="button"
            onClick={exportToXlsx}
            disabled={isLoading || tableData.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            title="Aktuelle Tabelle (inkl. Filter) als Excel-Datei speichern"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Keywords durchsuchen..."
            className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Brand Filter */}
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={excludeBrand}
              onChange={(e) => setExcludeBrand(e.target.checked)}
              className="w-4 h-4 rounded border-slate-500 bg-slate-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
            />
            <span className="text-sm text-slate-300">Brand ausschließen:</span>
          </label>
          <input
            type="text"
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            placeholder="z.B. ubs, bank"
            disabled={!excludeBrand}
            className="flex-1 min-w-[200px] max-w-[400px] px-3 py-2 text-sm bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <span className="text-sm text-slate-400">
            {tableData.length} von {data.length} Suchanfragen
          </span>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex flex-col items-center justify-center">
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
          <DataTable
            data={tableData}
            keyField="id"
            columns={[
              {
                key: "query",
                header: "Suchanfrage",
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
        )}
      </div>
    </div>
  );
}

