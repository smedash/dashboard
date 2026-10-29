"use client";

import { useCallback, useEffect, useState } from "react";
import { ADOBE_FILES, TIME_SPENT_FILES } from "@/lib/url-cleanup/adobe-files";
import { DimensionImport } from "@/components/url-cleanup/DimensionImport";
import { RecomputeProgressBar } from "@/components/url-cleanup/RecomputeProgressBar";
import { runChunkedRecompute, type RecomputeProgress } from "@/components/url-cleanup/run-recompute";
import { RankedKeywordsSyncPanel } from "@/components/url-cleanup/RankedKeywordsSyncPanel";
import { KEYWORD_MAPPING_GSC_SITE_URL } from "@/lib/keyword-mapping-gsc";
import { useMessages } from "@/i18n/I18nProvider";
import { urlCleanupMessages } from "@/i18n/messages/url-cleanup";

type SeedStatus = {
  inventoryCount: number;
  sitemapCount: number;
  adobeFiles: Array<{ file: string; exists: boolean; slug: string; name: string }>;
  timeSpentFiles: Array<{ file: string; exists: boolean; slug: string; name: string }>;
  gatingFile: { file: string; exists: boolean; slug: string; name: string; resolvedFile?: string };
  dimensions: Array<{ slug: string; name: string; matchedCount: number; unmatchedCount: number; sourceType: string }>;
};

