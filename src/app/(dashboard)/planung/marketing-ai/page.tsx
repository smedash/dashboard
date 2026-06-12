"use client";

import { useState, useEffect, useCallback } from "react";

interface MarketingAction {
  id: string;
  title: string;
  description: string;
  priority: string;
  effort: string | null;
  impact: string | null;
  completed: boolean;
}

interface StrategyDetails {
  goals?: string[];
  targetAudience?: string;
  keyInsights?: string[];
  recommendations?: string[];
  timeline?: string;
  kpis?: string[];
}

interface MarketingStrategy {
  id: string;
  channel: string;
  title: string;
  summary: string;
  details: StrategyDetails;
  status: string;
  period: string | null;
  actions: MarketingAction[];
  dataContext: {
    generatedAt?: string;
    dataPoints?: {
      topicGraphs?: number;
      questionSets?: number;
      keywordVolumes?: number;
      trends?: number;
      intents?: number;
    };
  } | null;
  createdAt: string;
}

const CHANNELS = [
  { id: "organic_seo", label: "Organic SEO", color: "blue", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { id: "social_media", label: "Social Media", color: "pink", icon: "M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" },
  { id: "newsletter", label: "Newsletter", color: "amber", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { id: "out_of_home", label: "Out of Home", color: "emerald", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { id: "cooperations", label: "Kooperationen", color: "violet", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
  { id: "tv_campaigns", label: "TV Kampagnen", color: "red", icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" },
] as const;

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string; tabActive: string; tabHover: string }> = {
  blue: { bg: "bg-blue-900/20", text: "text-blue-400", border: "border-blue-500/30", badge: "bg-blue-500/20 text-blue-300", tabActive: "bg-blue-600 text-white", tabHover: "hover:bg-blue-900/30" },
  pink: { bg: "bg-pink-900/20", text: "text-pink-400", border: "border-pink-500/30", badge: "bg-pink-500/20 text-pink-300", tabActive: "bg-pink-600 text-white", tabHover: "hover:bg-pink-900/30" },
  amber: { bg: "bg-amber-900/20", text: "text-amber-400", border: "border-amber-500/30", badge: "bg-amber-500/20 text-amber-300", tabActive: "bg-amber-600 text-white", tabHover: "hover:bg-amber-900/30" },
  emerald: { bg: "bg-emerald-900/20", text: "text-emerald-400", border: "border-emerald-500/30", badge: "bg-emerald-500/20 text-emerald-300", tabActive: "bg-emerald-600 text-white", tabHover: "hover:bg-emerald-900/30" },
  violet: { bg: "bg-violet-900/20", text: "text-violet-400", border: "border-violet-500/30", badge: "bg-violet-500/20 text-violet-300", tabActive: "bg-violet-600 text-white", tabHover: "hover:bg-violet-900/30" },
  red: { bg: "bg-red-900/20", text: "text-red-400", border: "border-red-500/30", badge: "bg-red-500/20 text-red-300", tabActive: "bg-red-600 text-white", tabHover: "hover:bg-red-900/30" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high: { label: "Hoch", color: "bg-red-500/20 text-red-300" },
  medium: { label: "Mittel", color: "bg-amber-500/20 text-amber-300" },
  low: { label: "Niedrig", color: "bg-emerald-500/20 text-emerald-300" },
};

const EFFORT_LABELS: Record<string, string> = { low: "Gering", medium: "Mittel", high: "Hoch" };
const IMPACT_LABELS: Record<string, string> = { low: "Gering", medium: "Mittel", high: "Hoch" };

export default function MarketingAIPage() {
  const [strategies, setStrategies] = useState<Record<string, MarketingStrategy>>({});
  const [activeTab, setActiveTab] = useState<string>(CHANNELS[0].id);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["details", "actions"]));

  const loadStrategies = useCallback(async () => {
    try {
      const res = await fetch("/api/planung/marketing-ai");
      if (!res.ok) throw new Error("Fehler beim Laden");
      const json = await res.json();

      const map: Record<string, MarketingStrategy> = {};
      for (const s of json.strategies) {
        map[s.channel] = s;
      }
      setStrategies(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  const generateStrategy = async (channel: string) => {
    setGenerating(channel);
    setError(null);
    try {
      const res = await fetch("/api/planung/marketing-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Fehler bei der Generierung");
      }

      const strategy = await res.json();
      setStrategies((prev) => ({ ...prev, [channel]: strategy }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler bei der Generierung");
    } finally {
      setGenerating(null);
    }
  };

  const toggleAction = async (actionId: string, completed: boolean) => {
    try {
      await fetch("/api/planung/marketing-ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, completed }),
      });

      setStrategies((prev) => {
        const next = { ...prev };
        for (const [ch, strategy] of Object.entries(next)) {
          const actionIndex = strategy.actions.findIndex((a) => a.id === actionId);
          if (actionIndex >= 0) {
            const updatedActions = [...strategy.actions];
            updatedActions[actionIndex] = { ...updatedActions[actionIndex], completed };
            next[ch] = { ...strategy, actions: updatedActions };
            break;
          }
        }
        return next;
      });
    } catch {
      // silent fail, reload on next page visit
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const activeChannel = CHANNELS.find((c) => c.id === activeTab)!;
  const activeStrategy = strategies[activeTab];
  const colors = COLOR_MAP[activeChannel.color];
  const totalStrategies = Object.keys(strategies).length;
  const completedActions = Object.values(strategies).reduce(
    (sum, s) => sum + s.actions.filter((a) => a.completed).length,
    0
  );
  const totalActions = Object.values(strategies).reduce(
    (sum, s) => sum + s.actions.length,
    0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          <p className="text-sm text-slate-400">Strategien werden geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
            </svg>
            Marketing AI
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            KI-gestützte Marketing-Strategien basierend auf deinen SEO- und Keyword-Daten
          </p>
        </div>
        <div className="flex items-center gap-3">
          {totalStrategies > 0 && (
            <div className="text-right text-xs text-slate-500">
              <span className="text-slate-300 font-medium">{totalStrategies}</span>/{CHANNELS.length} Kanäle
              {totalActions > 0 && (
                <> · <span className="text-emerald-400">{completedActions}</span>/{totalActions} Massnahmen</>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-red-300 mt-1 underline">
              Schliessen
            </button>
          </div>
        </div>
      )}

      {/* Channel Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {CHANNELS.map((channel) => {
          const isActive = activeTab === channel.id;
          const hasStrategy = !!strategies[channel.id];
          const channelColors = COLOR_MAP[channel.color];

          return (
            <button
              key={channel.id}
              onClick={() => setActiveTab(channel.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? channelColors.tabActive
                  : `text-slate-400 ${channelColors.tabHover} hover:text-slate-200`
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={channel.icon} />
              </svg>
              {channel.label}
              {hasStrategy && (
                <span className={`w-2 h-2 rounded-full ${isActive ? "bg-white/60" : "bg-emerald-400"}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Active Channel Content */}
      <div className={`border rounded-xl ${colors.border} overflow-hidden`}>
        {activeStrategy ? (
          <div className="divide-y divide-slate-700/50">
            {/* Strategy Header */}
            <div className={`${colors.bg} p-6`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-lg font-bold text-white">{activeStrategy.title}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>
                      {activeChannel.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{activeStrategy.summary}</p>
                  {activeStrategy.dataContext?.generatedAt && (
                    <p className="text-xs text-slate-500 mt-3">
                      Generiert am {new Date(activeStrategy.dataContext.generatedAt).toLocaleDateString("de-CH", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => generateStrategy(activeTab)}
                  disabled={generating === activeTab}
                  className="ml-4 flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-sm text-slate-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  {generating === activeTab ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full" />
                      Generiert...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Neu generieren
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Strategy Details */}
            <div className="bg-slate-800/30">
              <button
                onClick={() => toggleSection("details")}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-700/20 transition-colors"
              >
                <h3 className="text-sm font-semibold text-slate-300">Strategie-Details</h3>
                <svg
                  className={`w-4 h-4 text-slate-500 transition-transform ${expandedSections.has("details") ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedSections.has("details") && (
                <div className="px-6 pb-6 space-y-5">
                  {activeStrategy.details.targetAudience && (
                    <div>
                      <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Zielgruppe</h4>
                      <p className="text-sm text-slate-300">{activeStrategy.details.targetAudience}</p>
                    </div>
                  )}

                  {activeStrategy.details.goals && activeStrategy.details.goals.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Ziele</h4>
                      <ul className="space-y-1.5">
                        {activeStrategy.details.goals.map((goal, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                            <svg className={`w-4 h-4 ${colors.text} flex-shrink-0 mt-0.5`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            {goal}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {activeStrategy.details.keyInsights && activeStrategy.details.keyInsights.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Daten-Insights</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {activeStrategy.details.keyInsights.map((insight, i) => (
                          <div key={i} className="bg-slate-700/30 rounded-lg p-3 text-xs text-slate-300">
                            {insight}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeStrategy.details.recommendations && activeStrategy.details.recommendations.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Empfehlungen</h4>
                      <ul className="space-y-1.5">
                        {activeStrategy.details.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                            <span className={`${colors.text} font-bold text-xs mt-0.5`}>{i + 1}.</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-6">
                    {activeStrategy.details.timeline && (
                      <div>
                        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Timeline</h4>
                        <p className="text-sm text-slate-300">{activeStrategy.details.timeline}</p>
                      </div>
                    )}
                    {activeStrategy.details.kpis && activeStrategy.details.kpis.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">KPIs</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {activeStrategy.details.kpis.map((kpi, i) => (
                            <span key={i} className="text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded">
                              {kpi}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="bg-slate-800/30">
              <button
                onClick={() => toggleSection("actions")}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-700/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-slate-300">Massnahmen</h3>
                  <span className="text-xs text-slate-500">
                    {activeStrategy.actions.filter((a) => a.completed).length}/{activeStrategy.actions.length} erledigt
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 text-slate-500 transition-transform ${expandedSections.has("actions") ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {expandedSections.has("actions") && (
                <div className="px-6 pb-6 space-y-3">
                  {activeStrategy.actions.map((action) => (
                    <div
                      key={action.id}
                      className={`border border-slate-700/50 rounded-lg p-4 transition-all ${
                        action.completed ? "opacity-60 bg-slate-800/20" : "bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleAction(action.id, !action.completed)}
                          className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                            action.completed
                              ? "bg-emerald-500 border-emerald-500"
                              : "border-slate-600 hover:border-slate-400"
                          }`}
                        >
                          {action.completed && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className={`text-sm font-medium ${action.completed ? "text-slate-500 line-through" : "text-slate-200"}`}>
                              {action.title}
                            </h4>
                            {PRIORITY_CONFIG[action.priority] && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${PRIORITY_CONFIG[action.priority].color}`}>
                                {PRIORITY_CONFIG[action.priority].label}
                              </span>
                            )}
                            {action.effort && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">
                                Aufwand: {EFFORT_LABELS[action.effort] || action.effort}
                              </span>
                            )}
                            {action.impact && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">
                                Impact: {IMPACT_LABELS[action.impact] || action.impact}
                              </span>
                            )}
                          </div>
                          <p className={`text-xs mt-1 leading-relaxed ${action.completed ? "text-slate-600" : "text-slate-400"}`}>
                            {action.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Data Context (collapsible) */}
            {activeStrategy.dataContext?.dataPoints && (
              <div className="bg-slate-800/30">
                <button
                  onClick={() => toggleSection("datacontext")}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-700/20 transition-colors"
                >
                  <h3 className="text-sm font-semibold text-slate-300">Daten-Grundlage</h3>
                  <svg
                    className={`w-4 h-4 text-slate-500 transition-transform ${expandedSections.has("datacontext") ? "rotate-180" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.has("datacontext") && (
                  <div className="px-6 pb-6">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {[
                        { label: "Topic-Graphen", value: activeStrategy.dataContext.dataPoints.topicGraphs },
                        { label: "Fragen-Sets", value: activeStrategy.dataContext.dataPoints.questionSets },
                        { label: "Keyword-Volumen", value: activeStrategy.dataContext.dataPoints.keywordVolumes },
                        { label: "Trend-Daten", value: activeStrategy.dataContext.dataPoints.trends },
                        { label: "Intent-Daten", value: activeStrategy.dataContext.dataPoints.intents },
                      ].map((dp) => (
                        <div key={dp.label} className="bg-slate-700/30 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold text-slate-200">{(dp.value || 0).toLocaleString("de-DE")}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">{dp.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Empty State */
          <div className={`${colors.bg} p-12 text-center`}>
            <div className={`inline-flex p-4 rounded-2xl bg-slate-700/30 mb-4`}>
              <svg className={`w-10 h-10 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={activeChannel.icon} />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {activeChannel.label} Strategie
            </h3>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              Noch keine Strategie für diesen Kanal vorhanden. Lasse die KI basierend auf deinen SEO- und Keyword-Daten eine massgeschneiderte Strategie generieren.
            </p>
            <button
              onClick={() => generateStrategy(activeTab)}
              disabled={generating === activeTab}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-sm transition-all disabled:opacity-50 ${colors.tabActive} hover:opacity-90`}
            >
              {generating === activeTab ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white/50 border-t-white rounded-full" />
                  KI analysiert Daten...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  Strategie generieren
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Generate All Button */}
      {totalStrategies < CHANNELS.length && (
        <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 text-center">
          <p className="text-sm text-slate-400 mb-4">
            {totalStrategies === 0
              ? "Starte mit der Generierung aller Kanal-Strategien auf einmal."
              : `${CHANNELS.length - totalStrategies} Kanäle haben noch keine Strategie.`}
          </p>
          <button
            onClick={async () => {
              const missing = CHANNELS.filter((c) => !strategies[c.id]);
              for (const channel of missing) {
                await generateStrategy(channel.id);
              }
            }}
            disabled={generating !== null}
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            {generating ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white/50 border-t-white rounded-full" />
                Generierung läuft...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                </svg>
                Alle fehlenden Strategien generieren
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
