"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { DataTable } from "@/components/ui/DataTable";
import { LineChart } from "@/components/charts/LineChart";
import { canEdit } from "@/lib/rbac";

interface Keyword {
  id: string;
  keyword: string;
  category: string | null;
  targetUrl: string | null;
  createdAt: string;
  rankings: Array<{
    id: string;
    position: number | null;
    url: string | null;
    date: string;
  }>;
}

const KEYWORD_CATEGORIES = [
  "Mortgages",
  "Accounts&Cards",
  "Investing",
  "Pension",
  "Digital Banking",
] as const;

interface Tracker {
  id: string;
  name: string;
  location: string;
  language: string;
  keywords: Keyword[];
}

interface Ranking {
  id: string;
  keywordId: string;
  position: number | null;
  url: string | null;
  date: string;
  keyword: {
    id: string;
    keyword: string;
    targetUrl: string | null;
  };
}

export default function RankTrackerPage() {
  const { data: session } = useSession();
  const canEditData = canEdit(session?.user?.role);
  const [tracker, setTracker] = useState<Tracker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newCategory, setNewCategory] = useState<string>("");
  const [newTargetUrl, setNewTargetUrl] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [historicalRankings, setHistoricalRankings] = useState<Ranking[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [refreshingKeywordId, setRefreshingKeywordId] = useState<string | null>(null);

  useEffect(() => {
    fetchTracker();
    fetchHistoricalRankings();
  }, []);

  async function fetchTracker() {
    try {
      const response = await fetch("/api/rank-tracker");
      const data = await response.json();
      setTracker(data.tracker);
    } catch (error) {
      console.error("Error fetching tracker:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchHistoricalRankings(keywordId?: string) {
    try {
      const url = keywordId
        ? `/api/rank-tracker/rankings?keywordId=${keywordId}&days=30`
        : `/api/rank-tracker/rankings?days=30`;
      const response = await fetch(url);
      const data = await response.json();
      setHistoricalRankings(data.rankings || []);
    } catch (error) {
      console.error("Error fetching historical rankings:", error);
    }
  }

  async function handleAddKeyword(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyword.trim()) return;

    try {
      const response = await fetch("/api/rank-tracker/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: newKeyword.trim(),
          category: newCategory || null,
          targetUrl: newTargetUrl.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Fehler beim Hinzufügen des Keywords");
        return;
      }

      setNewKeyword("");
      setNewCategory("");
      setNewTargetUrl("");
      setShowAddForm(false);
      await fetchTracker();
    } catch (error) {
      console.error("Error adding keyword:", error);
      alert("Fehler beim Hinzufügen des Keywords");
    }
  }

  async function handleDeleteKeyword(id: string) {
    if (!confirm("Möchtest Du dieses Keyword wirklich löschen?")) return;

    try {
      const response = await fetch(`/api/rank-tracker/keywords/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        alert("Fehler beim Löschen des Keywords");
        return;
      }

      await fetchTracker();
      if (selectedKeyword === id) {
        setSelectedKeyword(null);
        fetchHistoricalRankings();
      } else {
        fetchHistoricalRankings(selectedKeyword || undefined);
      }
    } catch (error) {
      console.error("Error deleting keyword:", error);
      alert("Fehler beim Löschen des Keywords");
    }
  }

  async function handleFetchRankings() {
    setIsFetching(true);
    try {
      const response = await fetch("/api/rank-tracker/fetch", {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Fehler beim Abrufen der Rankings");
        return;
      }

      const data = await response.json();
      alert(data.message || "Rankings erfolgreich abgerufen");
      await fetchTracker();
      await fetchHistoricalRankings(selectedKeyword || undefined);
    } catch (error) {
      console.error("Error fetching rankings:", error);
      alert("Fehler beim Abrufen der Rankings");
    } finally {
      setIsFetching(false);
    }
  }

  async function handleRefreshKeyword(keywordId: string) {
    setRefreshingKeywordId(keywordId);
    try {
      const response = await fetch(`/api/rank-tracker/fetch?keywordId=${keywordId}`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Fehler beim Abrufen des Rankings");
        return;
      }

      await fetchTracker();
      await fetchHistoricalRankings(selectedKeyword || undefined);
    } catch (error) {
      console.error("Error refreshing keyword:", error);
      alert("Fehler beim Abrufen des Rankings");
    } finally {
      setRefreshingKeywordId(null);
    }
  }

  function handleKeywordSelect(keywordId: string) {
    if (selectedKeyword === keywordId) {
      setSelectedKeyword(null);
      fetchHistoricalRankings();
    } else {
      setSelectedKeyword(keywordId);
      fetchHistoricalRankings(keywordId);
    }
  }

  // Bereite Daten für Tabelle vor (mit Kategorie-Filter)
  const tableData = tracker?.keywords
    .filter((keyword) => {
      if (!categoryFilter) return true;
      if (categoryFilter === "__none__") return !keyword.category;
      return keyword.category === categoryFilter;
    })
    .map((keyword) => {
      const latestRanking = keyword.rankings[0];
      return {
        id: keyword.id,
        keyword: keyword.keyword,
        category: keyword.category,
        targetUrl: keyword.targetUrl || "ubs.com",
        position: latestRanking?.position ?? null,
        url: latestRanking?.url ?? null,
        lastUpdate: latestRanking?.date
          ? new Date(latestRanking.date).toLocaleDateString("de-DE")
          : "Nie",
      };
    }) || [];

  // Bereite Chart-Daten vor
  const chartData: Array<Record<string, unknown>> = [];
  if (selectedKeyword && historicalRankings.length > 0) {
    // Gruppiere nach Keyword
    const keywordRankings = historicalRankings.filter(
      (r) => r.keywordId === selectedKeyword
    );
    
    // Gruppiere nach Datum
    const byDate = new Map<string, number | null>();
    keywordRankings.forEach((r) => {
      const date = new Date(r.date).toLocaleDateString("de-DE");
      byDate.set(date, r.position);
    });

    // Sortiere nach Datum
    const sortedDates = Array.from(byDate.entries()).sort((a, b) => {
      return new Date(a[0].split(".").reverse().join("-")).getTime() -
        new Date(b[0].split(".").reverse().join("-")).getTime();
    });

    sortedDates.forEach(([date, position]) => {
      chartData.push({
        date,
        position: position ?? null,
      });
    });
  } else if (!selectedKeyword && historicalRankings.length > 0) {
    // Zeige alle Keywords zusammen
    const byDate = new Map<string, Array<{ keyword: string; position: number | null }>>();
    
    historicalRankings.forEach((r) => {
      const date = new Date(r.date).toLocaleDateString("de-DE");
      if (!byDate.has(date)) {
        byDate.set(date, []);
      }
      byDate.get(date)!.push({
        keyword: r.keyword.keyword,
        position: r.position,
      });
    });

    // Berechne Durchschnitt pro Datum
    const sortedDates = Array.from(byDate.entries()).sort((a, b) => {
      return new Date(a[0].split(".").reverse().join("-")).getTime() -
        new Date(b[0].split(".").reverse().join("-")).getTime();
    });

    sortedDates.forEach(([date, rankings]) => {
      const avgPosition =
        rankings.reduce((sum, r) => sum + (r.position ?? 100), 0) /
        rankings.length;
      chartData.push({
        date,
        position: avgPosition,
      });
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-8 bg-white dark:bg-slate-800 rounded animate-pulse w-48"></div>
        <div className="h-96 bg-white dark:bg-slate-800 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ranktracker</h1>
        <div className="flex items-center gap-3">
          {/* Kategorie-Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle Kategorien</option>
            <option value="__none__">Ohne Kategorie</option>
            {KEYWORD_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {canEditData && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg transition-colors"
            >
              {showAddForm ? "Abbrechen" : "Keyword hinzufügen"}
            </button>
          )}
          <button
            onClick={handleFetchRankings}
            disabled={!canEditData || isFetching || !tracker || tracker.keywords.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {isFetching ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Lädt...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Rankings abrufen
              </>
            )}
          </button>
        </div>
      </div>

      {showAddForm && canEditData && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Neues Keyword hinzufügen</h2>
          <form onSubmit={handleAddKeyword} className="space-y-4">
            <div>
              <label htmlFor="keyword" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Keyword *
              </label>
              <input
                id="keyword"
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="z.B. seo tools"
                required
                className="w-full px-4 py-2 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Kategorie (optional)
              </label>
              <select
                id="category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Keine Kategorie</option>
                {KEYWORD_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="targetUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Ziel-URL (optional)
              </label>
              <input
                id="targetUrl"
                type="text"
                value={newTargetUrl}
                onChange={(e) => setNewTargetUrl(e.target.value)}
                placeholder="ubs.com (Standard)"
                className="w-full px-4 py-2 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Standardmäßig wird nach ubs.com URLs gesucht. Du kannst eine andere Domain angeben.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                Hinzufügen
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewKeyword("");
                  setNewCategory("");
                  setNewTargetUrl("");
                }}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}

      {tracker && tracker.keywords.length > 0 ? (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Keywords & Rankings</h2>
            <DataTable
              data={tableData}
              columns={[
                {
                  key: "keyword",
                  header: "Keyword",
                  sortable: true,
                },
                {
                  key: "category",
                  header: "Kategorie",
                  sortable: true,
                  render: (value) => {
                    if (!value) {
                      return <span className="text-slate-500 dark:text-slate-500">-</span>;
                    }
                    return <span className="text-slate-700 dark:text-slate-300">{value as string}</span>;
                  },
                },
                {
                  key: "position",
                  header: "Position",
                  sortable: true,
                  render: (value) => {
                    if (value === null) {
                      return <span className="text-slate-500 dark:text-slate-500">-</span>;
                    }
                    const pos = value as number;
                    let color = "text-red-600 dark:text-red-400";
                    if (pos <= 3) color = "text-green-600 dark:text-green-400";
                    else if (pos <= 10) color = "text-yellow-600 dark:text-yellow-400";
                    return <span className={color}>{pos}</span>;
                  },
                },
                {
                  key: "url",
                  header: "Ranking URL",
                  render: (value) => {
                    if (!value) return <span className="text-slate-500 dark:text-slate-500">-</span>;
                    return (
                      <a
                        href={value as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 truncate max-w-md block"
                      >
                        {value as string}
                      </a>
                    );
                  },
                },
                {
                  key: "lastUpdate",
                  header: "Letzte Aktualisierung",
                  sortable: true,
                },
                {
                  key: "actions",
                  header: "Aktionen",
                  render: (_, row) => (
                    <div className="flex gap-2 items-center">
                      {canEditData && (
                        <button
                          onClick={() => handleRefreshKeyword(row.id as string)}
                          disabled={refreshingKeywordId === row.id}
                          className="p-1.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Ranking aktualisieren"
                        >
                          <svg
                            className={`w-4 h-4 ${refreshingKeywordId === row.id ? "animate-spin" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => handleKeywordSelect(row.id as string)}
                        className={`px-3 py-1 text-xs rounded ${
                          selectedKeyword === row.id
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                        }`}
                      >
                        {selectedKeyword === row.id ? "Ausgewählt" : "Auswählen"}
                      </button>
                      {canEditData && (
                        <button
                          onClick={() => handleDeleteKeyword(row.id as string)}
                          className="px-3 py-1 text-xs rounded bg-red-600/20 text-red-400 hover:bg-red-600/30"
                        >
                          Löschen
                        </button>
                      )}
                    </div>
                  ),
                },
              ]}
              keyField="id"
            />
          </div>

          {chartData.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Ranking-Verlauf {selectedKeyword ? `(${tracker.keywords.find(k => k.id === selectedKeyword)?.keyword})` : "(Durchschnitt)"}
              </h2>
              <LineChart
                data={chartData}
                xKey="date"
                lines={[
                  { key: "position", name: "Position", color: "#3b82f6" },
                ]}
                height={300}
              />
            </div>
          )}
        </>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-12 border border-slate-200 dark:border-slate-700 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Noch keine Keywords</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {canEditData 
              ? "Füge Dein erstes Keyword hinzu, um Rankings zu tracken."
              : "Es sind noch keine Keywords vorhanden."}
          </p>
          {canEditData && (
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              Erstes Keyword hinzufügen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
