"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMessages } from "@/i18n/I18nProvider";
import { urlCleanupMessages } from "@/i18n/messages/url-cleanup";

type Stats = {
  total: number;
  inGsc: number;
  inAdobe: number;
  withFocus: number;
  labsCached: number;
  highKill: number;
  keepBand: number;
  protectedBand?: number;
  gscMatchRate: number;
  adobeMatchRate: number;
  lastGsc: { gscSyncedAt: string; gscPeriod: string | null } | null;
  sitemaps: number;
  dimensions: Array<{
    slug: string;
    name: string;
    sourceType: string;
    matchedCount: number;
    unmatchedCount: number;
  }>;
};

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export default function UrlCleanupOverviewPage() {
  const t = useMessages(urlCleanupMessages);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/url-cleanup/stats")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "");
        setStats(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : ""));
  }, []);

  if (error !== null) {
    return <p className="text-sm text-red-600">{error || t.error}</p>;
  }
  if (!stats) {
    return <p className="text-sm text-slate-500">{t.overview.loading}</p>;
  }

  if (stats.total === 0) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-6">
        <p className="text-sm text-amber-900 dark:text-amber-200">
          {t.overview.emptyBefore}
          <Link href="/url-cleanup/dimensionen" className="underline font-medium">
            {t.overview.emptyLink}
          </Link>
          {t.overview.emptyAfter}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label={t.overview.inventory} value={stats.total.toLocaleString(t.displayLocale)} hint={t.overview.sitemaps(stats.sitemaps)} />
        <Card
          label={t.overview.inGsc}
          value={stats.inGsc.toLocaleString(t.displayLocale)}
          hint={t.overview.matchRate((stats.gscMatchRate * 100).toFixed(1))}
        />
        <Card
          label={t.overview.inAdobe}
          value={stats.inAdobe.toLocaleString(t.displayLocale)}
          hint={t.overview.matchRate((stats.adobeMatchRate * 100).toFixed(1))}
        />
        <Card
          label={t.overview.killHigh}
          value={stats.highKill.toLocaleString(t.displayLocale)}
          hint={t.overview.keepHint(
            stats.keepBand.toLocaleString(t.displayLocale),
            (stats.protectedBand ?? 0).toLocaleString(t.displayLocale)
          )}
        />
        <Card label={t.overview.focusKeywords} value={stats.withFocus.toLocaleString(t.displayLocale)} />
        <Card
          label={t.overview.rankedKeywords}
          value={stats.labsCached.toLocaleString(t.displayLocale)}
          hint={t.overview.urlsWithRankings}
        />
        <Card
          label={t.overview.lastGscSync}
          value={stats.lastGsc?.gscPeriod ?? "—"}
          hint={
            stats.lastGsc?.gscSyncedAt
              ? new Date(stats.lastGsc.gscSyncedAt).toLocaleString(t.displayLocale)
              : t.overview.notYet
          }
        />
        <Card label={t.overview.dimensions} value={String(stats.dimensions.length)} />
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <div className="px-4 py-3 text-sm font-medium border-b border-slate-200 dark:border-slate-700">
          {t.overview.dimensions}
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">{t.overview.columns.name}</th>
              <th className="px-4 py-2 text-left">{t.overview.columns.type}</th>
              <th className="px-4 py-2 text-right">{t.overview.columns.matched}</th>
              <th className="px-4 py-2 text-right">{t.overview.columns.unmatched}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {stats.dimensions.map((d) => (
              <tr key={d.slug}>
                <td className="px-4 py-2">{d.name}</td>
                <td className="px-4 py-2 text-slate-500">{d.sourceType}</td>
                <td className="px-4 py-2 text-right tabular-nums">{d.matchedCount.toLocaleString(t.displayLocale)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{d.unmatchedCount.toLocaleString(t.displayLocale)}</td>
              </tr>
            ))}
            {stats.dimensions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  {t.overview.noDimensions}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
