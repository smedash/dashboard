"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import changelogData from "@/data/changelog.json";

interface Commit {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  subject: string;
  type: string;
  typeLabel: string;
  scope: string | null;
  message: string;
}

interface ChangelogData {
  generatedAt: string;
  totalCommits: number;
  commits: Commit[];
  groupedByDate: Record<string, Commit[]>;
}

const data = changelogData as ChangelogData;
const DEFAULT_MINUTES = 30;

// Typ-Farben für Badges
function getTypeBadgeClasses(type: string): string {
  switch (type) {
    case "feat":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
    case "fix":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
    case "refactor":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    case "chore":
      return "bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400";
    case "docs":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300";
    case "perf":
      return "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300";
    case "style":
      return "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300";
    default:
      return "bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400";
  }
}

// Typ-Icon (Timeline-Dot)
function getTypeDotClasses(type: string): string {
  switch (type) {
    case "feat":
      return "bg-emerald-500 dark:bg-emerald-400";
    case "fix":
      return "bg-amber-500 dark:bg-amber-400";
    case "refactor":
      return "bg-blue-500 dark:bg-blue-400";
    case "docs":
      return "bg-purple-500 dark:bg-purple-400";
    case "perf":
      return "bg-rose-500 dark:bg-rose-400";
    default:
      return "bg-slate-400 dark:bg-slate-500";
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("de-DE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Heute";
  if (diffDays === 1) return "Gestern";
  if (diffDays < 7) return `Vor ${diffDays} Tagen`;
  if (diffDays < 30) return `Vor ${Math.floor(diffDays / 7)} Wochen`;
  if (diffDays < 365) return `Vor ${Math.floor(diffDays / 30)} Monaten`;
  return `Vor ${Math.floor(diffDays / 365)} Jahren`;
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins} Min.`;
  if (mins === 0) return `${hours} Std.`;
  return `${hours} Std. ${mins} Min.`;
}

// Verfügbare Commit-Typen aus den Daten extrahieren
function getAvailableTypes(commits: Commit[]): { type: string; label: string; count: number }[] {
  const typeMap = new Map<string, { label: string; count: number }>();
  commits.forEach((commit) => {
    const existing = typeMap.get(commit.type);
    if (existing) {
      existing.count++;
    } else {
      typeMap.set(commit.type, { label: commit.typeLabel, count: 1 });
    }
  });
  return Array.from(typeMap.entries())
    .map(([type, { label, count }]) => ({ type, label, count }))
    .sort((a, b) => b.count - a.count);
}

export default function ChangelogPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  // Live-Daten: statische JSON als Initial, dann live vom Server
  const [commits, setCommits] = useState<Commit[]>(data.commits);
  const [generatedAt, setGeneratedAt] = useState(data.generatedAt);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSource, setLastSource] = useState<string>("static");

  // Zeiterfassung: commitHash → minutes
  const [commitTimes, setCommitTimes] = useState<Record<string, number>>({});
  const [timesLoaded, setTimesLoaded] = useState(false);
  const [savingHash, setSavingHash] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Debounce-Timer Ref
  const saveTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Live-Commits vom Server laden
  const refreshCommits = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/changelog/commits");
      if (res.ok) {
        const result = await res.json();
        setCommits(result.commits);
        setGeneratedAt(result.generatedAt);
        setLastSource(result.source);
      }
    } catch (error) {
      console.error("Fehler beim Aktualisieren:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Zeiten vom Server laden
  useEffect(() => {
    async function loadTimes() {
      try {
        const res = await fetch("/api/changelog/times");
        if (res.ok) {
          const serverTimes = await res.json();
          setCommitTimes(serverTimes);
        }
      } catch (error) {
        console.error("Fehler beim Laden der Zeiten:", error);
      } finally {
        setTimesLoaded(true);
      }
    }

    async function checkRole() {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = await res.json();
          const role = session?.user?.role;
          if (role === "superadmin" || role === "agentur") {
            setIsAdmin(true);
          }
        }
      } catch {
        // Ignorieren
      }
    }

    loadTimes();
    checkRole();
    // Automatisch live Commits laden
    refreshCommits();
  }, [refreshCommits]);

  // Zeit für einen Commit holen (mit Default)
  const getMinutes = useCallback(
    (commitHash: string): number => {
      return commitTimes[commitHash] ?? DEFAULT_MINUTES;
    },
    [commitTimes]
  );

  // Zeit speichern (debounced)
  const saveTime = useCallback(
    (commitHash: string, minutes: number) => {
      // Lokal sofort aktualisieren
      setCommitTimes((prev) => ({ ...prev, [commitHash]: minutes }));

      // Vorherigen Timer abbrechen
      if (saveTimerRef.current[commitHash]) {
        clearTimeout(saveTimerRef.current[commitHash]);
      }

      // Neuen Timer setzen (500ms Debounce)
      saveTimerRef.current[commitHash] = setTimeout(async () => {
        setSavingHash(commitHash);
        try {
          await fetch("/api/changelog/times", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ commitHash, minutes }),
          });
        } catch (error) {
          console.error("Fehler beim Speichern:", error);
        } finally {
          setSavingHash(null);
        }
      }, 500);
    },
    []
  );

  const availableTypes = useMemo(() => getAvailableTypes(commits), [commits]);

  // Gefilterte Commits
  const filteredCommits = useMemo(() => {
    let filtered = commits;

    // Typ-Filter (standardmässig chore/ci/build ausblenden)
    if (selectedTypes.size > 0) {
      filtered = filtered.filter((c) => selectedTypes.has(c.type));
    } else if (!showAll) {
      filtered = filtered.filter((c) => !["chore", "ci", "build"].includes(c.type));
    }

    // Suchfilter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.message.toLowerCase().includes(query) ||
          (c.scope && c.scope.toLowerCase().includes(query)) ||
          c.typeLabel.toLowerCase().includes(query) ||
          c.subject.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [commits, searchQuery, selectedTypes, showAll]);

  // Nach Datum gruppieren
  const groupedCommits = useMemo(() => {
    const grouped: Record<string, Commit[]> = {};
    filteredCommits.forEach((commit) => {
      const dateKey = commit.date.substring(0, 10);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(commit);
    });
    return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredCommits]);

  // Stats (inkl. Gesamtzeit)
  const stats = useMemo(() => {
    const features = commits.filter((c) => c.type === "feat").length;
    const fixes = commits.filter((c) => c.type === "fix").length;
    const refactors = commits.filter((c) => c.type === "refactor").length;
    const uniqueDates = new Set(commits.map((c) => c.date.substring(0, 10))).size;

    // Gesamtzeit: alle Commits (nicht nur gefilterte)
    const totalMinutes = commits.reduce(
      (sum, c) => sum + (commitTimes[c.shortHash] ?? DEFAULT_MINUTES),
      0
    );

    return { features, fixes, refactors, uniqueDates, totalMinutes, total: commits.length };
  }, [commits, commitTimes]);

  // Tageszeit berechnen
  const getDayMinutes = useCallback(
    (commits: Commit[]): number => {
      return commits.reduce(
        (sum, c) => sum + (commitTimes[c.shortHash] ?? DEFAULT_MINUTES),
        0
      );
    },
    [commitTimes]
  );

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Changelog
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Alle Entwicklungsschritte und Updates im Überblick. Stand:{" "}
            {new Date(generatedAt).toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {lastSource !== "static" && (
              <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
                (Live)
              </span>
            )}
          </p>
        </div>
        <button
          onClick={refreshCommits}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium transition-colors shrink-0"
        >
          <svg
            className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isRefreshing ? "Aktualisiere..." : "Aktualisieren"}
        </button>
      </div>

      {/* Statistik-Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {/* Gesamtzeit - hervorgehoben */}
        <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 rounded-xl p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {timesLoaded ? formatMinutes(stats.totalMinutes) : "..."}
              </p>
              <p className="text-xs text-blue-100">
                Gesamtaufwand{timesLoaded && stats.totalMinutes >= 480 ? ` (${(stats.totalMinutes / 480).toFixed(1)} Arbeitstage)` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.features}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Features</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.fixes}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Bugfixes</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.refactors}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Refactorings</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.uniqueDates}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Aktive Tage</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter-Leiste */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Suche */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Suche in Änderungen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          {/* Alle anzeigen Toggle */}
          <button
            onClick={() => {
              setShowAll(!showAll);
              setSelectedTypes(new Set());
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              showAll
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            Alle anzeigen
          </button>
        </div>

        {/* Typ-Filter Tags */}
        <div className="flex flex-wrap gap-2 mt-3">
          {availableTypes.map(({ type, label, count }) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedTypes.has(type)
                  ? getTypeBadgeClasses(type) + " ring-2 ring-offset-1 ring-blue-500 dark:ring-offset-slate-800"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              {label}
              <span className="text-[10px] opacity-70">({count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Ergebnis-Info */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {filteredCommits.length} von {stats.total} Änderungen
        </p>
      </div>

      {/* Timeline */}
      <div className="space-y-8">
        {groupedCommits.map(([dateKey, commits]) => {
          const dayMinutes = getDayMinutes(commits);
          return (
            <div key={dateKey}>
              {/* Datums-Header */}
              <div className="sticky top-0 z-10 mb-4 -mx-4 px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      {formatDate(dateKey)}
                    </h2>
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
                      {formatRelativeDate(dateKey)}
                    </span>
                  </div>
                  <div className="flex-1" />
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatMinutes(dayMinutes)}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">|</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      {commits.length} {commits.length === 1 ? "Änderung" : "Änderungen"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Commits des Tages */}
              <div className="relative ml-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-1">
                {commits.map((commit) => (
                  <div
                    key={commit.hash}
                    className="relative pl-6 pb-4 group"
                  >
                    {/* Timeline Dot */}
                    <div
                      className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${getTypeDotClasses(commit.type)} transition-transform group-hover:scale-125`}
                    />

                    {/* Commit Card */}
                    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600">
                      <div className="flex flex-wrap items-start gap-2">
                        {/* Typ Badge */}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getTypeBadgeClasses(commit.type)}`}
                        >
                          {commit.typeLabel}
                        </span>

                        {/* Scope Badge */}
                        {commit.scope && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                            {commit.scope}
                          </span>
                        )}

                        {/* Commit Message */}
                        <p className="flex-1 text-sm text-slate-800 dark:text-slate-200 font-medium min-w-0">
                          {commit.message}
                        </p>

                        {/* Minuten-Eingabe */}
                        <div className="flex items-center gap-1 shrink-0">
                          {isAdmin ? (
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                min={0}
                                max={999}
                                value={getMinutes(commit.shortHash)}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  saveTime(commit.shortHash, Math.max(0, Math.min(999, val)));
                                }}
                                className="w-14 px-1.5 py-0.5 text-xs text-right rounded border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">Min.</span>
                              {savingHash === commit.shortHash && (
                                <div className="absolute -right-5 top-1/2 -translate-y-1/2">
                                  <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {getMinutes(commit.shortHash)} Min.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Meta-Info */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 dark:text-slate-500">
                        <span className="font-mono">{commit.shortHash}</span>
                        <span className="hidden sm:inline">•</span>
                        <span className="hidden sm:inline">smedash</span>
                        <span>•</span>
                        <span>
                          {new Date(commit.date).toLocaleTimeString("de-DE", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leerer Zustand */}
      {filteredCommits.length === 0 && (
        <div className="text-center py-16">
          <svg
            className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Keine Änderungen gefunden.
          </p>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
            Versuche einen anderen Suchbegriff oder ändere die Filter.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 mb-8 text-center">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Basierend auf {stats.total} Git-Commits &middot; Gesamtaufwand: {formatMinutes(stats.totalMinutes)}
        </p>
      </div>
    </div>
  );
}
