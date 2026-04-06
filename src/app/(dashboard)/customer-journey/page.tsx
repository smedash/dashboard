"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { canEdit } from "@/lib/rbac";

interface Article {
  id: string;
  title: string;
  url: string | null;
  category: string | null;
  status: string;
  location: string | null;
  journeyPhase: string | null;
  journeyConfidence: number | null;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

interface PhaseData {
  articles: Article[];
  pagination: PaginationInfo | null;
  loading: boolean;
}

interface JourneyStats {
  stats: Record<string, Record<string, number>>;
  totalCount: number;
  totalAssigned: number;
  totalUnassigned: number;
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
  "Credit Suisse",
  "Investor Relations",
  "Legal",
  "Media",
  "Payments",
  "Yumo",
  "Wealthmanagement",
  "Assetmanagement",
] as const;

const LOCATIONS = ["Guide", "Insights", "CH Market", "Global", "Microsites", "Minisites"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  "Mortgages": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "Accounts&Cards": "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  "Investing": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  "Pension": "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  "Digital Banking": "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  "Credit Suisse": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "Investor Relations": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  "Legal": "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
  "Media": "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  "Payments": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "Yumo": "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300",
  "Wealthmanagement": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  "Assetmanagement": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
};

const CATEGORY_BAR_COLORS: Record<string, string> = {
  "Mortgages": "bg-amber-400",
  "Accounts&Cards": "bg-sky-400",
  "Investing": "bg-emerald-400",
  "Pension": "bg-violet-400",
  "Digital Banking": "bg-rose-400",
  "Credit Suisse": "bg-blue-400",
  "Investor Relations": "bg-cyan-400",
  "Legal": "bg-slate-400",
  "Media": "bg-pink-400",
  "Payments": "bg-orange-400",
  "Yumo": "bg-lime-400",
  "Wealthmanagement": "bg-teal-400",
  "Assetmanagement": "bg-indigo-400",
};

const STATUSES: Record<string, string> = {
  idea: "Idee",
  planned: "Geplant",
  in_progress: "In Arbeit",
  in_review: "Review",
  published: "Publiziert",
};

const PAGE_SIZE = 50;

function buildFilterParams(filters: { category: string; location: string; search: string }) {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.location) params.set("location", filters.location);
  if (filters.search) params.set("search", filters.search);
  return params;
}

