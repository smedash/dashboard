"use client";

import { StatCard } from "@/components/ui/StatCard";
import { PieChart } from "@/components/charts/PieChart";
import { BarChart } from "@/components/charts/BarChart";
import { useLocale } from "@/i18n/I18nProvider";
import { HEALTH_MEDIUM, type TechnicalSeoOverview, type UrlFilter } from "@/lib/technical-seo";
import { IssueTypeBadge, Panel, formatIssueName, type TechnicalSeoTexts } from "./shared";

const MAX_DEPTH_BUCKET = 6;

const TYPE_COLORS = {
  page: "#10b981",
  redirect: "#f59e0b",
  missing: "#ef4444",
  server_error: "#8b5cf6",
  timeout: "#64748b",
};

/** The shared PieChart legend overlaps the donut in medium-width cards, so the legend sits below. */
function PieWithLegend({ data }: { data: { name: string; value: number; color: string }[] }) {
  const { intlLocale } = useLocale();
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <div>
      <PieChart data={data} height={200} showLegend={false} />
      <ul className="mt-3 space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
            <span className="flex-1 min-w-0 truncate text-slate-700 dark:text-slate-300">{d.name}</span>
            <span className="tabular-nums font-medium text-slate-900 dark:text-white">
              {d.value.toLocaleString(intlLocale)}
            </span>
            <span className="w-14 text-right tabular-nums text-slate-500 dark:text-slate-400">
              {(total > 0 ? d.value / total : 0).toLocaleString(intlLocale, {
                style: "percent",
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OverviewTab({
  overview,
  t,
  onOpenUrls,
  onOpenIssues,
}: {
  overview: TechnicalSeoOverview;
  t: TechnicalSeoTexts;
  onOpenUrls: (filter: UrlFilter) => void;
  onOpenIssues: () => void;
}) {
  const { intlLocale } = useLocale();
  const o = t.overview;
  const { totals, health, indexability, issues } = overview;

  const indexablePct =
    totals.pages > 0 ? ((indexability.indexable / totals.pages) * 100).toFixed(1) : "0";
  const openIssueCount = issues.critical + issues.fix + issues.opportunity;

  const typeData = (
    [
      ["page", totals.pages],
      ["redirect", totals.redirects],
      ["missing", totals.missing],
      ["server_error", totals.serverErrors],
      ["timeout", totals.timeouts],
    ] as const
  )
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({ name: t.urlTypes[key], value, color: TYPE_COLORS[key] }));

  const healthData = [
    { name: t.healthBuckets.good, value: health.good, color: "#10b981" },
    { name: t.healthBuckets.medium, value: health.medium, color: "#f59e0b" },
    { name: t.healthBuckets.poor, value: health.poor, color: "#ef4444" },
  ].filter((d) => d.value > 0);

  const depthData: { label: string; count: number }[] = [];
  for (const { depth, count } of overview.depth) {
    if (depth < MAX_DEPTH_BUCKET) {
      depthData.push({ label: o.depthLabel(String(depth)), count });
    } else {
      const label = o.depthLabel(`${MAX_DEPTH_BUCKET}+`);
      const bucket = depthData.find((d) => d.label === label);
      if (bucket) bucket.count += count;
      else depthData.push({ label, count });
    }
  }

  const problems: { filter: UrlFilter; label: string; count: number }[] = [
    { filter: "notIndexable", label: t.problems.notIndexable, count: indexability.notIndexable },
    { filter: "notInSitemap", label: t.problems.notInSitemap, count: indexability.notInSitemap },
    { filter: "orphans", label: t.problems.orphans, count: indexability.orphans },
    { filter: "disallowed", label: t.problems.disallowed, count: indexability.disallowed },
    { filter: "lowHealth", label: t.problems.lowHealth(HEALTH_MEDIUM), count: health.poor },
    { filter: "missing", label: t.problems.missing, count: totals.missing },
    { filter: "errors", label: t.problems.errors, count: totals.serverErrors + totals.timeouts },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title={o.urls}
          value={totals.urls}
          subtitle={o.urlsSubtitle(totals.pages)}
        />
        <StatCard
          title={o.avgHealth}
          value={health.average ?? "–"}
          subtitle={o.avgHealthSubtitle}
        />
        <StatCard
          title={o.indexable}
          value={indexability.indexable}
          subtitle={o.indexableSubtitle(indexablePct)}
        />
        <StatCard
          title={o.openIssues}
          value={openIssueCount}
          subtitle={o.openIssuesSubtitle(issues.pointsToGain)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title={o.urlTypes}>
          <PieWithLegend data={typeData} />
        </Panel>
        <Panel title={o.healthDistribution}>
          <PieWithLegend data={healthData} />
        </Panel>
        <Panel title={o.urlDepth}>
          <BarChart data={depthData} xKey="label" yKey="count" color="#3b82f6" height={260} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title={o.problems}>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{o.problemsHint}</p>
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {problems.map((p) => (
              <li key={p.filter}>
                <button
                  type="button"
                  onClick={() => onOpenUrls(p.filter)}
                  disabled={p.count === 0}
                  className="w-full flex items-center justify-between gap-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 disabled:hover:text-slate-700 dark:disabled:hover:text-slate-300 disabled:cursor-default transition-colors"
                >
                  <span>{p.label}</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      p.count > 0 ? "text-slate-900 dark:text-white" : "text-slate-400"
                    }`}
                  >
                    {p.count.toLocaleString(intlLocale)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {overview.avgDownloadMs !== null && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">{o.avgDownload}</span>
              <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                {overview.avgDownloadMs.toLocaleString(intlLocale)} ms
              </span>
            </div>
          )}
        </Panel>

        <Panel
          title={o.topIssues}
          action={
            <button
              type="button"
              onClick={onOpenIssues}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {o.allIssues}
            </button>
          }
        >
          {overview.topIssues.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{o.noOpenIssues}</p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {overview.topIssues.map((issue) => {
                const { group, label } = formatIssueName(issue.name, t);
                return (
                  <li key={issue.id} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate" title={issue.name}>
                        {group}: {label}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <IssueTypeBadge type={issue.type} t={t} />
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {issue.pagesOpen > 0 ? o.pagesAffected(issue.pagesOpen) : t.issues.websiteWide}
                        </span>
                      </div>
                    </div>
                    {issue.pointsToGain > 0 && (
                      <span className="shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {o.pointsToGain(issue.pointsToGain)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
