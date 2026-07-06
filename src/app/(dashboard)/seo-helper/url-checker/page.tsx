"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";

interface CheckResult {
  factor: string;
  status: "pass" | "warn" | "fail";
  value: string | number | null;
  recommendation: string;
  leakAttribute: string;
}

interface CategoryResult {
  name: string;
  score: number;
  leakReference: string;
  checks: CheckResult[];
}

interface UrlCheckResult {
  url: string;
  overallScore: number;
  categories: CategoryResult[];
  keyword?: string;
  fetchedAt: string;
}

interface AiAnalysis {
  eeat: { score: number; analysis: string };
  topicalAuthority: { score: number; analysis: string };
  entityClarity: { score: number; analysis: string };
  contentUsefulness: { score: number; analysis: string };
  readability: { score: number; analysis: string };
  keywordIntegration?: { score: number; analysis: string };
}

interface PageSpeedMetrics {
  lcp: { value: number; score: string };
  cls: { value: number; score: string };
  inp: { value: number; score: string };
  fcp: { value: number; score: string };
  ttfb: { value: number; score: string };
  performanceScore: number;
  strategy: string;
}

interface BacklinkData {
  domain: {
    target: string;
    totalBacklinks: number;
    referringDomains: number;
    domainRank: number;
    dofollowBacklinks: number;
    nofollowBacklinks: number;
  };
  page: { totalBacklinks: number; referringDomains: number; domainRank: number } | null;
}

interface HistoryEntry {
  id: string;
  url: string;
  keyword: string | null;
  overallScore: number;
  categoryScores: Record<string, number>;
  createdAt: string;
}

type TabId = "results" | "ai" | "speed" | "backlinks" | "history" | "batch" | "competitor" | "site" | "monitor";

