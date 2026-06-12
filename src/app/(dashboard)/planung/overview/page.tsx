"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

interface OverviewData {
  topicStats: {
    total: number;
    succeeded: number;
    totalTopics: number;
    byCategory: { category: string; count: number; topics: number }[];
  };
  questionStats: {
    total: number;
    totalQuestions: number;
    byCategory: { category: string; count: number; questions: number }[];
  };
  keywordStats: {
    totalResearched: number;
    totalSuggestions: number;
    avgSearchVolume: number;
    difficultyDistribution: { easy: number; medium: number; hard: number };
    intentDistribution: Record<string, number>;
    byCategory: { category: string; count: number; suggestions: number }[];
  };
  gscStats: {
    gscKeywordCount: number;
    totalTrends: number;
    totalIntents: number;
    totalVolumes: number;
    intentDistribution: { label: string; count: number }[];
    trendDistribution: { direction: string; count: number }[];
  };
  seedStats: { category: string; count: number }[];
}

const INTENT_COLORS: Record<string, string> = {
  informational: "#3b82f6",
  navigational: "#a855f7",
  commercial: "#f59e0b",
  transactional: "#10b981",
};

const INTENT_LABELS: Record<string, string> = {
  informational: "Informational",
  navigational: "Navigational",
  commercial: "Commercial",
  transactional: "Transactional",
};

const TREND_COLORS: Record<string, string> = {
  up: "#10b981",
  stable: "#94a3b8",
  down: "#ef4444",
};

const TREND_LABELS: Record<string, string> = {
  up: "Steigend",
  stable: "Stabil",
  down: "Fallend",
};

const DIFFICULTY_COLORS = ["#10b981", "#f59e0b", "#ef4444"];

const CATEGORY_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#a855f7",
  "#ef4444",
  "#06b6d4",
  "#f97316",
  "#ec4899",
];

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  color,
  href,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  href?: string;
}) {
  const card = (
    <div className={`bg-slate-800/50 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-colors ${href ? "cursor-pointer" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>
            {typeof value === "number" ? value.toLocaleString("de-DE") : value}
          </p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-lg bg-slate-700/50 ${color}`}>{icon}</div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{card}</Link>;
  }
  return card;
}

function ChartCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-slate-800/50 border border-slate-700 rounded-xl p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-slate-300 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function PlanungOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/planung/overview");
        if (!res.ok) throw new Error("Fehler beim Laden");
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          <p className="text-sm text-slate-400">Dashboard wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-300">{error || "Keine Daten verfügbar"}</p>
      </div>
    );
  }

  const intentPieData = data.gscStats.intentDistribution.map((d) => ({
    name: INTENT_LABELS[d.label] || d.label,
    value: d.count,
    fill: INTENT_COLORS[d.label] || "#64748b",
  }));

  const trendPieData = data.gscStats.trendDistribution.map((d) => ({
    name: TREND_LABELS[d.direction] || d.direction,
    value: d.count,
    fill: TREND_COLORS[d.direction] || "#64748b",
  }));

  const difficultyBarData = [
    { name: "Leicht (0-30)", value: data.keywordStats.difficultyDistribution.easy, fill: DIFFICULTY_COLORS[0] },
    { name: "Mittel (31-60)", value: data.keywordStats.difficultyDistribution.medium, fill: DIFFICULTY_COLORS[1] },
    { name: "Schwer (61-100)", value: data.keywordStats.difficultyDistribution.hard, fill: DIFFICULTY_COLORS[2] },
  ];

  const kwIntentData = Object.entries(data.keywordStats.intentDistribution).map(([label, count]) => ({
    name: INTENT_LABELS[label] || label,
    value: count,
    fill: INTENT_COLORS[label] || "#64748b",
  }));

  const allCategories = new Map<string, { topics: number; keywords: number; questions: number; seeds: number }>();

  for (const tc of data.topicStats.byCategory) {
    const entry = allCategories.get(tc.category) || { topics: 0, keywords: 0, questions: 0, seeds: 0 };
    entry.topics = tc.topics;
    allCategories.set(tc.category, entry);
  }
  for (const kc of data.keywordStats.byCategory) {
    const entry = allCategories.get(kc.category) || { topics: 0, keywords: 0, questions: 0, seeds: 0 };
    entry.keywords = kc.suggestions;
    allCategories.set(kc.category, entry);
  }
  for (const qc of data.questionStats.byCategory) {
    const entry = allCategories.get(qc.category) || { topics: 0, keywords: 0, questions: 0, seeds: 0 };
    entry.questions = qc.questions;
    allCategories.set(qc.category, entry);
  }
  for (const sc of data.seedStats) {
    const entry = allCategories.get(sc.category) || { topics: 0, keywords: 0, questions: 0, seeds: 0 };
    entry.seeds = sc.count;
    allCategories.set(sc.category, entry);
  }

  const categoryBarData = Array.from(allCategories.entries())
    .map(([category, vals]) => ({ category, ...vals }))
    .sort((a, b) => (b.topics + b.keywords + b.questions) - (a.topics + a.keywords + a.questions));

  const totalSeedKeywords = data.seedStats.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Marketing Planung — Übersicht</h1>
        <p className="text-sm text-slate-400 mt-1">
          Aggregierte Daten und Insights aus allen 4 Planungs-Modulen
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="GSC Keywords"
          value={data.gscStats.gscKeywordCount}
          subtitle={`${data.gscStats.totalIntents.toLocaleString("de-DE")} Intents · ${data.gscStats.totalTrends.toLocaleString("de-DE")} Trends · ${data.gscStats.totalVolumes.toLocaleString("de-DE")} Volumen`}
          color="text-blue-400"
          href="/planung/marketing"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <KpiCard
          title="Topic-Graphs"
          value={data.topicStats.succeeded}
          subtitle={`${data.topicStats.totalTopics.toLocaleString("de-DE")} Unterthemen gefunden`}
          color="text-emerald-400"
          href="/planung/topics"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          }
        />
        <KpiCard
          title="Keyword-Recherchen"
          value={data.keywordStats.totalResearched}
          subtitle={`${data.keywordStats.totalSuggestions.toLocaleString("de-DE")} Vorschläge · Ø ${data.keywordStats.avgSearchVolume.toLocaleString("de-DE")} SV`}
          color="text-amber-400"
          href="/planung/keywords"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          }
        />
        <KpiCard
          title="Fragen-Sets"
          value={data.questionStats.total}
          subtitle={`${data.questionStats.totalQuestions.toLocaleString("de-DE")} Fragen generiert`}
          color="text-purple-400"
          href="/planung/questions"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-3 lg:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Seed-Keywords</p>
          <p className="text-2xl font-bold text-cyan-400 mt-1">{totalSeedKeywords.toLocaleString("de-DE")}</p>
          <p className="text-xs text-slate-500 mt-0.5">{data.seedStats.length} Kategorien</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cached Intents</p>
          <p className="text-2xl font-bold text-violet-400 mt-1">{data.gscStats.totalIntents.toLocaleString("de-DE")}</p>
          <p className="text-xs text-slate-500 mt-0.5">Search Intent Datenpunkte</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Trend-Daten</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{data.gscStats.totalTrends.toLocaleString("de-DE")}</p>
          <p className="text-xs text-slate-500 mt-0.5">Google Trends gecacht</p>
        </div>
      </div>

      {/* Charts Row 1: Intent & Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Intent Distribution */}
        <ChartCard title="Search Intent Verteilung (GSC)">
          {intentPieData.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={intentPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {intentPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                    itemStyle={{ color: "#e2e8f0" }}
                    formatter={(value: number) => value.toLocaleString("de-DE")}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mt-2">
                {intentPieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.fill }} />
                    <span className="text-slate-400">{d.name}</span>
                    <span className="text-slate-200 font-medium">{d.value.toLocaleString("de-DE")}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">Noch keine Intent-Daten vorhanden</p>
          )}
        </ChartCard>

        {/* Trend Distribution */}
        <ChartCard title="Trend-Richtungen (Google Trends)">
          {trendPieData.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={trendPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {trendPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                    itemStyle={{ color: "#e2e8f0" }}
                    formatter={(value: number) => value.toLocaleString("de-DE")}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-6 text-xs mt-2">
                {trendPieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.fill }} />
                    <span className="text-slate-400">{d.name}</span>
                    <span className="text-slate-200 font-medium">{d.value.toLocaleString("de-DE")}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">Noch keine Trend-Daten vorhanden</p>
          )}
        </ChartCard>

        {/* Keyword Difficulty */}
        <ChartCard title="Keyword Difficulty Verteilung">
          {difficultyBarData.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={difficultyBarData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  itemStyle={{ color: "#e2e8f0" }}
                  formatter={(value: number) => value.toLocaleString("de-DE")}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {difficultyBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">Noch keine Keyword-Daten vorhanden</p>
          )}
        </ChartCard>
      </div>

      {/* Charts Row 2: Keyword Intent + Category Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Keyword Research Intent */}
        <ChartCard title="Intent-Verteilung (Keyword Research)">
          {kwIntentData.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={kwIntentData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {kwIntentData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                    itemStyle={{ color: "#e2e8f0" }}
                    formatter={(value: number) => value.toLocaleString("de-DE")}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mt-2">
                {kwIntentData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.fill }} />
                    <span className="text-slate-400">{d.name}</span>
                    <span className="text-slate-200 font-medium">{d.value.toLocaleString("de-DE")}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">Noch keine Intent-Daten aus Keyword-Recherchen</p>
          )}
        </ChartCard>

        {/* Category Comparison */}
        <ChartCard title="Datenlage nach Kategorie">
          {categoryBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={categoryBarData} margin={{ left: 10, right: 10, bottom: 40 }}>
                <XAxis
                  dataKey="category"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                  itemStyle={{ color: "#e2e8f0" }}
                  formatter={(value: number) => value.toLocaleString("de-DE")}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                <Bar dataKey="topics" name="Topics" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="keywords" name="Keywords" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="questions" name="Fragen" fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">Noch keine Kategorie-Daten vorhanden</p>
          )}
        </ChartCard>
      </div>

      {/* Seed Keywords per Category */}
      {data.seedStats.length > 0 && (
        <ChartCard title="Seed-Keywords nach Kategorie">
          <ResponsiveContainer width="100%" height={Math.max(200, data.seedStats.length * 36)}>
            <BarChart
              data={data.seedStats.sort((a, b) => b.count - a.count)}
              layout="vertical"
              margin={{ left: 20, right: 20 }}
            >
              <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="category"
                width={160}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px" }}
                itemStyle={{ color: "#e2e8f0" }}
                formatter={(value: number) => value.toLocaleString("de-DE")}
              />
              <Bar dataKey="count" name="Seed-Keywords" radius={[0, 6, 6, 0]}>
                {data.seedStats
                  .sort((a, b) => b.count - a.count)
                  .map((_, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            title: "GSC based",
            description: "Keywords aus der Search Console mit Trends, Intent & Volumen",
            href: "/planung/marketing",
            color: "border-blue-500/30 hover:border-blue-500/60",
            iconColor: "text-blue-400",
          },
          {
            title: "Topic based",
            description: "Topic-Graphen mit Unterthemen via TopicLoops",
            href: "/planung/topics",
            color: "border-emerald-500/30 hover:border-emerald-500/60",
            iconColor: "text-emerald-400",
          },
          {
            title: "Keyword based",
            description: "Keyword-Vorschläge mit Suchvolumen, Difficulty & CPC",
            href: "/planung/keywords",
            color: "border-amber-500/30 hover:border-amber-500/60",
            iconColor: "text-amber-400",
          },
          {
            title: "Question based",
            description: "KI-generierte Fragen zu Keywords",
            href: "/planung/questions",
            color: "border-purple-500/30 hover:border-purple-500/60",
            iconColor: "text-purple-400",
          },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`bg-slate-800/50 border rounded-xl p-4 transition-colors ${link.color}`}
          >
            <h3 className={`text-sm font-semibold ${link.iconColor}`}>{link.title}</h3>
            <p className="text-xs text-slate-500 mt-1">{link.description}</p>
            <span className="inline-flex items-center gap-1 text-xs text-slate-400 mt-3">
              Öffnen
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