export default function DimensionenPage() {
  const t = useMessages(urlCleanupMessages);
  const [status, setStatus] = useState<SeedStatus | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [gscPeriod, setGscPeriod] = useState("28d");
  const [scoreProgress, setScoreProgress] = useState<RecomputeProgress | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/url-cleanup/seed")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!scoreProgress) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [scoreProgress]);

  function push(msg: string) {
    setLog((p) => [...p, msg]);
  }

  async function recomputeScores() {
    push(t.dimensions.log.recomputeScores);
    const updated = await runChunkedRecompute(setScoreProgress);
    setScoreProgress(null);
    push(`Scores: ${updated.toLocaleString(t.displayLocale)} URLs`);
    return updated;
  }

  async function postSeed(body: object) {
    const res = await fetch("/api/url-cleanup/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t.error);
    return data;
  }

  async function runFullSeed() {
    setBusy(true);
    setLog([]);
    try {
      push("Sitemaps…");
      const sm = await postSeed({ step: "sitemaps" });
      push(`Sitemaps: ${sm.result.count}`);
      push("URLs…");
      const urls = await postSeed({ step: "urls" });
      push(`URLs unique: ${urls.result.unique.toLocaleString(t.displayLocale)}`);
      for (const f of ADOBE_FILES) {
        push(`Adobe ${f.file}…`);
        const r = await postSeed({ step: "adobe", file: f.file });
        push(`  matched ${r.result.matched.toLocaleString(t.displayLocale)}, unmatched ${r.result.unmatched.toLocaleString(t.displayLocale)}`);
      }
      push(t.dimensions.log.denormAdobe);
      await postSeed({ step: "denorm" });
      for (const f of TIME_SPENT_FILES) {
        push(`Time spent ${f.file}…`);
        const r = await postSeed({ step: "timespent", file: f.file });
        push(`  matched ${r.result.matched.toLocaleString(t.displayLocale)}, unmatched ${r.result.unmatched.toLocaleString(t.displayLocale)}`);
      }
      push(t.dimensions.log.denormTimeSpent);
      await postSeed({ step: "denorm-timespent" });
      push("Gating…");
      const gating = await postSeed({ step: "gating" });
      push(`  matched ${gating.result.matched.toLocaleString(t.displayLocale)}, unmatched ${gating.result.unmatched.toLocaleString(t.displayLocale)}`);
      push(t.dimensions.log.denormGating);
      await postSeed({ step: "denorm-gating" });
      push("Keywords…");
      await postSeed({ step: "keywords" });
      await recomputeScores();
      push(t.dimensions.log.done);
      refresh();
    } catch (e) {
      push(e instanceof Error && e.message ? e.message : t.error);
    } finally {
      setScoreProgress(null);
      setBusy(false);
    }
  }

  async function runTimeSpent() {
    setBusy(true);
    setLog([]);
    try {
      for (const f of TIME_SPENT_FILES) {
        push(`Time spent ${f.file}…`);
        const r = await postSeed({ step: "timespent", file: f.file });
        push(`  matched ${r.result.matched.toLocaleString(t.displayLocale)}, unmatched ${r.result.unmatched.toLocaleString(t.displayLocale)}`);
      }
      push(t.dimensions.log.denormTimeSpent);
      await postSeed({ step: "denorm-timespent" });
      await recomputeScores();
      push(t.dimensions.log.timeSpentDone);
      refresh();
    } catch (e) {
      push(e instanceof Error && e.message ? e.message : t.error);
    } finally {
      setScoreProgress(null);
      setBusy(false);
    }
  }

  async function runGating() {
    setBusy(true);
    setLog([]);
    try {
      push("Gating…");
      const gating = await postSeed({ step: "gating" });
      push(`  matched ${gating.result.matched.toLocaleString(t.displayLocale)}, unmatched ${gating.result.unmatched.toLocaleString(t.displayLocale)}`);
      push(t.dimensions.log.denormGating);
      await postSeed({ step: "denorm-gating" });
      await recomputeScores();
      push(t.dimensions.log.gatingDone);
      refresh();
    } catch (e) {
      push(e instanceof Error && e.message ? e.message : t.error);
    } finally {
      setScoreProgress(null);
      setBusy(false);
    }
  }

  async function runGscSync() {
    setBusy(true);
    setLog([]);
    try {
      push("GSC Reset…");
      let res = await fetch("/api/url-cleanup/gsc-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "reset", period: gscPeriod, siteUrl: KEYWORD_MAPPING_GSC_SITE_URL }),
      });
      let data = await res.json();
      if (!res.ok) throw new Error(data.error || t.dimensions.log.resetFailed);
      let startRow = 0;
      for (let i = 0; i < 4; i++) {
        push(`GSC Pages startRow=${startRow}…`);
        res = await fetch("/api/url-cleanup/gsc-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phase: "page",
            period: gscPeriod,
            siteUrl: KEYWORD_MAPPING_GSC_SITE_URL,
            startRow,
          }),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || t.dimensions.log.pagesFailed);
        push(t.dimensions.log.rowsMatches(data.result.rows, data.result.matched));
        if (!data.result.hasMore) break;
        startRow = data.result.nextStartRow;
      }
      const prefRes = await fetch("/api/url-cleanup/gsc-sync");
      const prefData = await prefRes.json();
      for (const prefix of prefData.prefixes ?? []) {
        push(`GSC Prefix ${prefix}…`);
        res = await fetch("/api/url-cleanup/gsc-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phase: "prefix",
            period: gscPeriod,
            siteUrl: KEYWORD_MAPPING_GSC_SITE_URL,
            prefix,
          }),
        });
        data = await res.json();
        if (!res.ok) {
          push(t.dimensions.log.prefixError(data.error));
          continue;
        }
        push(t.dimensions.log.matches(data.result.matched));
      }
      await recomputeScores();
      push(t.dimensions.log.gscSyncDone);
      refresh();
    } catch (e) {
      push(e instanceof Error && e.message ? e.message : t.error);
    } finally {
      setScoreProgress(null);
      setBusy(false);
    }
  }

  async function runKeywords() {
    setBusy(true);
    try {
      const res = await fetch("/api/url-cleanup/keyword-sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      push(t.dimensions.log.keywords(data.focus.matched, data.labs.matched));
      await recomputeScores();
      refresh();
    } catch (e) {
      push(e instanceof Error && e.message ? e.message : t.error);
    } finally {
      setScoreProgress(null);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
        <h2 className="font-semibold">{t.dimensions.seed.title}</h2>
        <p className="text-sm text-slate-500">
          {t.dimensions.seed.summary(
            status?.inventoryCount.toLocaleString(t.displayLocale) ?? "—",
            status?.sitemapCount != null ? String(status.sitemapCount) : "—"
          )}
        </p>
        <p className="text-sm text-slate-500">
          {t.dimensions.seed.description}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={runFullSeed}
          className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
        >
          {busy ? t.dimensions.seed.running : t.dimensions.seed.button}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
        <h2 className="font-semibold">{t.dimensions.timeSpent.title}</h2>
        <p className="text-sm text-slate-500">
          {t.dimensions.timeSpent.description}
        </p>
        <ul className="text-xs text-slate-500 space-y-0.5">
          {(status?.timeSpentFiles ?? TIME_SPENT_FILES.map((f) => ({ ...f, exists: true }))).map((f) => (
            <li key={f.file}>
              {f.exists === false ? t.dimensions.timeSpent.missing : ""}
              {f.name}
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={busy}
          onClick={runTimeSpent}
          className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
        >
          {t.dimensions.timeSpent.button}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
        <h2 className="font-semibold">{t.dimensions.gating.title}</h2>
        <p className="text-sm text-slate-500">
          {t.dimensions.gating.description}
        </p>
        <p className="text-xs text-slate-500">
          {status?.gatingFile
            ? status.gatingFile.exists
              ? status.gatingFile.resolvedFile || status.gatingFile.file
              : t.dimensions.gating.fileMissing
            : "—"}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={runGating}
          className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
        >
          {t.dimensions.gating.button}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
        <h2 className="font-semibold">{t.dimensions.gscSync.title}</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={gscPeriod}
            onChange={(e) => setGscPeriod(e.target.value)}
            className="px-2 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
          >
            {["7d", "28d", "3m", "6m", "8m", "12m"].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={runGscSync}
            className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
          >
            {t.dimensions.gscSync.button}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
        <h2 className="font-semibold">{t.dimensions.keywordOverlay.title}</h2>
        <button
          type="button"
          disabled={busy}
          onClick={runKeywords}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50"
        >
          {t.dimensions.keywordOverlay.button}
        </button>
      </div>

      <RankedKeywordsSyncPanel />

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
        <h2 className="font-semibold">{t.dimensions.excelImport}</h2>
        <DimensionImport onImported={refresh} />
      </div>

      {status?.dimensions && status.dimensions.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">{t.dimensions.columns.dimension}</th>
                <th className="px-4 py-2 text-left">{t.dimensions.columns.type}</th>
                <th className="px-4 py-2 text-right">{t.dimensions.columns.matched}</th>
                <th className="px-4 py-2 text-right">{t.dimensions.columns.unmatched}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {status.dimensions.map((d) => (
                <tr key={d.slug}>
                  <td className="px-4 py-2">{d.name}</td>
                  <td className="px-4 py-2">{d.sourceType}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{d.matchedCount.toLocaleString(t.displayLocale)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{d.unmatchedCount.toLocaleString(t.displayLocale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {scoreProgress && <RecomputeProgressBar progress={scoreProgress} />}

      {log.length > 0 && (
        <pre className="text-xs bg-slate-900 text-slate-100 rounded-xl p-4 overflow-auto max-h-80">
          {log.join("\n")}
        </pre>
      )}
    </div>
  );
}