export default function CustomerJourneyPage() {
  const { data: session } = useSession();
  const userCanEdit = canEdit(session?.user?.role);

  const [journeyStats, setJourneyStats] = useState<JourneyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterLocation, setFilterLocation] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [showUnassigned, setShowUnassigned] = useState(false);

  const [phaseData, setPhaseData] = useState<Record<string, PhaseData>>({});

  const [classifying, setClassifying] = useState(false);
  const [classifyProgress, setClassifyProgress] = useState<{
    classified: number;
    remaining: number;
    totalToProcess: number;
    currentBatch: number;
    totalBatches: number;
  } | null>(null);
  const [classifyResult, setClassifyResult] = useState<{
    classified: number;
    total: number;
    cancelled?: boolean;
  } | null>(null);
  const [classifyMode, setClassifyMode] = useState<"unassigned" | "all">("unassigned");
  const classifyCancelledRef = useRef(false);

  const [suggestPhase, setSuggestPhase] = useState<string | null>(null);
  const [suggestCategory, setSuggestCategory] = useState<string>("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ title: string; reason: string }> | null>(null);
  const [suggestMeta, setSuggestMeta] = useState<{ phase: string; category: string; existingCount: number } | null>(null);
  const [savedSuggestions, setSavedSuggestions] = useState<Set<number>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const loadingInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (suggesting) {
      setLoadingMsgIndex(0);
      loadingInterval.current = setInterval(() => {
        setLoadingMsgIndex((prev) => (prev + 1) % 5);
      }, 3000);
    } else {
      if (loadingInterval.current) {
        clearInterval(loadingInterval.current);
        loadingInterval.current = null;
      }
    }
    return () => {
      if (loadingInterval.current) clearInterval(loadingInterval.current);
    };
  }, [suggesting]);

  const filters = useMemo(
    () => ({ category: filterCategory, location: filterLocation, search: debouncedSearch }),
    [filterCategory, filterLocation, debouncedSearch]
  );

  const fetchStats = useCallback(async () => {
    try {
      const params = buildFilterParams(filters);
      const res = await fetch(`/api/editorial-plan/journey-stats?${params}`);
      if (res.ok) {
        const data: JourneyStats = await res.json();
        setJourneyStats(data);
      }
    } catch (error) {
      console.error("Error fetching journey stats:", error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    setLoading(true);
    fetchStats();
  }, [fetchStats]);

  const fetchPhaseArticles = useCallback(
    async (phaseKey: string, page: number = 1) => {
      setPhaseData((prev) => ({
        ...prev,
        [phaseKey]: { ...prev[phaseKey], loading: true, articles: prev[phaseKey]?.articles || [], pagination: prev[phaseKey]?.pagination || null },
      }));

      try {
        const params = buildFilterParams(filters);
        params.set("journeyPhase", phaseKey);
        params.set("page", String(page));
        params.set("pageSize", String(PAGE_SIZE));

        const res = await fetch(`/api/editorial-plan?${params}`);
        if (res.ok) {
          const data = await res.json();
          setPhaseData((prev) => {
            const existing = page > 1 ? (prev[phaseKey]?.articles || []) : [];
            return {
              ...prev,
              [phaseKey]: {
                articles: [...existing, ...data.articles],
                pagination: data.pagination,
                loading: false,
              },
            };
          });
        }
      } catch (error) {
        console.error(`Error fetching articles for phase ${phaseKey}:`, error);
        setPhaseData((prev) => ({
          ...prev,
          [phaseKey]: { ...prev[phaseKey], loading: false, articles: prev[phaseKey]?.articles || [], pagination: prev[phaseKey]?.pagination || null },
        }));
      }
    },
    [filters]
  );

  useEffect(() => {
    setPhaseData({});
    setExpandedPhases(new Set());
    setShowUnassigned(false);
  }, [filters]);

  const togglePhase = useCallback(
    (phaseId: string) => {
      setExpandedPhases((prev) => {
        const next = new Set(prev);
        if (next.has(phaseId)) {
          next.delete(phaseId);
        } else {
          next.add(phaseId);
          if (!phaseData[phaseId]?.articles.length) {
            fetchPhaseArticles(phaseId);
          }
        }
        return next;
      });
    },
    [phaseData, fetchPhaseArticles]
  );

  const toggleUnassigned = useCallback(() => {
    setShowUnassigned((prev) => {
      const next = !prev;
      if (next && !phaseData["__unassigned"]?.articles.length) {
        fetchPhaseArticles("__unassigned");
      }
      return next;
    });
  }, [phaseData, fetchPhaseArticles]);

  const updateJourneyPhase = async (articleId: string, phase: string | null) => {
    setUpdatingId(articleId);
    try {
      const res = await fetch("/api/editorial-plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: articleId, journeyPhase: phase }),
      });
      if (res.ok) {
        for (const key of Object.keys(phaseData)) {
          setPhaseData((prev) => ({
            ...prev,
            [key]: {
              ...prev[key],
              articles: prev[key]?.articles.filter((a) => a.id !== articleId) || [],
              pagination: prev[key]?.pagination || null,
              loading: prev[key]?.loading || false,
            },
          }));
        }
        await fetchStats();
        const targetKey = phase || "__unassigned";
        if (expandedPhases.has(targetKey) || (targetKey === "__unassigned" && showUnassigned)) {
          fetchPhaseArticles(targetKey);
        }
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
    classifyCancelledRef.current = false;

    const CHUNK_SIZE = 500;
    let totalClassified = 0;
    let totalProcessed = 0;

    try {
      const statsRes = await fetch("/api/editorial-plan/classify-journey");
      const stats = statsRes.ok ? await statsRes.json() : { unclassified: 0, total: 0 };
      const totalToProcess = mode === "all" ? stats.total : stats.unclassified;
      const totalBatches = Math.ceil(totalToProcess / CHUNK_SIZE);

      setClassifyProgress({
        classified: 0,
        remaining: totalToProcess,
        totalToProcess,
        currentBatch: 0,
        totalBatches,
      });

      let remaining = totalToProcess;
      let batchNum = 0;

      while (remaining > 0) {
        if (classifyCancelledRef.current) break;

        batchNum++;
        const res = await fetch("/api/editorial-plan/classify-journey", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            overwrite: mode === "all",
            limit: CHUNK_SIZE,
            offset: 0,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          console.error("Classification error:", err);
          break;
        }

        const data = await res.json();
        totalClassified += data.classified;
        totalProcessed += data.total;
        remaining = data.remaining;

        setClassifyProgress({
          classified: totalClassified,
          remaining,
          totalToProcess,
          currentBatch: batchNum,
          totalBatches: Math.ceil((totalClassified + remaining) / CHUNK_SIZE),
        });
      }

      setClassifyResult({
        classified: totalClassified,
        total: totalProcessed,
        cancelled: classifyCancelledRef.current,
      });

      setPhaseData({});
      setExpandedPhases(new Set());
      setShowUnassigned(false);
      await fetchStats();
    } catch (error) {
      console.error("Error classifying articles:", error);
      setClassifyResult({ classified: totalClassified, total: totalProcessed });
    } finally {
      setClassifying(false);
      setClassifyProgress(null);
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
        await fetchStats();
      }
    } catch (error) {
      console.error("Error saving suggestion:", error);
    } finally {
      setSavingIndex(null);
    }
  };

  const getPhaseCount = useCallback(
    (phaseId: string): number => {
      if (!journeyStats) return 0;
      const phaseStats = journeyStats.stats[phaseId];
      if (!phaseStats) return 0;
      return Object.values(phaseStats).reduce((sum, n) => sum + n, 0);
    },
    [journeyStats]
  );

  const getCategoryBreakdown = useCallback(
    (phaseId: string): Record<string, number> => {
      if (!journeyStats) return {};
      const phaseStats = journeyStats.stats[phaseId];
      if (!phaseStats) return {};
      const breakdown: Record<string, number> = {};
      for (const [cat, count] of Object.entries(phaseStats)) {
        if (cat === "__none") {
          breakdown["Ohne Kategorie"] = count;
        } else {
          breakdown[cat] = count;
        }
      }
      return breakdown;
    },
    [journeyStats]
  );

  const getCategoryPhaseCount = useCallback(
    (category: string, phaseId: string): number => {
      if (!journeyStats) return 0;
      return journeyStats.stats[phaseId]?.[category] || 0;
    },
    [journeyStats]
  );

  const getCategoryTotalAssigned = useCallback(
    (category: string): number => {
      if (!journeyStats) return 0;
      let total = 0;
      for (const [phase, cats] of Object.entries(journeyStats.stats)) {
        if (phase !== "__unassigned") {
          total += cats[category] || 0;
        }
      }
      return total;
    },
    [journeyStats]
  );

  const totalAssigned = journeyStats?.totalAssigned ?? 0;
  const totalUnassigned = journeyStats?.totalUnassigned ?? 0;
  const totalCount = journeyStats?.totalCount ?? 0;

  const maxPhaseCount = useMemo(
    () => Math.max(...JOURNEY_PHASES.map((p) => getPhaseCount(p.id)), 1),
    [getPhaseCount]
  );

  const suggestPhaseCounts = useMemo(() => {
    if (!suggestPhase || !journeyStats) return {};
    const counts: Record<string, number> = {};
    for (const cat of CATEGORIES) {
      counts[cat] = journeyStats.stats[suggestPhase]?.[cat] || 0;
    }
    return counts;
  }, [suggestPhase, journeyStats]);

  if (loading && !journeyStats) {
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
            {totalAssigned.toLocaleString()} von {totalCount.toLocaleString()} Artikeln zugeordnet
            {totalUnassigned > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {" "}· {totalUnassigned.toLocaleString()} ohne Phase
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
              <option value="unassigned">Nur nicht zugeordnete ({totalUnassigned.toLocaleString()})</option>
              <option value="all">Alle Artikel neu klassifizieren ({totalCount.toLocaleString()})</option>
            </select>
            <button
              onClick={() => {
                if (classifying) {
                  classifyCancelledRef.current = true;
                } else {
                  classifyArticles(classifyMode);
                }
              }}
              disabled={!classifying && classifyMode === "unassigned" && totalUnassigned === 0}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                classifying
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-purple-600 text-white hover:bg-purple-700"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {classifying ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Abbrechen
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

      {/* Classification Progress */}
      {classifyProgress && (
        <div className="rounded-xl border p-4 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-3 mb-3">
            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                {classifyProgress.classified.toLocaleString()} klassifiziert · {classifyProgress.remaining.toLocaleString()} verbleibend
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Batch {classifyProgress.currentBatch} von ~{classifyProgress.totalBatches} · {Math.round((classifyProgress.classified / classifyProgress.totalToProcess) * 100)}% abgeschlossen
              </p>
            </div>
          </div>
          <div className="w-full bg-purple-200 dark:bg-purple-800 rounded-full h-2.5">
            <div
              className="bg-purple-600 dark:bg-purple-400 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(1, Math.round((classifyProgress.classified / classifyProgress.totalToProcess) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {/* Classification Result Banner */}
      {classifyResult && !classifyProgress && (
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
                  {classifyResult.classified.toLocaleString()} Artikel klassifiziert
                  {classifyResult.cancelled && (
                    <span className="text-amber-600 dark:text-amber-400 ml-2">(abgebrochen)</span>
                  )}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {classifyResult.classified.toLocaleString()} von {classifyResult.total.toLocaleString()} verarbeitet
                </p>
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
        {loading && journeyStats && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-slate-400" />
            Aktualisiere...
          </div>
        )}
      </div>

      {/* Funnel Overview */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
          Funnel-Übersicht
        </h2>
        <div className="flex items-end gap-3 h-40">
          {JOURNEY_PHASES.map((phase) => {
            const count = getPhaseCount(phase.id);
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
                  <span className="text-lg font-bold text-slate-900 dark:text-white">{count.toLocaleString()}</span>
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
              {CATEGORIES.map((cat) => (
                <tr key={cat} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[cat]}`}>
                      {cat}
                    </span>
                  </td>
                  {JOURNEY_PHASES.map((phase) => {
                    const count = getCategoryPhaseCount(cat, phase.id);
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
                      {getCategoryTotalAssigned(cat)}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 dark:bg-slate-700/30 font-medium">
                <td className="px-3 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400">Total</td>
                {JOURNEY_PHASES.map((phase) => {
                  const count = getPhaseCount(phase.id);
                  return (
                    <td key={phase.id} className="text-center px-3 py-2.5">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{count.toLocaleString()}</span>
                    </td>
                  );
                })}
                <td className="text-center px-3 py-2.5">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{totalAssigned.toLocaleString()}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Journey Phases - Article Lists */}
      <div className="space-y-4">
        {JOURNEY_PHASES.map((phase) => {
          const count = getPhaseCount(phase.id);
          const isExpanded = expandedPhases.has(phase.id);
          const data = phaseData[phase.id];

          return (
            <div
              key={phase.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            >
              <button
                onClick={() => togglePhase(phase.id)}
                className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
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
                    {count.toLocaleString()}
                  </span>
                  {userCanEdit && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        openSuggestDialog(phase.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          e.preventDefault();
                          openSuggestDialog(phase.id);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50 transition-colors cursor-pointer"
                      title="Neue Titelvorschläge von der KI generieren"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                      </svg>
                      Neue Titelvorschläge
                    </div>
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

              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-700/50">
                  {data?.loading && !data.articles.length ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                    </div>
                  ) : data?.articles.length ? (
                    <>
                      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {data.articles.map((article) => (
                          <ArticleRow
                            key={article.id}
                            article={article}
                            userCanEdit={userCanEdit}
                            updatingId={updatingId}
                            onUpdatePhase={updateJourneyPhase}
                          />
                        ))}
                      </div>
                      {data.pagination && data.pagination.page < data.pagination.totalPages && (
                        <div className="flex items-center justify-center py-3 border-t border-slate-100 dark:border-slate-700/50">
                          <button
                            onClick={() => fetchPhaseArticles(phase.id, data.pagination!.page + 1)}
                            disabled={data.loading}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                          >
                            {data.loading ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                            Weitere laden ({data.articles.length} von {data.pagination.totalCount.toLocaleString()})
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="px-6 py-8 text-center">
                      <p className="text-sm text-slate-400 dark:text-slate-500">
                        Keine Artikel in dieser Phase
                      </p>
                    </div>
                  )}
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

            {!suggestions && !suggesting && (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  Für welche Kategorie möchtest du neue Titelvorschläge? Die KI gleicht dann mit den bestehenden Titeln dieser Kategorie ab.
                </p>
                <div className="space-y-2 mb-6">
                  {CATEGORIES.map((cat) => {
                    const count = suggestPhaseCounts[cat] || 0;
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

            {suggesting && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <svg className="w-8 h-8 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 text-center transition-opacity duration-500">
                  {[
                    <>Neue Vorschläge für <span className="font-bold text-purple-600 dark:text-purple-400">{suggestCategory}</span> in <span className="font-bold text-purple-600 dark:text-purple-400">{JOURNEY_PHASES.find((p) => p.id === suggestPhase)?.label}</span> werden recherchiert...</>,
                    "Abgleich mit Topic-Map und existierenden Themen...",
                    "Starte Keyword-Research...",
                    "Übermittlung der Ergebnisse an Claude...",
                    "Warten auf Feedback...",
                  ][loadingMsgIndex]}
                </p>
              </div>
            )}

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
          onClick={toggleUnassigned}
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
                {totalUnassigned.toLocaleString()}
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

        {showUnassigned && (
          <div className="border-t border-slate-100 dark:border-slate-700/50">
            {phaseData["__unassigned"]?.loading && !phaseData["__unassigned"]?.articles.length ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
              </div>
            ) : phaseData["__unassigned"]?.articles.length ? (
              <>
                <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {phaseData["__unassigned"].articles.map((article) => (
                    <ArticleRow
                      key={article.id}
                      article={article}
                      userCanEdit={userCanEdit}
                      updatingId={updatingId}
                      onUpdatePhase={updateJourneyPhase}
                    />
                  ))}
                </div>
                {phaseData["__unassigned"].pagination &&
                  phaseData["__unassigned"].pagination.page < phaseData["__unassigned"].pagination.totalPages && (
                    <div className="flex items-center justify-center py-3 border-t border-slate-100 dark:border-slate-700/50">
                      <button
                        onClick={() => fetchPhaseArticles("__unassigned", phaseData["__unassigned"].pagination!.page + 1)}
                        disabled={phaseData["__unassigned"].loading}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                      >
                        {phaseData["__unassigned"].loading ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                        Weitere laden ({phaseData["__unassigned"].articles.length} von {phaseData["__unassigned"].pagination.totalCount.toLocaleString()})
                      </button>
                    </div>
                  )}
              </>
            ) : totalUnassigned === 0 ? (
              <div className="px-6 py-8 text-center">
                <div className="inline-flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Alle Artikel sind einer Phase zugeordnet
                </div>
              </div>
            ) : null}
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
          {article.journeyPhase && article.journeyConfidence != null && (
            <ConfidenceBadge confidence={article.journeyConfidence} />
          )}
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

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color =
    confidence >= 85
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : confidence >= 65
        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        : confidence >= 45
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

  const label =
    confidence >= 85
      ? "Sehr sicher"
      : confidence >= 65
        ? "Sicher"
        : confidence >= 45
          ? "Grenzfall"
          : "Unsicher";

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums shrink-0 ${color}`}
      title={`KI-Konfidenz: ${confidence}% – ${label}`}
    >
      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
      {confidence}%
    </span>
  );
}
