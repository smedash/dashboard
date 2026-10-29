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
import { useLocale, useMessages } from "@/i18n/I18nProvider";
import { commonMessages } from "@/i18n/messages/common";
import { planningOverviewMessages } from "@/i18n/messages/planning-overview";

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
  const { intlLocale } = useLocale();
  const card = (
    <div className={`bg-slate-800/50 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-colors ${href ? "cursor-pointer" : ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>
            {typeof value === "number" ? value.toLocaleString(intlLocale) : value}
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
  const t = useMessages(planningOverviewMessages);
  const nav = useMessages(commonMessages).nav;
  const { intlLocale } = useLocale();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<
    { kind: "loadFailed" | "unknown" } | { kind: "message"; message: string } | null
  >(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/planung/overview");
        if (!res.ok) {
          setError({ kind: "loadFailed" });
          return;
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? { kind: "message", message: err.message } : { kind: "unknown" });
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
          <p className="text-sm text-slate-400">{t.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-300">{error ? (error.kind === "message" ? error.message : t.errors[error.kind]) : t.noData}</p>
      </div>
    );
  }

  const intentPieData = data.gscStats.intentDistribution.map((d) => ({
    name: INTENT_LABELS[d.label] || d.label,
    value: d.count,
    fill: INTENT_COLORS[d.label] || "#64748b",
  }));

  const trendPieData = data.gscStats.trendDistribution.map((d) => ({
    name: t.trendLabels[d.direction] || d.direction,
    value: d.count,
    fill: TREND_COLORS[d.direction] || "#64748b",
  }));

  const difficultyBarData = [
    { name: t.difficulty.easy, value: data.keywordStats.difficultyDistribution.easy, fill: DIFFICULTY_COLORS[0] },
    { name: t.difficulty.medium, value: data.keywordStats.difficultyDistribution.medium, fill: DIFFICULTY_COLORS[1] },
    { name: t.difficulty.hard, value: data.keywordStats.difficultyDistribution.hard, fill: DIFFICULTY_COLORS[2] },
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
        <h1 className="text-2xl font-bold text-white">{t.title}</h1>
        <p className="text-sm text-slate-400 mt-1">
          {t.subtitle}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={t.kpi.gscKeywords}
          value={data.gscStats.gscKeywordCount}
          subtitle={t.kpi.gscSubtitle(data.gscStats.totalIntents.toLocaleString(intlLocale), data.gscStats.totalTrends.toLocaleString(intlLocale), data.gscStats.totalVolumes.toLocaleString(intlLocale))}
          color="text-blue-400"
          href="/planung/marketing"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <KpiCard
          title={t.kpi.topicGraphs}
          value={data.topicStats.succeeded}
          subtitle={t.kpi.topicSubtitle(data.topicStats.totalTopics.toLocaleString(intlLocale))}
          color="text-emerald-400"
          href="/planung/topics"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          }
        />
        <KpiCard
          title={t.kpi.keywordResearches}
          value={data.keywordStats.totalResearched}
          subtitle={t.kpi.keywordSubtitle(data.keywordStats.totalSuggestions.toLocaleString(intlLocale), data.keywordStats.avgSearchVolume.toLocaleString(intlLocale))}
          color="text-amber-400"
          href="/planung/keywords"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          }
        />
        <KpiCard
          title={t.kpi.questionSets}
          value={data.questionStats.total}
          subtitle={t.kpi.questionSubtitle(data.questionStats.totalQuestions.toLocaleString(intlLocale))}
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
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t.kpi.seedKeywords}</p>
          <p className="text-2xl font-bold text-cyan-400 mt-1">{totalSeedKeywords.toLocaleString(intlLocale)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{t.kpi.categories(data.seedStats.length)}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t.kpi.cachedIntents}</p>
          <p className="text-2xl font-bold text-violet-400 mt-1">{data.gscStats.totalIntents.toLocaleString(intlLocale)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{t.kpi.intentDataPoints}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t.kpi.trendData}</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{data.gscStats.totalTrends.toLocaleString(intlLocale)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{t.kpi.trendsCached}</p>
        </div>
      </div>

      {/* Charts Row 1: Intent & Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Intent Distribution */}
        <ChartCard title={t.charts.intentGsc}>
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
                    formatter={(value: number) => value.toLocaleString(intlLocale)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mt-2">
                {intentPieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.fill }} />
                    <span className="text-slate-400">{d.name}</span>
                    <span className="text-slate-200 font-medium">{d.value.toLocaleString(intlLocale)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">{t.charts.noIntentData}</p>
          )}
        </ChartCard>

        {/* Trend Distribution */}
        <ChartCard title={t.charts.trendDirections}>
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
                    formatter={(value: number) => value.toLocaleString(intlLocale)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-6 text-xs mt-2">
                {trendPieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.fill }} />
                    <span className="text-slate-400">{d.name}</span>
                    <span className="text-slate-200 font-medium">{d.value.toLocaleString(intlLocale)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">{t.charts.noTrendData}</p>
          )}
        </ChartCard>

        {/* Keyword Difficulty */}
        <ChartCard title={t.charts.difficulty}>
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
                  formatter={(value: number) => value.toLocaleString(intlLocale)}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {difficultyBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">{t.charts.noKeywordData}</p>
          )}
        </ChartCard>
      </div>

      {/* Charts Row 2: Keyword Intent + Category Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Keyword Research Intent */}
        <ChartCard title={t.charts.intentKeywordResearch}>
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
                    formatter={(value: number) => value.toLocaleString(intlLocale)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mt-2">
                {kwIntentData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.fill }} />
                    <span className="text-slate-400">{d.name}</span>
                    <span className="text-slate-200 font-medium">{d.value.toLocaleString(intlLocale)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">{t.charts.noKeywordIntentData}</p>
          )}
        </ChartCard>

        {/* Category Comparison */}
        <ChartCard title={t.charts.dataByCategory}>
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
                  formatter={(value: number) => value.toLocaleString(intlLocale)}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
                <Bar dataKey="topics" name={t.charts.topics} fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="keywords" name={t.charts.keywords} fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="questions" name={t.charts.questions} fill="#a855f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">{t.charts.noCategoryData}</p>
          )}
        </ChartCard>
      </div>

      {/* Seed Keywords per Category */}
      {data.seedStats.length > 0 && (
        <ChartCard title={t.charts.seedKeywordsByCategory}>
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
                formatter={(value: number) => value.toLocaleString(intlLocale)}
              />
              <Bar dataKey="count" name={t.charts.seedKeywords} radius={[0, 6, 6, 0]}>
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
            title: nav.gscBased,
            description: t.links.gscDescription,
            href: "/planung/marketing",
            color: "border-blue-500/30 hover:border-blue-500/60",
            iconColor: "text-blue-400",
          },
          {
            title: nav.topicBased,
            description: t.links.topicDescription,
            href: "/planung/topics",
            color: "border-emerald-500/30 hover:border-emerald-500/60",
            iconColor: "text-emerald-400",
          },
          {
            title: nav.keywordBased,
            description: t.links.keywordDescription,
            href: "/planung/keywords",
            color: "border-amber-500/30 hover:border-amber-500/60",
            iconColor: "text-amber-400",
          },
          {
            title: nav.questionBased,
            description: t.links.questionDescription,
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
              {t.links.open}
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