export default function UrlCheckerPage() {
  const [url, setUrl] = useState("");
  const [keyword, setKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UrlCheckResult | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabId>("history");

  // AI Analysis
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // PageSpeed
  const [pageSpeed, setPageSpeed] = useState<PageSpeedMetrics | null>(null);
  const [isSpeedLoading, setIsSpeedLoading] = useState(false);

  // Backlinks
  const [backlinks, setBacklinks] = useState<BacklinkData | null>(null);
  const [isBacklinksLoading, setIsBacklinksLoading] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Batch
  const [batchUrls, setBatchUrls] = useState("");
  const [batchResults, setBatchResults] = useState<(UrlCheckResult | { url: string; error: string })[]>([]);
  const [isBatchLoading, setIsBatchLoading] = useState(false);

  // Competitor
  const [competitorUrls, setCompetitorUrls] = useState("");
  const [competitorData, setCompetitorData] = useState<{ own: { url: string; overallScore: number; categories: { name: string; score: number }[] }; competitors: ({ url: string; overallScore: number; categories: { name: string; score: number }[] } | { url: string; error: string })[]; gaps: { category: string; ownScore: number; avgCompetitor: number; gap: number }[] } | null>(null);
  const [isCompetitorLoading, setIsCompetitorLoading] = useState(false);

  // Site Score
  const [siteDomain, setSiteDomain] = useState("");
  const [siteScore, setSiteScore] = useState<{ domain: string; pagesAnalyzed: number; nsrScore: number; siteRadius: number; siteFocusScore: number; categoryAverages: Record<string, number>; weakestCategories: { name: string; score: number }[]; pages: { url: string; score: number }[] } | null>(null);
  const [isSiteLoading, setIsSiteLoading] = useState(false);

  // Monitor
  const [monitorUrl, setMonitorUrl] = useState("");
  const [monitors, setMonitors] = useState<{ id: string; url: string; keyword: string | null; frequency: string; lastScore: number | null; lastCheckAt: string | null }[]>([]);
  const [isMonitorLoading, setIsMonitorLoading] = useState(false);

  // Task creation from checks
  const [taskUsers, setTaskUsers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [taskCreatingKey, setTaskCreatingKey] = useState<string | null>(null);
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskCreatedKeys, setTaskCreatedKeys] = useState<Set<string>>(new Set());

  const fetchTaskUsers = useCallback(async () => {
    try {
      const resp = await fetch("/api/users");
      const data = await resp.json();
      setTaskUsers(data.users || []);
    } catch { /* ignore */ }
  }, []);

  const handleCreateTask = async (check: CheckResult, categoryName: string) => {
    const key = `${categoryName}::${check.factor}`;
    try {
      const priority = check.status === "fail" ? "high" : "medium";
      const description = [
        `**URL:** ${result?.url || url}`,
        `**Kategorie:** ${categoryName}`,
        `**Status:** ${check.status === "fail" ? "Fehlgeschlagen" : "Warnung"}`,
        check.value !== null ? `**Aktueller Wert:** ${check.value}` : "",
        `**Empfehlung:** ${check.recommendation}`,
        `**Leak-Attribut:** ${check.leakAttribute}`,
        keyword ? `**Keyword:** ${keyword}` : "",
      ].filter(Boolean).join("\n");

      const resp = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `[SEO] ${check.factor}`,
          description,
          status: "backlog",
          priority,
          category: "SEO",
          labels: ["url-checker", categoryName],
          assigneeIds: taskAssignee ? [taskAssignee] : [],
        }),
      });

      if (resp.ok) {
        setTaskCreatedKeys(prev => new Set([...prev, key]));
        setTaskCreatingKey(null);
        setTaskAssignee("");
      }
    } catch { /* ignore */ }
  };

  const openTaskForm = (key: string) => {
    setTaskCreatingKey(key);
    setTaskAssignee("");
    if (taskUsers.length === 0) fetchTaskUsers();
  };

  const handleCheck = async (overrideUrl?: string, overrideKeyword?: string) => {
    const checkUrlRaw = overrideUrl || url.trim();
    const checkKeyword = overrideKeyword ?? keyword.trim();
    if (!checkUrlRaw) return;

    let checkUrl = checkUrlRaw;
    if (!checkUrl.startsWith("http://") && !checkUrl.startsWith("https://")) {
      checkUrl = "https://" + checkUrl;
    }

    if (overrideUrl) setUrl(overrideUrl);
    if (overrideKeyword !== undefined) setKeyword(overrideKeyword);

    setIsLoading(true);
    setError("");
    setResult(null);
    setAiAnalysis(null);
    setPageSpeed(null);
    setBacklinks(null);
    setActiveTab("results");

    try {
      const response = await fetch("/api/seo-helper/url-checker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: checkUrl, keyword: checkKeyword || undefined }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Fehler bei der Analyse");

      setResult(data);
      setExpandedCategories(new Set(data.categories.filter((c: CategoryResult) => c.score < 80).map((c: CategoryResult) => c.name)));

      // Auto-save to history
      fetch("/api/seo-helper/url-checker/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: data.url,
          keyword: checkKeyword || null,
          overallScore: data.overallScore,
          categories: data.categories,
          fullResult: data,
        }),
      }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAiAnalysis = async () => {
    if (!result) return;
    setIsAiLoading(true);
    setActiveTab("ai");
    try {
      const resp = await fetch("/api/seo-helper/url-checker/ai-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: result.url,
          title: result.categories.find(c => c.name === "Content Quality")?.checks.find(ch => ch.factor === "Title-Tag")?.value,
          metaDescription: "",
          textContent: "", // Will be refetched server-side if needed
          keyword: keyword.trim() || undefined,
          headings: [],
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setAiAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "KI-Analyse fehlgeschlagen");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handlePageSpeed = async () => {
    if (!result) return;
    setIsSpeedLoading(true);
    setActiveTab("speed");
    try {
      const resp = await fetch("/api/seo-helper/url-checker/pagespeed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: result.url, strategy: "mobile" }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setPageSpeed(data.metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PageSpeed-Analyse fehlgeschlagen");
    } finally {
      setIsSpeedLoading(false);
    }
  };

  const handleBacklinks = async () => {
    if (!result) return;
    setIsBacklinksLoading(true);
    setActiveTab("backlinks");
    try {
      const resp = await fetch("/api/seo-helper/url-checker/backlinks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: result.url }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setBacklinks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backlink-Analyse fehlgeschlagen");
    } finally {
      setIsBacklinksLoading(false);
    }
  };

  const handleLoadHistory = useCallback(async (switchTab = true) => {
    setIsHistoryLoading(true);
    if (switchTab) setActiveTab("history");
    try {
      const resp = await fetch("/api/seo-helper/url-checker/history?limit=30");
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setHistory(data.entries || []);
    } catch {
      setHistory([]);
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    handleLoadHistory(false);
  }, [handleLoadHistory]);

  const handleBatch = async () => {
    const urls = batchUrls.split("\n").map(u => u.trim()).filter(u => u.length > 0);
    if (urls.length === 0) return;

    setIsBatchLoading(true);
    setBatchResults([]);
    setActiveTab("batch");
    try {
      const resp = await fetch("/api/seo-helper/url-checker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: urls.map(u => u.startsWith("http") ? u : "https://" + u),
          keyword: keyword.trim() || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setBatchResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch-Analyse fehlgeschlagen");
    } finally {
      setIsBatchLoading(false);
    }
  };

  const handleCompetitor = async () => {
    if (!result) return;
    const compUrls = competitorUrls.split("\n").map(u => u.trim()).filter(u => u.length > 0);
    if (compUrls.length === 0) return;
    setIsCompetitorLoading(true);
    setActiveTab("competitor");
    try {
      const resp = await fetch("/api/seo-helper/url-checker/competitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: result.url,
          competitorUrls: compUrls.map(u => u.startsWith("http") ? u : "https://" + u),
          keyword: keyword.trim() || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setCompetitorData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vergleich fehlgeschlagen");
    } finally {
      setIsCompetitorLoading(false);
    }
  };

  const handleSiteScore = async () => {
    const domain = siteDomain.trim() || (result ? new URL(result.url).hostname : "");
    if (!domain) return;
    setIsSiteLoading(true);
    setActiveTab("site");
    try {
      const resp = await fetch("/api/seo-helper/url-checker/site-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setSiteScore(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Site-Score fehlgeschlagen");
    } finally {
      setIsSiteLoading(false);
    }
  };

  const handleAddMonitor = async () => {
    const monUrl = monitorUrl.trim() || (result ? result.url : "");
    if (!monUrl) return;
    setIsMonitorLoading(true);
    try {
      const resp = await fetch("/api/seo-helper/url-checker/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: monUrl, keyword: keyword.trim() || undefined, frequency: "weekly" }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setMonitorUrl("");
      handleLoadMonitors();
      if (data.created) setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Monitor-Erstellung fehlgeschlagen");
    } finally {
      setIsMonitorLoading(false);
    }
  };

  const handleLoadMonitors = async () => {
    try {
      const resp = await fetch("/api/seo-helper/url-checker/monitor");
      const data = await resp.json();
      setMonitors(data.monitors || []);
    } catch {
      setMonitors([]);
    }
  };

  const handleExportToKvp = async () => {
    if (!result) return;
    const failedChecks = result.categories.flatMap(c => c.checks.filter(ch => ch.status === "fail" || ch.status === "warn"));
    if (failedChecks.length === 0) return;
    try {
      const resp = await fetch("/api/seo-helper/url-checker/kvp-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: result.url, keyword: keyword.trim() || undefined, failedChecks: failedChecks.slice(0, 20) }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      alert(`${data.tasksCount} Optimierungsaufgaben in KVP exportiert!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "KVP-Export fehlgeschlagen");
    }
  };

  const handleExportCsv = () => {
    if (!result) return;
    const lines = ["Kategorie;Faktor;Status;Wert;Empfehlung;Leak-Attribut"];
    for (const cat of result.categories) {
      for (const check of cat.checks) {
        lines.push(`"${cat.name}";"${check.factor}";"${check.status}";"${check.value ?? ''}";"${check.recommendation}";"${check.leakAttribute}"`);
      }
    }
    const csv = lines.join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `url-check-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const toggleCategory = (name: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "from-emerald-500 to-teal-500";
    if (score >= 50) return "from-amber-500 to-orange-500";
    return "from-red-500 to-rose-500";
  };

  const getCategoryExplanation = (name: string): string => {
    const explanations: Record<string, string> = {
      "Technical / Indexing": "Technische Grundlagen wie Canonical-Tags, Robots-Direktiven und Ladegeschwindigkeit. Ohne korrekte Indexierung können Seiten gar nicht ranken — hier zuerst optimieren.",
      "Content Quality": "Qualität und Tiefe deines Contents nach Googles NSR- und QualityBoost-Metriken. Umfassende, einzigartige Inhalte mit klarem Mehrwert werden bevorzugt.",
      "Entity & Topicality": "Wie klar deine Seite mit bestimmten Themen und Entitäten verknüpft ist (WebRef). Verwende klare Definitionen, verlinke relevante Konzepte und stärke die semantische Klarheit.",
      "Freshness": "Aktualität des Contents. Google misst das letzte signifikante Update — regelmässig überarbeitete Inhalte mit neuen Erkenntnissen werden belohnt.",
      "Authority & Trust": "Vertrauenswürdigkeit der Domain und Seite (PageRank, NSR). Baue Authority durch hochwertige Backlinks, konsistente Qualität und transparente Absender-Informationen auf.",
      "User Experience": "Nutzererfahrung gemessen an NavBoost-Signalen (Klickverhalten) und ClutterScore (visuelle Überladung). Klare Navigation, wenig Ablenkung und schnelle Interaktion verbessern diesen Score.",
      "Hreflang & i18n": "Internationale Ausrichtung und Sprachauszeichnung. Für mehrsprachige Seiten sind korrekte hreflang-Tags entscheidend, damit Google die richtige Sprachversion anzeigt.",
      "Spam-Risiko": "Risikobewertung durch SpamBrain. Vermeide überaggressive Keyword-Stuffing, versteckte Inhalte, Link-Schemes und andere manipulative Taktiken.",
      "Keyword-Relevanz": "Wie gut dein Fokus-Keyword in Title, Headings und Content integriert ist — natürlich und semantisch breit, nicht nur exakte Matches.",
      "Structured Data": "Schema.org Markup für Rich Snippets. Strukturierte Daten helfen Google, den Inhalt zu verstehen und prominent in den Suchergebnissen darzustellen.",
    };
    return explanations[name] || "Optimiere diesen Bereich, um dein Gesamtranking zu verbessern.";
  };

  const getStatusIcon = (status: "pass" | "warn" | "fail") => {
    const configs = {
      pass: { bg: "bg-emerald-100 dark:bg-emerald-900/30", color: "text-emerald-600 dark:text-emerald-400", path: "M5 13l4 4L19 7" },
      warn: { bg: "bg-amber-100 dark:bg-amber-900/30", color: "text-amber-600 dark:text-amber-400", path: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" },
      fail: { bg: "bg-red-100 dark:bg-red-900/30", color: "text-red-600 dark:text-red-400", path: "M6 18L18 6M6 6l12 12" },
    };
    const c = configs[status];
    return (
      <div className={`w-6 h-6 rounded-full ${c.bg} flex items-center justify-center flex-shrink-0`}>
        <svg className={`w-4 h-4 ${c.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={c.path} />
        </svg>
      </div>
    );
  };

  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: "results", label: "Ergebnisse", show: !!result },
    { id: "ai", label: "KI-Analyse", show: !!result },
    { id: "speed", label: "Core Web Vitals", show: !!result },
    { id: "backlinks", label: "Backlinks", show: !!result },
    { id: "competitor", label: "Wettbewerber", show: !!result },
    { id: "site", label: "Site Score", show: true },
    { id: "batch", label: "Batch", show: true },
    { id: "monitor", label: "Monitoring", show: true },
    { id: "history", label: "Verlauf", show: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/seo-helper" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">URL Ranking Factor Checker</h1>
          <p className="text-slate-500 dark:text-slate-400">Google API Leak Ranking-Faktoren + KI + CWV + Backlinks</p>
        </div>
      </div>

      {/* URL + Keyword Input */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="flex gap-3">
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCheck()} placeholder="https://example.com/seite" className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
          <button onClick={() => handleCheck()} disabled={isLoading || !url.trim()} className="px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium rounded-xl hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/25">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                Pr&uuml;fe...
              </div>
            ) : "Prüfen"}
          </button>
        </div>
        <div className="flex gap-3">
          <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Fokus-Keyword (optional)" className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm" />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          27+ Checks basierend auf Google Content Warehouse API Leak (2024): NSR, QualityBoost, NavBoost, WebRef, FreshnessTwiddler, SpamBrain
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-red-700 dark:text-red-300">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl overflow-x-auto">
          {tabs.filter(t => t.show).map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === "history") handleLoadHistory(); if (tab.id === "ai" && !aiAnalysis && !isAiLoading) handleAiAnalysis(); if (tab.id === "speed" && !pageSpeed && !isSpeedLoading) handlePageSpeed(); if (tab.id === "backlinks" && !backlinks && !isBacklinksLoading) handleBacklinks(); if (tab.id === "monitor") handleLoadMonitors(); }} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.id ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>
              {tab.label}
            </button>
          ))}
      </div>

      {/* Tab: Results */}
      {activeTab === "results" && result && (
        <div className="space-y-6">
          {/* Overall Score + Export */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Gesamtbewertung</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                  Gewichteter Score – {result.categories.length} Kategorien
                  {result.keyword && <span className="ml-2 px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded text-xs">Keyword: {result.keyword}</span>}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-mono truncate max-w-sm">{result.url}</p>
                <button onClick={handleExportCsv} className="mt-3 text-xs text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  CSV Export
                </button>
                <button onClick={handleExportToKvp} className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  In KVP exportieren
                </button>
              </div>
              <div className="relative w-32 h-32">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100 dark:text-slate-700" />
                  <circle cx="60" cy="60" r="50" fill="none" strokeWidth="8" strokeDasharray={`${(result.overallScore / 100) * 314} 314`} strokeLinecap="round" className={result.overallScore >= 80 ? "text-emerald-500" : result.overallScore >= 50 ? "text-amber-500" : "text-red-500"} stroke="currentColor" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-3xl font-bold ${getScoreColor(result.overallScore)}`}>{result.overallScore}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-8">
              {result.categories.map((cat) => (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate">{cat.name}</span>
                    <span className={`text-xs font-bold ${getScoreColor(cat.score)}`}>{cat.score}</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${getScoreBg(cat.score)} transition-all duration-500`} style={{ width: `${cat.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category Details */}
          {result.categories.map((category) => (
            <div key={category.name} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button onClick={() => toggleCategory(category.name)} className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${getScoreBg(category.score)}`} />
                  <div className="text-left">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{category.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{category.leakReference}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold ${getScoreColor(category.score)}`}>{category.score}/100</span>
                  <svg className={`w-5 h-5 text-slate-400 transition-transform ${expandedCategories.has(category.name) ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </button>
              {expandedCategories.has(category.name) && (
                <div className="px-6 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-700 pt-4">
                  {category.checks.map((check, idx) => {
                    const checkKey = `${category.name}::${check.factor}`;
                    const isTaskCreated = taskCreatedKeys.has(checkKey);
                    const isFormOpen = taskCreatingKey === checkKey;
                    return (
                    <div key={idx} className="flex gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                      {getStatusIcon(check.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium text-slate-900 dark:text-white text-sm">{check.factor}</h4>
                          {check.value !== null && <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-600 px-2 py-0.5 rounded flex-shrink-0">{String(check.value).slice(0, 50)}</span>}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{check.recommendation}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-violet-600 dark:text-violet-400 font-mono">{check.leakAttribute}</span>
                          {check.status !== "pass" && !isTaskCreated && !isFormOpen && (
                            <button
                              onClick={() => openTaskForm(checkKey)}
                              className="ml-auto text-xs px-2.5 py-1 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors font-medium"
                            >
                              Task erstellen
                            </button>
                          )}
                          {isTaskCreated && (
                            <span className="ml-auto text-xs px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              Task erstellt
                            </span>
                          )}
                        </div>
                        {isFormOpen && (
                          <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600">
                            <select
                              value={taskAssignee}
                              onChange={e => setTaskAssignee(e.target.value)}
                              className="flex-1 text-xs px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                            >
                              <option value="">Ohne Zuweisung</option>
                              {taskUsers.map(u => (
                                <option key={u.id} value={u.id}>{u.name || u.email}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleCreateTask(check, category.name)}
                              className="text-xs px-3 py-1.5 rounded-md bg-violet-600 text-white hover:bg-violet-700 font-medium whitespace-nowrap"
                            >
                              Erstellen
                            </button>
                            <button
                              onClick={() => setTaskCreatingKey(null)}
                              className="text-xs px-2 py-1.5 rounded-md text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab: AI Analysis */}
      {activeTab === "ai" && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">KI-gestützte Content-Analyse</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Bewertung basierend auf E-E-A-T, Topical Authority und Entity-Erkennung (WebRef-Analog)</p>
          {isAiLoading && <div className="flex items-center gap-3 text-slate-500"><svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>KI analysiert...</div>}
          {aiAnalysis && (
            <div className="space-y-4">
              {Object.entries(aiAnalysis).map(([key, val]) => (
                <div key={key} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-slate-900 dark:text-white capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</h3>
                    <span className={`text-lg font-bold ${getScoreColor(val.score)}`}>{val.score}/100</span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden mb-2">
                    <div className={`h-full rounded-full bg-gradient-to-r ${getScoreBg(val.score)}`} style={{ width: `${val.score}%` }} />
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{val.analysis}</p>
                </div>
              ))}
            </div>
          )}
          {!isAiLoading && !aiAnalysis && <button onClick={handleAiAnalysis} className="px-4 py-2 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-lg text-sm hover:bg-violet-200">KI-Analyse starten</button>}
        </div>
      )}

      {/* Tab: PageSpeed */}
      {activeTab === "speed" && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Core Web Vitals (NavBoost-Proxy)</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Google PageSpeed Insights – Bezug: NavBoost bevorzugt schnelle Seiten mit guter Nutzererfahrung</p>
          {isSpeedLoading && <div className="flex items-center gap-3 text-slate-500"><svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Messe Performance...</div>}
          {pageSpeed && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className={`text-4xl font-bold ${getScoreColor(pageSpeed.performanceScore)}`}>{pageSpeed.performanceScore}</div>
                <div className="text-sm text-slate-500">Performance Score ({pageSpeed.strategy})</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: "LCP", value: pageSpeed.lcp.value, unit: "ms", score: pageSpeed.lcp.score },
                  { label: "CLS", value: Math.round(pageSpeed.cls.value * 1000) / 1000, unit: "", score: pageSpeed.cls.score },
                  { label: "INP", value: pageSpeed.inp.value, unit: "ms", score: pageSpeed.inp.score },
                  { label: "FCP", value: pageSpeed.fcp.value, unit: "ms", score: pageSpeed.fcp.score },
                  { label: "TTFB", value: pageSpeed.ttfb.value, unit: "ms", score: pageSpeed.ttfb.score },
                ].map(m => (
                  <div key={m.label} className={`p-4 rounded-xl border-2 ${m.score === 'good' ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20' : m.score === 'needs-improvement' ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'}`}>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{m.label}</div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{Math.round(m.value as number)}<span className="text-sm font-normal text-slate-500 ml-1">{m.unit}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!isSpeedLoading && !pageSpeed && <button onClick={handlePageSpeed} className="px-4 py-2 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-lg text-sm hover:bg-violet-200">CWV messen</button>}
        </div>
      )}

      {/* Tab: Backlinks */}
      {activeTab === "backlinks" && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Authority & Backlinks</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Bezug: NSR siteAuthority, PageRank, siteLinkIn</p>
          {isBacklinksLoading && <div className="flex items-center gap-3 text-slate-500"><svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Lade Backlink-Daten...</div>}
          {backlinks && (
            <div className="space-y-6">
              <h3 className="font-medium text-slate-700 dark:text-slate-300">Domain: {backlinks.domain.target}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Domain Rank", value: backlinks.domain.domainRank },
                  { label: "Backlinks", value: backlinks.domain.totalBacklinks.toLocaleString() },
                  { label: "Referring Domains", value: backlinks.domain.referringDomains.toLocaleString() },
                  { label: "Dofollow", value: backlinks.domain.dofollowBacklinks.toLocaleString() },
                ].map(m => (
                  <div key={m.label} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                    <div className="text-xs font-medium text-slate-500">{m.label}</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">{m.value}</div>
                  </div>
                ))}
              </div>
              {backlinks.page && (
                <>
                  <h3 className="font-medium text-slate-700 dark:text-slate-300 mt-4">Diese Seite</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50"><div className="text-xs text-slate-500">Backlinks</div><div className="text-xl font-bold text-slate-900 dark:text-white">{backlinks.page.totalBacklinks}</div></div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50"><div className="text-xs text-slate-500">Ref. Domains</div><div className="text-xl font-bold text-slate-900 dark:text-white">{backlinks.page.referringDomains}</div></div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50"><div className="text-xs text-slate-500">Page Rank</div><div className="text-xl font-bold text-slate-900 dark:text-white">{backlinks.page.domainRank}</div></div>
                  </div>
                </>
              )}
            </div>
          )}
          {!isBacklinksLoading && !backlinks && <button onClick={handleBacklinks} className="px-4 py-2 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-lg text-sm hover:bg-violet-200">Backlinks laden</button>}
        </div>
      )}

      {/* Tab: Batch */}
      {activeTab === "batch" && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Batch-Analyse (max. 10 URLs)</h2>
          <textarea value={batchUrls} onChange={e => setBatchUrls(e.target.value)} placeholder="Eine URL pro Zeile..." rows={6} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-mono" />
          <button onClick={handleBatch} disabled={isBatchLoading || !batchUrls.trim()} className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {isBatchLoading ? "Analysiere..." : "Batch prüfen"}
          </button>
          {batchResults.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 px-3 text-slate-600 dark:text-slate-400">URL</th>
                  <th className="text-center py-2 px-3 text-slate-600 dark:text-slate-400">Score</th>
                  <th className="text-left py-2 px-3 text-slate-600 dark:text-slate-400">Status</th>
                </tr></thead>
                <tbody>
                  {batchResults.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50">
                      <td className="py-2 px-3 font-mono text-xs truncate max-w-[300px]">{'url' in r ? r.url : ''}</td>
                      <td className="py-2 px-3 text-center">
                        {'overallScore' in r ? <span className={`font-bold ${getScoreColor(r.overallScore)}`}>{r.overallScore}</span> : <span className="text-red-500">-</span>}
                      </td>
                      <td className="py-2 px-3">{'error' in r ? <span className="text-red-500 text-xs">{r.error}</span> : <span className="text-emerald-500 text-xs">OK</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: History */}
      {activeTab === "history" && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Analyse-Verlauf</h2>
          {isHistoryLoading && <p className="text-slate-500">Lade...</p>}
          {!isHistoryLoading && history.length === 0 && <p className="text-slate-500 text-sm">Noch keine gespeicherten Analysen.</p>}
          {history.length > 0 && (
            <div className="space-y-2">
              {history.map(entry => (
                <button key={entry.id} onClick={() => handleCheck(entry.url, entry.keyword || "")} className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-mono text-slate-700 dark:text-slate-300 truncate">{entry.url}</p>
                    <p className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString("de-DE")} {entry.keyword && `• Keyword: ${entry.keyword}`}</p>
                  </div>
                  <span className={`text-lg font-bold ml-4 ${getScoreColor(entry.overallScore)}`}>{entry.overallScore}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Competitor */}
      {activeTab === "competitor" && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Wettbewerbs-Vergleich</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Vergleiche deine Seite mit bis zu 3 Wettbewerber-URLs</p>
          <textarea value={competitorUrls} onChange={e => setCompetitorUrls(e.target.value)} placeholder="Wettbewerber-URLs (eine pro Zeile, max. 3)..." rows={3} className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-mono" />
          <button onClick={handleCompetitor} disabled={isCompetitorLoading || !competitorUrls.trim()} className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {isCompetitorLoading ? "Vergleiche..." : "Vergleichen"}
          </button>
          {competitorData && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 border-2 border-violet-200 dark:border-violet-800">
                  <div className="text-xs text-violet-600 dark:text-violet-400 font-medium">Eigene Seite</div>
                  <div className={`text-2xl font-bold ${getScoreColor(competitorData.own.overallScore)}`}>{competitorData.own.overallScore}</div>
                  <div className="text-xs text-slate-500 truncate">{competitorData.own.url}</div>
                </div>
                {competitorData.competitors.map((c, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                    <div className="text-xs text-slate-500 font-medium">Wettbewerber {i + 1}</div>
                    {'overallScore' in c ? (
                      <>
                        <div className={`text-2xl font-bold ${getScoreColor(c.overallScore)}`}>{c.overallScore}</div>
                        <div className="text-xs text-slate-500 truncate">{c.url}</div>
                      </>
                    ) : (
                      <div className="text-red-500 text-sm">{c.error}</div>
                    )}
                  </div>
                ))}
              </div>
              {competitorData.gaps.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-medium text-slate-900 dark:text-white mb-2">Größter Rückstand</h3>
                  <div className="space-y-2">
                    {competitorData.gaps.map(gap => (
                      <div key={gap.category} className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{gap.category}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-red-600">Du: {gap.ownScore}</span>
                          <span className="text-sm text-emerald-600">Ø Wettbewerb: {gap.avgCompetitor}</span>
                          <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">-{gap.gap}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Site Score (NSR + Topical Authority) */}
      {activeTab === "site" && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Site-Level NSR Score & Topical Authority</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Analysiert mehrere Seiten einer Domain um siteFocusScore, siteRadius und NSR abzuschätzen</p>
          <div className="flex gap-3">
            <input type="text" value={siteDomain} onChange={e => setSiteDomain(e.target.value)} placeholder={result ? new URL(result.url).hostname : "domain.com"} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm" />
            <button onClick={handleSiteScore} disabled={isSiteLoading} className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {isSiteLoading ? "Analysiere..." : "Domain prüfen"}
            </button>
          </div>
          {siteScore && (
            <div className="space-y-6 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <div className="text-center">
                    <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">NSR Score</div>
                    <div className={`text-3xl font-bold ${getScoreColor(siteScore.nsrScore)}`}>{siteScore.nsrScore}</div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">Gesamtqualität der Domain (0–100). Basiert auf Googles Normalized Site Rank — je höher, desto autoritärer stuft Google die Seite ein.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <div className="text-center">
                    <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Site Focus</div>
                    <div className={`text-3xl font-bold ${getScoreColor(siteScore.siteFocusScore)}`}>{siteScore.siteFocusScore}</div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">Thematische Konsistenz (0–100). Ein hoher Wert bedeutet, dass alle Seiten einer klaren Themenlinie folgen — wichtig für Topical Authority.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <div className="text-center">
                    <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Site Radius</div>
                    <div className="text-3xl font-bold text-slate-700 dark:text-slate-300">{siteScore.siteRadius}</div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">Qualitäts-Streuung zwischen Seiten. Niedrig = gleichmässig gute Qualität. Hoch = grosse Schwankungen — schwache Seiten ziehen die Domain runter.</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <div className="text-center">
                    <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Seiten</div>
                    <div className="text-3xl font-bold text-slate-700 dark:text-slate-300">{siteScore.pagesAnalyzed}</div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">Anzahl erfolgreich analysierter Unterseiten. Mehr analysierte Seiten = zuverlässigere Gesamtbewertung.</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4">
                <h3 className="font-medium text-slate-700 dark:text-slate-300 mb-1">Schwächste Kategorien</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Diese Bereiche haben den grössten negativen Einfluss auf dein Ranking. Fokussiere deine Optimierung hier.</p>
                <div className="space-y-3">
                  {siteScore.weakestCategories.map(cat => (
                    <div key={cat.name} className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{cat.name}</span>
                        <span className={`text-lg font-bold ${getScoreColor(cat.score)}`}>{cat.score}</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-1.5 mb-2">
                        <div className={`h-1.5 rounded-full ${cat.score >= 70 ? 'bg-emerald-500' : cat.score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${cat.score}%` }} />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{getCategoryExplanation(cat.name)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium text-slate-700 dark:text-slate-300 mb-1">Analysierte Seiten</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Einzelergebnisse der geprüften Unterseiten — grosse Score-Unterschiede deuten auf inkonsistente Qualität hin.</p>
                {siteScore.pages.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <span className="text-xs font-mono text-slate-500 truncate max-w-[300px]">{p.url}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-200 dark:bg-slate-600 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${p.score >= 70 ? 'bg-emerald-500' : p.score >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${p.score}%` }} />
                      </div>
                      <span className={`text-sm font-bold w-8 text-right ${getScoreColor(p.score)}`}>{p.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Monitor */}
      {activeTab === "monitor" && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Automatisches Monitoring</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Wöchentliche Checks + Alerts bei Score-Veränderungen</p>
          <div className="flex gap-3">
            <input type="text" value={monitorUrl} onChange={e => setMonitorUrl(e.target.value)} placeholder={result ? result.url : "URL zum Monitoren..."} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm font-mono" />
            <button onClick={handleAddMonitor} disabled={isMonitorLoading} className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              Hinzufügen
            </button>
          </div>
          {monitors.length > 0 && (
            <div className="mt-4 space-y-2">
              {monitors.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-mono text-slate-700 dark:text-slate-300 truncate">{m.url}</p>
                    <p className="text-xs text-slate-500">{m.frequency} {m.keyword && `• ${m.keyword}`} {m.lastCheckAt && `• Letzter Check: ${new Date(m.lastCheckAt).toLocaleDateString('de-DE')}`}</p>
                  </div>
                  {m.lastScore !== null && <span className={`text-lg font-bold ml-4 ${getScoreColor(m.lastScore)}`}>{m.lastScore}</span>}
                </div>
              ))}
            </div>
          )}
          {monitors.length === 0 && !isMonitorLoading && <p className="text-sm text-slate-500">Noch keine URLs im Monitoring.</p>}
        </div>
      )}

      {result && activeTab === "results" && (
        <div className="text-center text-xs text-slate-400 dark:text-slate-500 py-4">
          Analyse: {new Date(result.fetchedAt).toLocaleString("de-DE")} · Google Content Warehouse API Leak
        </div>
      )}
    </div>
  );
}
