"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Stats = {
  total: number;
  inGsc: number;
  inAdobe: number;
  withFocus: number;
  labsCached: number;
  highKill: number;
  keepBand: number;
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
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/url-cleanup/stats")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Fehler");
        setStats(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Fehler"));
  }, []);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!stats) {
    return <p className="text-sm text-slate-500">Lade Übersicht…</p>;
  }

  if (stats.total === 0) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-6">
        <p className="text-sm text-amber-900 dark:text-amber-200">
          Noch kein Inventar. Bitte unter{" "}
          <Link href="/url-cleanup/dimensionen" className="underline font-medium">
            Dimensionen
          </Link>{" "}
          den Seed-Import starten.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Inventar" value={stats.total.toLocaleString("de-CH")} hint={`${stats.sitemaps} Sitemaps`} />
        <Card
          label="In GSC"
          value={stats.inGsc.toLocaleString("de-CH")}
          hint={`${(stats.gscMatchRate * 100).toFixed(1)}% Match`}
        />
        <Card
          label="In Adobe"
          value={stats.inAdobe.toLocaleString("de-CH")}
          hint={`${(stats.adobeMatchRate * 100).toFixed(1)}% Match`}
        />
        <Card
          label="Kill high"
          value={stats.highKill.toLocaleString("de-CH")}
          hint={`${stats.keepBand.toLocaleString("de-CH")} Keep-Vetos`}
        />
        <Card label="Fokuskeywords" value={stats.withFocus.toLocaleString("de-CH")} />
        <Card
          label="ranked Keywords"
          value={stats.labsCached.toLocaleString("de-CH")}
          hint="URLs mit Rankings"
        />
        <Card
          label="Letzter GSC-Sync"
          value={stats.lastGsc?.gscPeriod ?? "—"}
          hint={
            stats.lastGsc?.gscSyncedAt
              ? new Date(stats.lastGsc.gscSyncedAt).toLocaleString("de-CH")
              : "noch nicht"
          }
        />
        <Card label="Dimensionen" value={String(stats.dimensions.length)} />
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        <div className="px-4 py-3 text-sm font-medium border-b border-slate-200 dark:border-slate-700">
          Dimensionen
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Typ</th>
              <th className="px-4 py-2 text-right">Matched</th>
              <th className="px-4 py-2 text-right">Unmatched</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {stats.dimensions.map((d) => (
              <tr key={d.slug}>
                <td className="px-4 py-2">{d.name}</td>
                <td className="px-4 py-2 text-slate-500">{d.sourceType}</td>
                <td className="px-4 py-2 text-right tabular-nums">{d.matchedCount.toLocaleString("de-CH")}</td>
                <td className="px-4 py-2 text-right tabular-nums">{d.unmatchedCount.toLocaleString("de-CH")}</td>
              </tr>
            ))}
            {stats.dimensions.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Noch keine Dimensionen importiert.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
