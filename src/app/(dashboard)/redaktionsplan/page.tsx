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
  creator: ArticleUser;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  "Mortgages",
  "Accounts&Cards",
  "Investing",
  "Pension",
  "Digital Banking",
] as const;

const STATUSES = [
  { id: "idea", label: "Idee", color: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300", dot: "bg-slate-400" },
  { id: "planned", label: "Geplant", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", dot: "bg-blue-400" },
  { id: "in_progress", label: "In Arbeit", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300", dot: "bg-yellow-400" },
  { id: "in_review", label: "Review", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", dot: "bg-purple-400" },
  { id: "published", label: "Publiziert", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", dot: "bg-green-400" },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Mortgages": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "Accounts&Cards": "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  "Investing": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  "Pension": "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  "Digital Banking": "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
};

const LOCATIONS = ["Guide", "Insights"] as const;

const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const WEEKDAYS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  let startWeekday = firstDay.getDay() - 1;
  if (startWeekday < 0) startWeekday = 6;

  const days: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }
  return days;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear()}`;
}

export default function RedaktionsplanPage() {
  const { data: session } = useSession();
  const userCanEdit = canEdit(session?.user?.role);

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterLocation, setFilterLocation] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; total: number; errors: string[] } | null>(null);

  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    url: "",
    category: "",
    status: "idea",
    plannedDate: "",
    metaDescription: "",
    h1: "",
    schemaMarkup: "",
    location: "",
  });

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

  const resetForm = () => {
    setFormData({ title: "", description: "", url: "", category: "", status: "idea", plannedDate: "", metaDescription: "", h1: "", schemaMarkup: "", location: "" });
    setEditingArticle(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      const method = editingArticle ? "PUT" : "POST";
      const body = editingArticle
        ? { id: editingArticle.id, ...formData }
        : formData;

      const res = await fetch("/api/editorial-plan", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await fetchArticles();
        resetForm();
      }
    } catch (error) {
      console.error("Error saving article:", error);
    }
  };

  const handleEdit = (article: Article) => {
    setFormData({
      title: article.title,
      description: article.description || "",
      url: article.url || "",
      category: article.category || "",
      status: article.status,
      plannedDate: article.plannedDate ? article.plannedDate.split("T")[0] : "",
      metaDescription: article.metaDescription || "",
      h1: article.h1 || "",
      schemaMarkup: article.schemaMarkup || "",
      location: article.location || "",
    });
    setEditingArticle(article);
    setSelectedArticle(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Artikel wirklich löschen?")) return;
    try {
      const res = await fetch(`/api/editorial-plan?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchArticles();
        setSelectedArticle(null);
      }
    } catch (error) {
      console.error("Error deleting article:", error);
    }
  };

  const filteredArticles = articles.filter((a) => {
    if (filterCategory && a.category !== filterCategory) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterLocation && a.location !== filterLocation) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = a.title.toLowerCase().includes(q);
      const matchesMeta = a.metaDescription?.toLowerCase().includes(q);
      if (!matchesTitle && !matchesMeta) return false;
    }
    return true;
  });

  const getArticlesForDate = (year: number, month: number, day: number) => {
    return filteredArticles.filter((a) => {
      if (!a.plannedDate) return false;
      const d = new Date(a.plannedDate);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  };

  const unscheduledArticles = filteredArticles.filter((a) => !a.plannedDate);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/editorial-plan/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setImportResult(data);
        await fetchArticles();
      } else {
        setImportResult({ imported: 0, skipped: 0, total: 0, errors: [data.error || "Import fehlgeschlagen"] });
      }
    } catch (error) {
      console.error("Import error:", error);
      setImportResult({ imported: 0, skipped: 0, total: 0, errors: ["Netzwerkfehler beim Import"] });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToToday = () => {
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  const days = getMonthDays(currentYear, currentMonth);
  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

  const getStatusInfo = (status: string) => STATUSES.find((s) => s.id === status) || STATUSES[0];

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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Redaktionsplan</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {filteredArticles.length} Artikel insgesamt
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "calendar"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Kalender
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Liste
            </button>
          </div>
          {userCanEdit && (
            <div className="flex items-center gap-2">
              <label
                className={`inline-flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm font-medium cursor-pointer ${importing ? "opacity-50 pointer-events-none" : ""}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {importing ? "Importiere..." : "XLSX Import"}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImport}
                  className="hidden"
                  disabled={importing}
                />
              </label>
              <button
                onClick={() => { resetForm(); setShowForm(true); }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Neuer Artikel
              </button>
            </div>
          )}
        </div>
      </div>

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
            placeholder="Titel oder Meta-Description suchen..."
            className="pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 w-72 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
        >
          <option value="">Alle Status</option>
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
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
        {/* Status Legend */}
        <div className="flex items-center gap-3 ml-auto">
          {STATUSES.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Import Result Banner */}
      {importResult && (
        <div className={`rounded-xl border p-4 ${importResult.errors.length > 0 && importResult.imported === 0 ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {importResult.imported > 0 ? (
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {importResult.imported} von {importResult.total} Artikeln importiert
                  {importResult.skipped > 0 && <span className="text-slate-500"> · {importResult.skipped} übersprungen</span>}
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-1 text-xs text-red-600 dark:text-red-400 space-y-0.5">
                    {importResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                )}
              </div>
            </div>
            <button onClick={() => setImportResult(null)} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Month Navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {MONTHS_DE[currentMonth]} {currentYear}
              </h2>
              <button
                onClick={goToToday}
                className="px-2 py-0.5 text-xs font-medium rounded border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Heute
              </button>
            </div>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
            {WEEKDAYS_DE.map((day) => (
              <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {days.map((day, idx) => {
              const dayArticles = day ? getArticlesForDate(currentYear, currentMonth, day) : [];
              return (
                <div
                  key={idx}
                  className={`min-h-[100px] border-b border-r border-slate-100 dark:border-slate-700/50 p-1.5 ${
                    day ? "bg-white dark:bg-slate-800" : "bg-slate-50 dark:bg-slate-800/50"
                  } ${isToday(day!) ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}`}
                  onClick={() => {
                    if (day && userCanEdit) {
                      const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
                      resetForm();
                      setFormData((prev) => ({ ...prev, plannedDate: dateStr }));
                      setShowForm(true);
                    }
                  }}
                >
                  {day && (
                    <>
                      <div className={`text-xs font-medium mb-1 ${
                        isToday(day)
                          ? "bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center"
                          : "text-slate-500 dark:text-slate-400 px-1"
                      }`}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayArticles.slice(0, 3).map((article) => {
                          const statusInfo = getStatusInfo(article.status);
                          return (
                            <button
                              key={article.id}
                              onClick={(e) => { e.stopPropagation(); setSelectedArticle(article); }}
                              className={`w-full text-left px-1.5 py-0.5 rounded text-[11px] font-medium truncate block transition-opacity hover:opacity-80 ${statusInfo.color}`}
                            >
                              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${statusInfo.dot}`} />
                              {article.title}
                            </button>
                          );
                        })}
                        {dayArticles.length > 3 && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 px-1">
                            +{dayArticles.length - 3} weitere
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Unscheduled articles */}
          {unscheduledArticles.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                Content-Ideen ({unscheduledArticles.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {unscheduledArticles.map((article) => {
                  const statusInfo = getStatusInfo(article.status);
                  return (
                    <button
                      key={article.id}
                      onClick={() => setSelectedArticle(article)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80 ${statusInfo.color}`}
                    >
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${statusInfo.dot}`} />
                      {article.title}
                      {article.category && (
                        <span className="ml-2 opacity-70">· {article.category}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Titel</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Kategorie</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Geplant</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">URL</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Erstellt von</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filteredArticles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                      Keine Artikel vorhanden. Erstelle deinen ersten Artikel!
                    </td>
                  </tr>
                ) : (
                  filteredArticles.map((article) => {
                    const statusInfo = getStatusInfo(article.status);
                    return (
                      <tr key={article.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelectedArticle(article)}
                            className="text-sm font-medium text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left"
                          >
                            {article.title}
                          </button>
                          {article.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-xs">
                              {article.description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {article.category ? (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[article.category] || "bg-slate-100 text-slate-700"}`}>
                              {article.category}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">–</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          {article.plannedDate ? formatDate(article.plannedDate) : "–"}
                        </td>
                        <td className="px-4 py-3">
                          {article.url ? (
                            <a
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[200px] block"
                            >
                              {article.url}
                            </a>
                          ) : (
                            <span className="text-xs text-slate-400">–</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                          {article.creator.name || article.creator.email}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {userCanEdit && (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleEdit(article)}
                                className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                title="Bearbeiten"
                              >
                                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(article.id)}
                                className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title="Löschen"
                              >
                                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Article Detail Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedArticle(null)}>
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {(() => {
                      const statusInfo = getStatusInfo(selectedArticle.status);
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          <span className={`w-2 h-2 rounded-full ${statusInfo.dot}`} />
                          {statusInfo.label}
                        </span>
                      );
                    })()}
                    {selectedArticle.category && (
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${CATEGORY_COLORS[selectedArticle.category] || "bg-slate-100 text-slate-700"}`}>
                        {selectedArticle.category}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedArticle.title}</h2>
                </div>
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {selectedArticle.description && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Beschreibung</h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{selectedArticle.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Geplantes Datum</h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {selectedArticle.plannedDate ? formatDate(selectedArticle.plannedDate) : "Nicht festgelegt"}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Erstellt von</h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {selectedArticle.creator.name || selectedArticle.creator.email}
                  </p>
                </div>
              </div>

              {selectedArticle.location && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Location</h3>
                  <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                    {selectedArticle.location}
                  </span>
                </div>
              )}

              {selectedArticle.url && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">URL</h3>
                  <a
                    href={selectedArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
                  >
                    {selectedArticle.url}
                  </a>
                </div>
              )}

              {(selectedArticle.h1 || selectedArticle.metaDescription || selectedArticle.schemaMarkup) && (
                <div className="mb-4 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">SEO-Felder</h3>
                  {selectedArticle.h1 && (
                    <div>
                      <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">H1</h4>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{selectedArticle.h1}</p>
                    </div>
                  )}
                  {selectedArticle.metaDescription && (
                    <div>
                      <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">Meta-Description</h4>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{selectedArticle.metaDescription}</p>
                    </div>
                  )}
                  {selectedArticle.schemaMarkup && (
                    <div>
                      <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">Schema.org Markup</h4>
                      <pre className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono">{selectedArticle.schemaMarkup}</pre>
                    </div>
                  )}
                </div>
              )}

              <div className="text-xs text-slate-400 dark:text-slate-500 pt-4 border-t border-slate-100 dark:border-slate-700">
                Erstellt: {formatDate(selectedArticle.createdAt)} · Aktualisiert: {formatDate(selectedArticle.updatedAt)}
              </div>

              {userCanEdit && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <button
                    onClick={() => handleEdit(selectedArticle)}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => handleDelete(selectedArticle.id)}
                    className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-sm font-medium"
                  >
                    Löschen
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={resetForm}>
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit} className="p-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
                {editingArticle ? "Artikel bearbeiten" : "Neuer Artikel"}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Titel <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Artikeltitel eingeben..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Beschreibung
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Kurze Beschreibung des Artikels..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    URL (optional)
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Kategorie
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Keine Kategorie</option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {STATUSES.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Location
                    </label>
                    <select
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Keine Location</option>
                      {LOCATIONS.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Geplantes Datum
                    </label>
                    <input
                      type="date"
                      value={formData.plannedDate}
                      onChange={(e) => setFormData({ ...formData, plannedDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* SEO-Felder */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-3">SEO-Felder (optional)</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        H1
                      </label>
                      <input
                        type="text"
                        value={formData.h1}
                        onChange={(e) => setFormData({ ...formData, h1: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="H1-Überschrift..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Meta-Description
                      </label>
                      <textarea
                        value={formData.metaDescription}
                        onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        placeholder="Meta-Description für Suchmaschinen..."
                      />
                      <p className="text-xs text-slate-400 mt-1">{formData.metaDescription.length}/160 Zeichen</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Schema.org Markup
                      </label>
                      <textarea
                        value={formData.schemaMarkup}
                        onChange={(e) => setFormData({ ...formData, schemaMarkup: e.target.value })}
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        placeholder='{"@context": "https://schema.org", "@type": "Article", ...}'
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  {editingArticle ? "Speichern" : "Erstellen"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
                >
                  Abbrechen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
