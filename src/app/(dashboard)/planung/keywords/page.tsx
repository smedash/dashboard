"use client";

import { useState, useEffect } from "react";

interface KeywordSuggestionItem {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  difficulty: number | null;
  searchIntents: string[] | null;
  serpItemTypes: string[];
}

interface KeywordSuggestionResult {
  id: string;
  keyword: string;
  countryCode: string;
  languageCode: string;
  totalCount: number;
  suggestions: KeywordSuggestionItem[];
  createdAt: string;
  cached?: boolean;
}

function IntentBadge({ intent }: { intent: string }) {
  const colors: Record<string, string> = {
    informational: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    navigational: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    commercial: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    transactional: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${colors[intent] || "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
      {intent.charAt(0).toUpperCase() + intent.slice(1)}
    </span>
  );
}

function DifficultyBar({ value }: { value: number }) {
  const color = value <= 30 ? "bg-green-500" : value <= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400">{value}</span>
    </div>
  );
}

export default function KeywordsPage() {
  const [keyword, setKeyword] = useState("");
  const [countryCode, setCountryCode] = useState("ch");
  const [languageCode, setLanguageCode] = useState("de");
  const [loading, setLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<KeywordSuggestionResult | null>(null);
  const [history, setHistory] = useState<KeywordSuggestionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"searchVolume" | "difficulty" | "cpc" | "competition">("searchVolume");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      const res = await fetch("/api/keyword-suggestions");
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch {
      // silently fail
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!keyword.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/keyword-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim(), country_code: countryCode, language_code: languageCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ein Fehler ist aufgetreten");
        return;
      }

      setCurrentResult(data);
      setKeyword("");
      fetchHistory();
    } catch {
      setError("Netzwerkfehler - bitte erneut versuchen");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/keyword-suggestions?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setHistory((prev) => prev.filter((h) => h.id !== id));
        if (currentResult?.id === id) {
          setCurrentResult(null);
        }
      }
    } catch {
      // silently fail
    }
  }

  function handleSelectHistory(item: KeywordSuggestionResult) {
    setCurrentResult(item);
  }

  function handleSort(field: typeof sortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const sortedSuggestions = currentResult
    ? [...currentResult.suggestions].sort((a, b) => {
        const aVal = a[sortField] ?? -1;
        const bVal = b[sortField] ?? -1;
        return sortDir === "desc" ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
      })
    : [];

  function SortIcon({ field }: { field: typeof sortField }) {
    if (sortField !== field) return null;
    return (
      <svg className="w-3 h-3 ml-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDir === "desc" ? "M19 9l-7 7-7-7" : "M5 15l7-7 7 7"} />
      </svg>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Keyword based
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Finde Keyword-Vorschläge zu einem Seed-Keyword via SEOspark — inkl. Suchvolumen, Difficulty und Search Intent.
        </p>
      </div>

      {/* Eingabeformular */}
      <form onSubmit={handleSubmit} className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Seed-Keyword</label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="z.B. 'hypothek', 'vorsorge'..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
        </div>
        <div className="w-36">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Land</label>
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            <option value="ch">Schweiz</option>
            <option value="de">Deutschland</option>
            <option value="at">Österreich</option>
            <option value="us">USA</option>
            <option value="gb">UK</option>
            <option value="fr">Frankreich</option>
            <option value="it">Italien</option>
          </select>
        </div>
        <div className="w-36">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Sprache</label>
          <select
            value={languageCode}
            onChange={(e) => setLanguageCode(e.target.value)}
            className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          >
            <option value="de">Deutsch</option>
            <option value="en">Englisch</option>
            <option value="fr">Französisch</option>
            <option value="it">Italienisch</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={loading || !keyword.trim()}
          className="px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Suche...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Keywords finden
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Ergebnis-Tabelle */}
        <div className="lg:col-span-3">
          {currentResult ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Keywords zu &ldquo;{currentResult.keyword}&rdquo;
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {currentResult.cached ? "Aus Cache geladen" : "Frisch abgerufen"} &middot;{" "}
                    {currentResult.totalCount.toLocaleString("de-CH")} Keywords insgesamt &middot;{" "}
                    {new Date(currentResult.createdAt).toLocaleDateString("de-CH", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/30 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                  {currentResult.suggestions.length} angezeigt
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                        Keyword
                      </th>
                      <th
                        className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
                        onClick={() => handleSort("searchVolume")}
                      >
                        Suchvolumen <SortIcon field="searchVolume" />
                      </th>
                      <th
                        className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
                        onClick={() => handleSort("difficulty")}
                      >
                        Difficulty <SortIcon field="difficulty" />
                      </th>
                      <th
                        className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
                        onClick={() => handleSort("cpc")}
                      >
                        CPC <SortIcon field="cpc" />
                      </th>
                      <th
                        className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
                        onClick={() => handleSort("competition")}
                      >
                        Competition <SortIcon field="competition" />
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                        Intent
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {sortedSuggestions.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                          {item.keyword}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                          {item.searchVolume != null ? item.searchVolume.toLocaleString("de-CH") : "–"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.difficulty != null ? <DifficultyBar value={item.difficulty} /> : <span className="text-slate-400">–</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                          {item.cpc != null ? `$${item.cpc.toFixed(2)}` : "–"}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                          {item.competition != null ? (item.competition * 100).toFixed(0) + "%" : "–"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {item.searchIntents?.map((intent, i) => (
                              <IntentBadge key={i} intent={intent} />
                            )) || <span className="text-slate-400">–</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-white">
                Seed-Keyword eingeben
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Gib ein Keyword ein, um verwandte Keyword-Vorschläge mit Metriken zu erhalten.
              </p>
            </div>
          )}
        </div>

        {/* History-Sidebar */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Bisherige Abfragen
              </h3>
            </div>
            {history.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Noch keine Abfragen gespeichert
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[500px] overflow-y-auto">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className={`px-4 py-3 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors ${
                      currentResult?.id === item.id ? "bg-blue-50 dark:bg-blue-900/20" : ""
                    }`}
                    onClick={() => handleSelectHistory(item)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {item.keyword}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {item.totalCount.toLocaleString("de-CH")} Keywords &middot;{" "}
                        {new Date(item.createdAt).toLocaleDateString("de-CH")}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      className="flex-shrink-0 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Löschen"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
