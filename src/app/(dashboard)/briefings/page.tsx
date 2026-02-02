"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { canEdit, hasFullAdminRights } from "@/lib/rbac";
import { StatCard } from "@/components/ui/StatCard";

interface Briefing {
  id: string;
  briefingNumber: number;
  title: string;
  contentAction: string;
  targetAudience: string | null;
  funnelStage: string | null;
  goals: string | null;
  focusKeyword: string | null;
  keywordCluster: string | null;
  topicCluster: string | null;
  searchIntent: string | null;
  url: string | null;
  benchmarkUrls: string | null;
  csArticle: string | null;
  titleTag: string | null;
  metaDescription: string | null;
  navTitle: string | null;
  h1: string | null;
  mainParagraph: string | null;
  primaryCta: string | null;
  secondaryCta: string | null;
  inboundCta: string | null;
  bodyContent: string | null;
  internalLinks: string | null;
  missingTopics: string | null;
  notes: string | null;
  titleEn: string | null;
  titleFr: string | null;
  titleIt: string | null;
  status: "ordered" | "in_progress" | "completed";
  requester: { id: string; name: string | null; email: string };
  assignee: { id: string; name: string | null; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export default function BriefingsPage() {
  const { data: session } = useSession();
  const canEditData = canEdit(session?.user?.role);
  const isAdmin = hasFullAdminRights(session?.user?.role);
  
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedBriefing, setSelectedBriefing] = useState<Briefing | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form states für neue Bestellung
  const [newTitle, setNewTitle] = useState("");
  const [newContentAction, setNewContentAction] = useState<string>("edit");
  const [newTargetAudience, setNewTargetAudience] = useState("");
  const [newFunnelStage, setNewFunnelStage] = useState<string>("");
  const [newGoals, setNewGoals] = useState("");
  const [newFocusKeyword, setNewFocusKeyword] = useState("");
  const [newKeywordCluster, setNewKeywordCluster] = useState("");
  const [newTopicCluster, setNewTopicCluster] = useState("");
  const [newSearchIntent, setNewSearchIntent] = useState<string>("");
  const [newUrl, setNewUrl] = useState("");
  const [newBenchmarkUrls, setNewBenchmarkUrls] = useState("");
  const [newCsArticle, setNewCsArticle] = useState("");

  useEffect(() => {
    fetchBriefings();
  }, []);

  const fetchBriefings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/briefings");
      const data = await response.json();
      setBriefings(data.briefings || []);
    } catch (error) {
      console.error("Error fetching briefings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const createBriefing = async () => {
    if (!newTitle.trim()) return;

    try {
      setIsSubmitting(true);
      const response = await fetch("/api/briefings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          contentAction: newContentAction,
          targetAudience: newTargetAudience.trim() || null,
          funnelStage: newFunnelStage || null,
          goals: newGoals.trim() || null,
          focusKeyword: newFocusKeyword.trim() || null,
          keywordCluster: newKeywordCluster.trim() || null,
          topicCluster: newTopicCluster.trim() || null,
          searchIntent: newSearchIntent || null,
          url: newUrl.trim() || null,
          benchmarkUrls: newBenchmarkUrls.trim() || null,
          csArticle: newCsArticle.trim() || null,
        }),
      });

