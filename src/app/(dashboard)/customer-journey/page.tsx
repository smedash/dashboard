"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { canEdit } from "@/lib/rbac";

interface ArticleUser {
  id: string;
  name: string | null;
  email: string;
}

interface Article {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  category: string | null;
  status: string;
  plannedDate: string | null;
  metaDescription: string | null;
  h1: string | null;
  schemaMarkup: string | null;
  location: string | null;
  journeyPhase: string | null;
  creator: ArticleUser;
  createdAt: string;
  updatedAt: string;
}

const JOURNEY_PHASES = [
  {
    id: "awareness",
    label: "Bewusstsein",
    sublabel: "Awareness",
    description: "Emotionaler Einstieg, erster Impuls",
    examples: "Miete vs. Kauf, Bedeutung der HHV",
    color: "from-sky-400 to-sky-500",
    bgLight: "bg-sky-50 dark:bg-sky-900/20",
    borderColor: "border-sky-200 dark:border-sky-800",
    textColor: "text-sky-700 dark:text-sky-300",
    badgeColor: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    dotColor: "bg-sky-400",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    id: "orientation",
    label: "Orientierung",
    sublabel: "Consideration",
    description: "Wissensaufbau, Grundbegriffe",
    examples: "Maximalbeitrag, Testament, Zinsen, Eigenkapital",
    color: "from-violet-400 to-violet-500",
    bgLight: "bg-violet-50 dark:bg-violet-900/20",
    borderColor: "border-violet-200 dark:border-violet-800",
    textColor: "text-violet-700 dark:text-violet-300",
    badgeColor: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
    dotColor: "bg-violet-400",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    id: "planning",
    label: "Planung",
    sublabel: "Intent",
    description: "Konkrete Zahlen, Rendite, Modelle",
    examples: "Budget, Förderung prüfen, Renditerechner",
    color: "from-amber-400 to-amber-500",
    bgLight: "bg-amber-50 dark:bg-amber-900/20",
    borderColor: "border-amber-200 dark:border-amber-800",
    textColor: "text-amber-700 dark:text-amber-300",
    badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    dotColor: "bg-amber-400",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: "product_search",
    label: "Produkt & Objektsuche",
    sublabel: "Evaluation",
    description: "Immobilie suchen, bewerten, Vorsorgeprodukte",
    examples: "Produkte vergleichen, Bewertung, Besichtigung",
    color: "from-emerald-400 to-emerald-500",
    bgLight: "bg-emerald-50 dark:bg-emerald-900/20",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    textColor: "text-emerald-700 dark:text-emerald-300",
    badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    dotColor: "bg-emerald-400",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    id: "closing",
    label: "Abschluss",
    sublabel: "Decision",
    description: "Vergleichen, beantragen, kaufen",
    examples: "Banken vergleichen, Kredit beantragen, Notar",
    color: "from-rose-400 to-rose-500",
    bgLight: "bg-rose-50 dark:bg-rose-900/20",
    borderColor: "border-rose-200 dark:border-rose-800",
    textColor: "text-rose-700 dark:text-rose-300",
    badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    dotColor: "bg-rose-400",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
] as const;

const CATEGORIES = [
  "Mortgages",
  "Accounts&Cards",
  "Investing",
  "Pension",
  "Digital Banking",
] as const;

const LOCATIONS = ["Guide", "Insights"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  "Mortgages": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "Accounts&Cards": "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  "Investing": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  "Pension": "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  "Digital Banking": "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
};

const CATEGORY_BAR_COLORS: Record<string, string> = {
  "Mortgages": "bg-amber-400",
  "Accounts&Cards": "bg-sky-400",
  "Investing": "bg-emerald-400",
  "Pension": "bg-violet-400",
  "Digital Banking": "bg-rose-400",
};

const STATUSES: Record<string, string> = {
  idea: "Idee",
  planned: "Geplant",
  in_progress: "In Arbeit",
  in_review: "Review",
  published: "Publiziert",
};

export default function CustomerJourneyPage() {
  const { data: session } = useSession();
  const userCanEdit = canEdit(session?.user?.role);

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterLocation, setFilterLocation] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(
    new Set()
  );
  const [showUnassigned, setShowUnassigned] = useState(true);

  const [classifying, setClassifying] = useState(false);
  const [classifyResult, setClassifyResult] = useState<{
    classified: number;
    total: number;
    results: Array<{ id: string; phase: string; confidence: string; reason: string }>;
  } | null>(null);
  const [classifyMode, setClassifyMode] = useState<"unassigned" | "all">("unassigned");

  const [suggestPhase, setSuggestPhase] = useState<string | null>(null);
  const [suggestCategory, setSuggestCategory] = useState<string>("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ title: string; reason: string }> | null>(null);
  const [suggestMeta, setSuggestMeta] = useState<{ phase: string; category: string; existingCount: number } | null>(null);
  const [savedSuggestions, setSavedSuggestions] = useState<Set<number>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  const fetchArticles = useCallback(async () => {
    try {
      const res = await fetch("/api/editorial-plan");
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles);
      }
    } catch (error) {
      console.error("Error fetching articles:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const updateJourneyPhase = async (articleId: string, phase: string | null) => {
    setUpdatingId(articleId);
    try {
      const res = await fetch("/api/editorial-plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: articleId, journeyPhase: phase }),
      });
      if (res.ok) {
        setArticles((prev) =>
          prev.map((a) => (a.id === articleId ? { ...a, journeyPhase: phase } : a))
        );
      }
    } catch (error) {
      console.error("Error updating journey phase:", error);
    } finally {
      setUpdatingId(null);
    }
  };

  const classifyArticles = async (mode: "unassigned" | "all") => {
    setClassifying(true);
    setClassifyResult(null);
    try {
      const res = await fetch("/api/editorial-plan/classify-journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overwrite: mode === "all" }),
      });
      if (res.ok) {
        const data = await res.json();
        setClassifyResult(data);
        await fetchArticles();
      } else {
        const err = await res.json();
        setClassifyResult({ classified: 0, total: 0, results: [], ...err });
      }
    } catch (error) {
      console.error("Error classifying articles:", error);
    } finally {
      setClassifying(false);
    }
  };

  const openSuggestDialog = (phaseId: string) => {
    setSuggestPhase(phaseId);
    setSuggestCategory("");
    setSuggestions(null);
    setSuggestMeta(null);
    setSavedSuggestions(new Set());
  };

  const closeSuggestDialog = () => {
    setSuggestPhase(null);
    setSuggestCategory("");
    setSuggestions(null);
    setSuggestMeta(null);
    setSavedSuggestions(new Set());
    setSavingIndex(null);
  };

  const fetchSuggestions = async () => {
    if (!suggestPhase || !suggestCategory) return;
    setSuggesting(true);
    setSuggestions(null);
    setSavedSuggestions(new Set());
    try {
      const res = await fetch("/api/editorial-plan/suggest-titles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: suggestPhase, category: suggestCategory }),
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions);
        setSuggestMeta({ phase: data.phase, category: data.category, existingCount: data.existingCount });
      } else {
        console.error("Error fetching suggestions");
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    } finally {
      setSuggesting(false);
    }
  };

  const saveSuggestion = async (index: number, title: string) => {
    if (!suggestPhase || !suggestCategory) return;
    setSavingIndex(index);
    try {
      const res = await fetch("/api/editorial-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category: suggestCategory,
          journeyPhase: suggestPhase,
          status: "idea",
        }),
      });
      if (res.ok) {
        setSavedSuggestions((prev) => new Set(prev).add(index));
        await fetchArticles();
      }
    } catch (error) {
      console.error("Error saving suggestion:", error);
    } finally {
      setSavingIndex(null);
    }
  };

  const filteredArticles = articles.filter((a) => {
    if (filterCategory && a.category !== filterCategory) return false;
    if (filterLocation && a.location !== filterLocation) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !a.title.toLowerCase().includes(q) &&
        !a.metaDescription?.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const getArticlesForPhase = (phaseId: string) =>
    filteredArticles.filter((a) => a.journeyPhase === phaseId);

  const unassignedArticles = filteredArticles.filter((a) => !a.journeyPhase);

  const totalAssigned = filteredArticles.filter((a) => a.journeyPhase).length;
  const totalUnassigned = unassignedArticles.length;

  const getCategoryBreakdown = (phaseId: string) => {
    const phaseArticles = getArticlesForPhase(phaseId);
    const breakdown: Record<string, number> = {};
    CATEGORIES.forEach((c) => {
      const count = phaseArticles.filter((a) => a.category === c).length;
      if (count > 0) breakdown[c] = count;
    });
    const noCategory = phaseArticles.filter((a) => !a.category).length;
    if (noCategory > 0) breakdown["Ohne Kategorie"] = noCategory;
    return breakdown;
  };

  const togglePhase = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  const maxPhaseCount = Math.max(
    ...JOURNEY_PHASES.map((p) => getArticlesForPhase(p.id).length),
    1
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Customer Journey
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {totalAssigned} von {filteredArticles.length} Artikeln zugeordnet
            {totalUnassigned > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {" "}· {totalUnassigned} ohne Phase
              </span>
            )}
          </p>
        </div>
        {userCanEdit && (
          <div className="flex items-center gap-2">
            <select
              value={classifyMode}
              onChange={(e) => setClassifyMode(e.target.value as "unassigned" | "all")}
              disabled={classifying}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              <option value="unassigned">Nur nicht zugeordnete ({totalUnassigned})</option>
              <option value="all">Alle Artikel neu klassifizieren ({filteredArticles.length})</option>
            </select>
            <button
              onClick={() => classifyArticles(classifyMode)}
              disabled={classifying || (classifyMode === "unassigned" && totalUnassigned === 0)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                classifying
                  ? "bg-purple-400 text-white cursor-wait"
                  : "bg-purple-600 text-white hover:bg-purple-700"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {classifying ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Claude klassifiziert...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                  </svg>
                  KI-Zuordnung starten
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Classification Result Banner */}
      {classifyResult && (
        <div className={`rounded-xl border p-4 ${
          classifyResult.classified > 0
            ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
            : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {classifyResult.classified} von {classifyResult.total} Artikeln klassifiziert
                </p>
                {classifyResult.results.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {classifyResult.results.slice(0, 10).map((r) => {
                      const phase = JOURNEY_PHASES.find((p) => p.id === r.phase);
                      return (
                        <div key={r.id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${phase?.badgeColor || "bg-slate-100 text-slate-600"}`}>
                            {phase?.label || r.phase}
                          </span>
                          <span className="truncate max-w-xs">
                            {articles.find((a) => a.id === r.id)?.title || r.id}
                          </span>
                          <span className="text-slate-400 shrink-0">
                            ({r.confidence}) {r.reason}
                          </span>
                        </div>
                      );
                    })}
                    {classifyResult.results.length > 10 && (
                      <p className="text-xs text-slate-400">
                        ... und {classifyResult.results.length - 10} weitere
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setClassifyResult(null)}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 shrink-0"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Titel suchen..."
            className="pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 w-64 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
        >
          <option value="">Alle Kategorien</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={filterLocation}
          onChange={(e) => setFilterLocation(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
        >
          <option value="">Alle Locations</option>
          {LOCATIONS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>

      {/* Funnel Overview */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
          Funnel-Übersicht
        </h2>
        <div className="flex items-end gap-3 h-40">
          {JOURNEY_PHASES.map((phase) => {
            const count = getArticlesForPhase(phase.id).length;
            const heightPercent = maxPhaseCount > 0 ? (count / maxPhaseCount) * 100 : 0;
            const breakdown = getCategoryBreakdown(phase.id);

            return (
              <div key={phase.id} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {count > 0 && (
                    <div className="flex flex-wrap justify-center gap-0.5 mb-1">
                      {Object.entries(breakdown).map(([cat, n]) => (
                        <span
                          key={cat}
                          className={`inline-block px-1 py-0 rounded text-[9px] font-medium ${
                            CATEGORY_COLORS[cat] || "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                          }`}
                          title={`${cat}: ${n}`}
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{count}</span>
                </div>
                <div className="w-full relative" style={{ height: "80px" }}>
                  <div
                    className={`absolute bottom-0 w-full rounded-t-lg bg-gradient-to-t ${phase.color} transition-all duration-500`}
                    style={{ height: `${Math.max(heightPercent, 4)}%` }}
                  />
                </div>
                <div className="text-center">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-tight">
                    {phase.label}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">
                    {phase.sublabel}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Arrow indicators between phases */}
        <div className="flex items-center mt-2 px-4">
          {JOURNEY_PHASES.map((_, i) => (
            <div key={i} className="flex-1 flex items-center">
              {i < JOURNEY_PHASES.length - 1 && (
                <div className="w-full flex items-center">
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                  <svg className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Category Heatmap */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
          Kategorien pro Journey-Phase
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Kategorie</th>
                {JOURNEY_PHASES.map((phase) => (
                  <th key={phase.id} className="text-center px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {phase.label}
                  </th>
                ))}
                <th className="text-center px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {CATEGORIES.map((cat) => {
                const catArticles = filteredArticles.filter((a) => a.category === cat);
                return (
                  <tr key={cat} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[cat]}`}>
                        {cat}
                      </span>
                    </td>
                    {JOURNEY_PHASES.map((phase) => {
                      const count = catArticles.filter((a) => a.journeyPhase === phase.id).length;
                      return (
                        <td key={phase.id} className="text-center px-3 py-2.5">
                          {count > 0 ? (
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${phase.badgeColor}`}>
                              {count}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">–</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center px-3 py-2.5">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                        {catArticles.filter((a) => a.journeyPhase).length}
                      </span>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50 dark:bg-slate-700/30 font-medium">
                <td className="px-3 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400">Total</td>
                {JOURNEY_PHASES.map((phase) => {
                  const count = getArticlesForPhase(phase.id).length;
                  return (
                    <td key={phase.id} className="text-center px-3 py-2.5">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{count}</span>
                    </td>
                  );
                })}
                <td className="text-center px-3 py-2.5">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{totalAssigned}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Journey Phases - Article Lists */}
      <div className="space-y-4">
        {JOURNEY_PHASES.map((phase) => {
          const phaseArticles = getArticlesForPhase(phase.id);
          const isExpanded = expandedPhases.has(phase.id);

          return (
            <div
              key={phase.id}
              className={`bg-white dark:bg-slate-800 rounded-xl border ${phase.borderColor} overflow-hidden`}
            >
              <button
                onClick={() => togglePhase(phase.id)}
                className={`w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors`}
              >
                <div className={`flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${phase.color} text-white shrink-0`}>
                  {phase.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {phase.label}
                    </h3>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {phase.sublabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {phase.description} · <span className="italic">{phase.examples}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold ${phase.badgeColor}`}>
                    {phaseArticles.length}
                  </span>
                  {userCanEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openSuggestDialog(phase.id);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50 transition-colors"
                      title="Neue Titelvorschläge von der KI generieren"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                      </svg>
                      Neue Titelvorschläge
                    </button>
                  )}
                  <svg
                    className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {isExpanded && phaseArticles.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-700/50">
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {phaseArticles.map((article) => (
                      <ArticleRow
                        key={article.id}
                        article={article}
                        userCanEdit={userCanEdit}
                        updatingId={updatingId}
                        onUpdatePhase={updateJourneyPhase}
                      />
                    ))}
                  </div>
                </div>
              )}

              {isExpanded && phaseArticles.length === 0 && (
                <div className="border-t border-slate-100 dark:border-slate-700/50 px-6 py-8 text-center">
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    Keine Artikel in dieser Phase
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Suggest Titles Modal */}
      {suggestPhase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 mx-4 p-6 flex flex-col ${suggestions ? "w-full max-w-2xl max-h-[85vh]" : "w-full max-w-md"}`}>
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${JOURNEY_PHASES.find((p) => p.id === suggestPhase)?.color} text-white shrink-0`}>
                  {JOURNEY_PHASES.find((p) => p.id === suggestPhase)?.icon}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Neue Titelvorschläge
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {JOURNEY_PHASES.find((p) => p.id === suggestPhase)?.label} – {JOURNEY_PHASES.find((p) => p.id === suggestPhase)?.sublabel}
                  </p>
                </div>
              </div>
              <button
                onClick={closeSuggestDialog}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Step 1: Category Selection */}
            {!suggestions && !suggesting && (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Für welche Kategorie möchtest du neue Titelvorschläge? Die KI gleicht dann mit den bestehenden Titeln dieser Kategorie ab.
                </p>
                <div className="space-y-2 mb-6">
                  {CATEGORIES.map((cat) => {
                    const count = articles.filter(
                      (a) => a.category === cat && a.journeyPhase === suggestPhase
                    ).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => setSuggestCategory(cat)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
                          suggestCategory === cat
                            ? "border-purple-400 bg-purple-50 dark:bg-purple-900/30 ring-2 ring-purple-400/30"
                            : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${CATEGORY_BAR_COLORS[cat]}`} />
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{cat}</span>
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {count} Artikel in Phase
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={closeSuggestDialog}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={fetchSuggestions}
                    disabled={!suggestCategory}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Vorschläge generieren
                  </button>
                </div>
              </>
            )}

            {/* Loading State */}
            {suggesting && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <svg className="w-8 h-8 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Claude generiert Titelvorschläge für <span className="font-bold text-purple-600 dark:text-purple-400">{suggestCategory}</span>...
                </p>
                <p className="text-xs text-slate-400">Das kann einige Sekunden dauern</p>
              </div>
            )}

            {/* Step 2: Suggestions List */}
            {suggestions && suggestMeta && (
              <>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[suggestMeta.category] || "bg-slate-100 text-slate-700"}`}>
                    {suggestMeta.category}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    · {suggestMeta.existingCount} bestehende Artikel abgeglichen · {suggestions.length} Vorschläge
                  </span>
                  {savedSuggestions.size > 0 && (
                    <span className="text-xs font-medium text-green-600 dark:text-green-400 ml-auto">
                      {savedSuggestions.size} gespeichert
                    </span>
                  )}
                </div>
                <div className="overflow-y-auto flex-1 -mx-6 px-6 divide-y divide-slate-100 dark:divide-slate-700/50 border-t border-b border-slate-100 dark:border-slate-700/50">
                  {suggestions.map((s, i) => {
                    const isSaved = savedSuggestions.has(i);
                    const isSaving = savingIndex === i;
                    return (
                      <div key={i} className="flex items-start gap-3 py-3">
                        <span className="text-xs font-bold text-purple-400 dark:text-purple-500 mt-1 shrink-0 w-5 text-right">
                          {i + 1}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {s.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {s.reason}
                          </p>
                        </div>
                        <button
                          onClick={() => saveSuggestion(i, s.title)}
                          disabled={isSaved || isSaving}
                          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors mt-0.5 ${
                            isSaved
                              ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-default"
                              : isSaving
                                ? "bg-purple-50 text-purple-500 dark:bg-purple-900/30 cursor-wait"
                                : "bg-slate-100 text-slate-700 hover:bg-purple-50 hover:text-purple-700 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-purple-900/30 dark:hover:text-purple-300"
                          }`}
                          title={isSaved ? "Bereits gespeichert" : "In Redaktionsplan speichern"}
                        >
                          {isSaved ? (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Gespeichert
                            </>
                          ) : isSaving ? (
                            <>
                              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Speichere...
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Speichern
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={() => {
                      setSuggestions(null);
                      setSuggestMeta(null);
                      setSuggestCategory("");
                      setSavedSuggestions(new Set());
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Andere Kategorie
                  </button>
                  <button
                    onClick={closeSuggestDialog}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors"
                  >
                    Fertig
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Unassigned Articles */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <button
          onClick={() => setShowUnassigned(!showUnassigned)}
          className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Nicht zugeordnet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Artikel ohne Journey-Phase – bitte einer Phase zuordnen
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {totalUnassigned > 0 && (
              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                {totalUnassigned}
              </span>
            )}
            <svg
              className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${showUnassigned ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {showUnassigned && unassignedArticles.length > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-700/50">
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {unassignedArticles.map((article) => (
                <ArticleRow
                  key={article.id}
                  article={article}
                  userCanEdit={userCanEdit}
                  updatingId={updatingId}
                  onUpdatePhase={updateJourneyPhase}
                />
              ))}
            </div>
          </div>
        )}

        {showUnassigned && unassignedArticles.length === 0 && (
          <div className="border-t border-slate-100 dark:border-slate-700/50 px-6 py-8 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Alle Artikel sind einer Phase zugeordnet
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ArticleRow({
  article,
  userCanEdit,
  updatingId,
  onUpdatePhase,
}: {
  article: Article;
  userCanEdit: boolean;
  updatingId: string | null;
  onUpdatePhase: (id: string, phase: string | null) => void;
}) {
  const isUpdating = updatingId === article.id;
  const currentPhase = JOURNEY_PHASES.find((p) => p.id === article.journeyPhase);

  return (
    <div className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate">
            {article.title}
          </h4>
          {article.category && (
            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${CATEGORY_COLORS[article.category] || "bg-slate-100 text-slate-700"}`}>
              {article.category}
            </span>
          )}
          {article.location && (
            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 shrink-0">
              {article.location}
            </span>
          )}
          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 shrink-0">
            {STATUSES[article.status] || article.status}
          </span>
        </div>
        {article.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-blue-500 dark:text-blue-400 hover:underline truncate block mt-0.5 max-w-md"
          >
            {article.url}
          </a>
        )}
      </div>
      {userCanEdit ? (
        <select
          value={article.journeyPhase || ""}
          onChange={(e) => onUpdatePhase(article.id, e.target.value || null)}
          disabled={isUpdating}
          className={`px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 shrink-0 min-w-[160px] focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            isUpdating ? "opacity-50" : ""
          }`}
        >
          <option value="">– Phase wählen –</option>
          {JOURNEY_PHASES.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      ) : (
        currentPhase && (
          <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-medium shrink-0 ${currentPhase.badgeColor}`}>
            {currentPhase.label}
          </span>
        )
      )}
    </div>
  );
}
