"use client";

import { PieChart } from "@/components/charts/PieChart";
import {
  CLEANUP_STATUSES,
  CLEANUP_STATUS_COLORS,
  CLEANUP_STATUS_LABELS,
  type CleanupStatusCounts,
} from "@/lib/url-cleanup/cleanup-status";
import { useMessages } from "@/i18n/I18nProvider";
import { urlCleanupMessages } from "@/i18n/messages/url-cleanup";

export function StatusDistributionChart({
  counts,
  total,
  loading,
}: {
  counts: CleanupStatusCounts | null;
  total: number;
  loading?: boolean;
}) {
  const t = useMessages(urlCleanupMessages);
  const data = CLEANUP_STATUSES.map((status) => ({
    name: CLEANUP_STATUS_LABELS[status],
    value: counts?.[status] ?? 0,
    fill: CLEANUP_STATUS_COLORS[status],
  })).filter((d) => d.value > 0);
  const sum = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 h-full">
      <h2 className="font-semibold">{t.statusChart.title}</h2>
      <p className="mt-1 text-sm text-slate-500">
        {t.statusChart.urlsInFilter(total.toLocaleString(t.displayLocale))}
      </p>
      {loading && data.length === 0 ? (
        <div className="mt-8 text-sm text-slate-400">{t.loading}</div>
      ) : data.length > 0 ? (
        <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="min-w-0 flex-1">
            <PieChart data={data} height={200} showLegend={false} />
          </div>
          <ul className="shrink-0 space-y-1.5 text-sm">
            {data.map((d) => (
              <li key={d.name} className="flex items-center gap-2 tabular-nums">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                <span className="text-slate-700 dark:text-slate-200">
                  {d.name}: {d.value.toLocaleString(t.displayLocale)}
                  {sum > 0 ? ` (${((d.value / sum) * 100).toFixed(1)}%)` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-8 text-sm text-slate-400">{t.statusChart.noData}</div>
      )}
    </div>
  );
}