      const data = await response.json();
      if (data.briefing) {
        setBriefings([data.briefing, ...briefings]);
        resetForm();
        setShowNewForm(false);
      } else {
        alert(data.error || "Fehler beim Erstellen des Briefings");
      }
    } catch (error) {
      console.error("Error creating briefing:", error);
      alert("Fehler beim Erstellen des Briefings");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewTitle("");
    setNewContentAction("edit");
    setNewTargetAudience("");
    setNewFunnelStage("");
    setNewGoals("");
    setNewFocusKeyword("");
    setNewKeywordCluster("");
    setNewTopicCluster("");
    setNewSearchIntent("");
    setNewUrl("");
    setNewBenchmarkUrls("");
    setNewCsArticle("");
  };

  const updateBriefing = async (briefingId: string, updates: Partial<Briefing>) => {
    try {
      setIsSaving(true);
      const response = await fetch(`/api/briefings/${briefingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      if (data.briefing) {
        setBriefings(briefings.map((b) => (b.id === briefingId ? data.briefing : b)));
        setSelectedBriefing(data.briefing);
      }
    } catch (error) {
      console.error("Error updating briefing:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteBriefing = async (briefingId: string) => {
    if (!confirm("Briefing wirklich löschen?")) return;

    try {
      const response = await fetch(`/api/briefings/${briefingId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setBriefings(briefings.filter((b) => b.id !== briefingId));
        if (selectedBriefing?.id === briefingId) {
          setSelectedBriefing(null);
        }
      }
    } catch (error) {
      console.error("Error deleting briefing:", error);
    }
  };

  const getContentActionLabel = (action: string) => {
    switch (action) {
      case "edit":
        return "Überarbeiten";
      case "merge":
        return "Mergen";
      case "new":
        return "Neu erstellen";
      default:
        return action;
    }
  };

  const getFunnelStageLabel = (stage: string | null) => {
    if (!stage) return "-";
    switch (stage) {
      case "attention":
        return "Attention";
      case "interest":
        return "Interest";
      case "desire":
        return "Desire";
      case "action":
        return "Action";
      default:
        return stage;
    }
  };

  const getSearchIntentLabel = (intent: string | null) => {
    if (!intent) return "-";
    switch (intent) {
      case "informational":
        return "Informational";
      case "navigational":
        return "Navigational";
      case "transactional":
        return "Transactional";
      case "commercial":
        return "Commercial";
      default:
        return intent;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ordered":
        return "Bestellt";
      case "in_progress":
        return "In Bearbeitung";
      case "completed":
        return "Fertig";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ordered":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "in_progress":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "completed":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30";
    }
  };

  const filteredBriefings = briefings.filter((briefing) => {
    if (filterStatus !== "all" && briefing.status !== filterStatus) return false;
    return true;
  });

  const briefingStats = {
    total: briefings.length,
    ordered: briefings.filter((b) => b.status === "ordered").length,
    inProgress: briefings.filter((b) => b.status === "in_progress").length,
    completed: briefings.filter((b) => b.status === "completed").length,
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Briefings</h1>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Briefings</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {isAdmin ? "Alle Briefing-Bestellungen verwalten" : "SEO Content Briefings bestellen"}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/briefing-vorlage.docx"
            download
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Vorlage
          </a>
          {canEditData && (
            <button
              onClick={() => setShowNewForm(!showNewForm)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Neues Briefing
            </button>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Gesamt Briefings"
          value={briefingStats.total}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatCard
          title="Bestellt"
          value={briefingStats.ordered}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="In Bearbeitung"
          value={briefingStats.inProgress}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          }
        />
        <StatCard
          title="Fertig"
          value={briefingStats.completed}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Neues Briefing Form */}
      {showNewForm && canEditData && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Neues Briefing bestellen
          </h2>
          <div className="space-y-6">
            {/* Grunddaten */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Briefing-Titel *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="z.B. Hypotheken Ratgeber Seite"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ausgangslage *
                </label>
                <select
                  value={newContentAction}
                  onChange={(e) => setNewContentAction(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="edit">Content überarbeiten</option>
                  <option value="merge">Content mergen</option>
                  <option value="new">Content neu erstellen</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Funnel-Stufe
                </label>
                <select
                  value={newFunnelStage}
                  onChange={(e) => setNewFunnelStage(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="">Auswählen...</option>
                  <option value="attention">Attention (Aufmerksamkeit)</option>
                  <option value="interest">Interest (Interesse)</option>
                  <option value="desire">Desire (Verlangen)</option>
                  <option value="action">Action (Handlung)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Zielgruppe
              </label>
              <textarea
                value={newTargetAudience}
                onChange={(e) => setNewTargetAudience(e.target.value)}
                placeholder="Beschreiben Sie die Zielgruppe..."
                rows={2}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Ziele / KPIs (User Story)
              </label>
              <textarea
                value={newGoals}
                onChange={(e) => setNewGoals(e.target.value)}
                placeholder="Als [Nutzer] möchte ich [Ziel], damit [Nutzen]..."
                rows={2}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            {/* Keywords */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Fokus-Keyword
                </label>
                <input
                  type="text"
                  value={newFocusKeyword}
                  onChange={(e) => setNewFocusKeyword(e.target.value)}
                  placeholder="Haupt-Keyword"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Search Intent
                </label>
                <select
                  value={newSearchIntent}
                  onChange={(e) => setNewSearchIntent(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="">Auswählen...</option>
                  <option value="informational">Informational</option>
                  <option value="navigational">Navigational</option>
                  <option value="transactional">Transactional</option>
                  <option value="commercial">Commercial</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  URL
                </label>
                <input
                  type="text"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Keyword-Cluster
                </label>
                <textarea
                  value={newKeywordCluster}
                  onChange={(e) => setNewKeywordCluster(e.target.value)}
                  placeholder="Verwandte Keywords (eines pro Zeile)"
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Topic-Cluster
                </label>
                <textarea
                  value={newTopicCluster}
                  onChange={(e) => setNewTopicCluster(e.target.value)}
                  placeholder="Verwandte Themen"
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Benchmark URLs (Wettbewerber)
                </label>
                <textarea
                  value={newBenchmarkUrls}
                  onChange={(e) => setNewBenchmarkUrls(e.target.value)}
                  placeholder="URLs von Wettbewerber-Seiten (eine pro Zeile)"
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  CS Artikel (wenn vorhanden)
                </label>
                <textarea
                  value={newCsArticle}
                  onChange={(e) => setNewCsArticle(e.target.value)}
                  placeholder="Link oder Referenz zum CS Artikel"
                  rows={2}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={createBriefing}
                disabled={isSubmitting || !newTitle.trim()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isSubmitting ? "Bestelle..." : "Briefing bestellen"}
              </button>
              <button
                onClick={() => {
                  setShowNewForm(false);
                  resetForm();
                }}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm"
          >
            <option value="all">Alle</option>
            <option value="ordered">Bestellt</option>
            <option value="in_progress">In Bearbeitung</option>
            <option value="completed">Fertig</option>
          </select>
        </div>
      </div>

      {/* Briefings Liste und Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Briefings Liste */}
        <div className="space-y-3">
          {filteredBriefings.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
              <p className="text-slate-500 dark:text-slate-400">
                {briefings.length === 0
                  ? "Noch keine Briefings vorhanden"
                  : "Keine Briefings mit diesem Filter"}
              </p>
            </div>
          ) : (
            filteredBriefings.map((briefing) => (
              <div
                key={briefing.id}
                onClick={() => setSelectedBriefing(briefing)}
                className={`bg-white dark:bg-slate-800 rounded-xl p-4 border cursor-pointer transition-all ${
                  selectedBriefing?.id === briefing.id
                    ? "border-blue-500 ring-2 ring-blue-500/20"
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        #{briefing.briefingNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full border ${getStatusColor(
                          briefing.status
                        )}`}
                      >
                        {getStatusLabel(briefing.status)}
                      </span>
                    </div>
                    <h3 className="font-medium text-slate-900 dark:text-white truncate">
                      {briefing.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {getContentActionLabel(briefing.contentAction)}
                      {briefing.focusKeyword && ` • ${briefing.focusKeyword}`}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-500">
                      <span>{briefing.requester.name || briefing.requester.email}</span>
                      <span>•</span>
                      <span>{formatDate(briefing.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Briefing Detail */}
        {selectedBriefing && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[calc(100vh-300px)] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      #{selectedBriefing.briefingNumber}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full border ${getStatusColor(
                        selectedBriefing.status
                      )}`}
                    >
                      {getStatusLabel(selectedBriefing.status)}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {selectedBriefing.title}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Bestellt von {selectedBriefing.requester.name || selectedBriefing.requester.email} am{" "}
                    {formatDate(selectedBriefing.createdAt)}
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => deleteBriefing(selectedBriefing.id)}
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Briefing löschen"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Status ändern (nur Admin) */}
              {isAdmin && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Status ändern
                  </label>
                  <select
                    value={selectedBriefing.status}
                    onChange={(e) => updateBriefing(selectedBriefing.id, { status: e.target.value as Briefing["status"] })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border ${getStatusColor(
                      selectedBriefing.status
                    )} bg-transparent`}
                  >
                    <option value="ordered">Bestellt</option>
                    <option value="in_progress">In Bearbeitung</option>
                    <option value="completed">Fertig</option>
                  </select>
                </div>
              )}
            </div>

            {/* Briefing Daten */}
            <div className="p-6 space-y-6">
              {/* Bestelldaten */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Bestelldaten
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Ausgangslage:</span>
                    <span className="ml-2 text-slate-900 dark:text-white">{getContentActionLabel(selectedBriefing.contentAction)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Funnel-Stufe:</span>
                    <span className="ml-2 text-slate-900 dark:text-white">{getFunnelStageLabel(selectedBriefing.funnelStage)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Search Intent:</span>
                    <span className="ml-2 text-slate-900 dark:text-white">{getSearchIntentLabel(selectedBriefing.searchIntent)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Fokus-Keyword:</span>
                    <span className="ml-2 text-slate-900 dark:text-white">{selectedBriefing.focusKeyword || "-"}</span>
                  </div>
                </div>
                {selectedBriefing.targetAudience && (
                  <div className="mt-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">Zielgruppe:</span>
                    <p className="text-slate-900 dark:text-white text-sm mt-1">{selectedBriefing.targetAudience}</p>
                  </div>
                )}
                {selectedBriefing.goals && (
                  <div className="mt-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">Ziele / KPIs:</span>
                    <p className="text-slate-900 dark:text-white text-sm mt-1 whitespace-pre-wrap">{selectedBriefing.goals}</p>
                  </div>
                )}
                {selectedBriefing.url && (
                  <div className="mt-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">URL:</span>
                    <a href={selectedBriefing.url} target="_blank" rel="noopener noreferrer" className="block text-blue-500 hover:underline text-sm mt-1 break-all">
                      {selectedBriefing.url}
                    </a>
                  </div>
                )}
                {selectedBriefing.keywordCluster && (
                  <div className="mt-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">Keyword-Cluster:</span>
                    <p className="text-slate-900 dark:text-white text-sm mt-1 whitespace-pre-wrap">{selectedBriefing.keywordCluster}</p>
                  </div>
                )}
                {selectedBriefing.topicCluster && (
                  <div className="mt-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">Topic-Cluster:</span>
                    <p className="text-slate-900 dark:text-white text-sm mt-1 whitespace-pre-wrap">{selectedBriefing.topicCluster}</p>
                  </div>
                )}
                {selectedBriefing.benchmarkUrls && (
                  <div className="mt-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">Benchmark URLs:</span>
                    <p className="text-slate-900 dark:text-white text-sm mt-1 whitespace-pre-wrap">{selectedBriefing.benchmarkUrls}</p>
                  </div>
                )}
                {selectedBriefing.csArticle && (
                  <div className="mt-3">
                    <span className="text-slate-500 dark:text-slate-400 text-sm">CS Artikel:</span>
                    <p className="text-slate-900 dark:text-white text-sm mt-1 whitespace-pre-wrap">{selectedBriefing.csArticle}</p>
                  </div>
                )}
              </div>

              {/* Content-Aufbau (nur Admin kann bearbeiten) */}
              {isAdmin && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Content-Aufbau (Agentur)
                    {isSaving && <span className="text-xs text-slate-400 ml-2">Speichert...</span>}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Title Tag</label>
                      <input
                        type="text"
                        value={selectedBriefing.titleTag || ""}
                        onChange={(e) => updateBriefing(selectedBriefing.id, { titleTag: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Meta Description</label>
                      <textarea
                        value={selectedBriefing.metaDescription || ""}
                        onChange={(e) => updateBriefing(selectedBriefing.id, { metaDescription: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Navigationstitel</label>
                        <input
                          type="text"
                          value={selectedBriefing.navTitle || ""}
                          onChange={(e) => updateBriefing(selectedBriefing.id, { navTitle: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">H1</label>
                        <input
                          type="text"
                          value={selectedBriefing.h1 || ""}
                          onChange={(e) => updateBriefing(selectedBriefing.id, { h1: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Hauptparagraf</label>
                      <textarea
                        value={selectedBriefing.mainParagraph || ""}
                        onChange={(e) => updateBriefing(selectedBriefing.id, { mainParagraph: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Primary CTA</label>
                        <input
                          type="text"
                          value={selectedBriefing.primaryCta || ""}
                          onChange={(e) => updateBriefing(selectedBriefing.id, { primaryCta: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Secondary CTA</label>
                        <input
                          type="text"
                          value={selectedBriefing.secondaryCta || ""}
                          onChange={(e) => updateBriefing(selectedBriefing.id, { secondaryCta: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Inbound CTA</label>
                        <input
                          type="text"
                          value={selectedBriefing.inboundCta || ""}
                          onChange={(e) => updateBriefing(selectedBriefing.id, { inboundCta: e.target.value })}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Fliesstext/Struktur (H2 – H4)</label>
                      <textarea
                        value={selectedBriefing.bodyContent || ""}
                        onChange={(e) => updateBriefing(selectedBriefing.id, { bodyContent: e.target.value })}
                        rows={4}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Interne Verlinkungen</label>
                      <textarea
                        value={selectedBriefing.internalLinks || ""}
                        onChange={(e) => updateBriefing(selectedBriefing.id, { internalLinks: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Missing Topics</label>
                      <textarea
                        value={selectedBriefing.missingTopics || ""}
                        onChange={(e) => updateBriefing(selectedBriefing.id, { missingTopics: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Bemerkungen</label>
                      <textarea
                        value={selectedBriefing.notes || ""}
                        onChange={(e) => updateBriefing(selectedBriefing.id, { notes: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                      />
                    </div>

                    {/* Mehrsprachigkeit */}
                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                      <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3">Weitere Sprachen</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">EN Titel</label>
                          <input
                            type="text"
                            value={selectedBriefing.titleEn || ""}
                            onChange={(e) => updateBriefing(selectedBriefing.id, { titleEn: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">FR Titel</label>
                          <input
                            type="text"
                            value={selectedBriefing.titleFr || ""}
                            onChange={(e) => updateBriefing(selectedBriefing.id, { titleFr: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">IT Titel</label>
                          <input
                            type="text"
                            value={selectedBriefing.titleIt || ""}
                            onChange={(e) => updateBriefing(selectedBriefing.id, { titleIt: e.target.value })}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Content-Ansicht für Member (nur lesen) */}
              {!isAdmin && selectedBriefing.status !== "ordered" && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                    Content-Aufbau
                  </h3>
                  <div className="space-y-3 text-sm">
                    {selectedBriefing.titleTag && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Title Tag:</span>
                        <p className="text-slate-900 dark:text-white">{selectedBriefing.titleTag}</p>
                      </div>
                    )}
                    {selectedBriefing.metaDescription && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Meta Description:</span>
                        <p className="text-slate-900 dark:text-white">{selectedBriefing.metaDescription}</p>
                      </div>
                    )}
                    {selectedBriefing.h1 && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">H1:</span>
                        <p className="text-slate-900 dark:text-white">{selectedBriefing.h1}</p>
                      </div>
                    )}
                    {selectedBriefing.mainParagraph && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Hauptparagraf:</span>
                        <p className="text-slate-900 dark:text-white whitespace-pre-wrap">{selectedBriefing.mainParagraph}</p>
                      </div>
                    )}
                    {selectedBriefing.bodyContent && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Fliesstext/Struktur:</span>
                        <p className="text-slate-900 dark:text-white whitespace-pre-wrap">{selectedBriefing.bodyContent}</p>
                      </div>
                    )}
                    {selectedBriefing.notes && (
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Bemerkungen:</span>
                        <p className="text-slate-900 dark:text-white whitespace-pre-wrap">{selectedBriefing.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
