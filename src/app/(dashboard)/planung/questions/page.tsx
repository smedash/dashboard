"use client";

import { useState, useEffect } from "react";

interface QuestionResult {
  id: string;
  keyword: string;
  questions: string[];
  createdAt: string;
  cached?: boolean;
}

export default function QuestionsPage() {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<QuestionResult | null>(null);
  const [history, setHistory] = useState<QuestionResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      const res = await fetch("/api/questions");
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
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim() }),
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
      const res = await fetch(`/api/questions?id=${id}`, { method: "DELETE" });
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

  function handleSelectHistory(item: QuestionResult) {
    setCurrentResult(item);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Question based
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Finde die 20 häufigsten Fragen zu einem Keyword — generiert via KI und persistent gespeichert.
        </p>
      </div>

      {/* Eingabeformular */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Keyword eingeben, z.B. 'hypothek', 'vorsorge 3a'..."
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !keyword.trim()}
          className="px-6 py-3 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generiere...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Fragen generieren
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ergebnis-Bereich */}
        <div className="lg:col-span-2">
          {currentResult ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Fragen zu &ldquo;{currentResult.keyword}&rdquo;
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {currentResult.cached ? "Aus Cache geladen" : "Frisch generiert"} &middot;{" "}
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
                  {currentResult.questions.length} Fragen
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {currentResult.questions.map((question, index) => (
                  <div
                    key={index}
                    className="px-6 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 pt-1">
                      {question}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-white">
                Keyword eingeben
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Gib ein Keyword ein, um die 20 häufigsten Fragen dazu zu erhalten.
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
