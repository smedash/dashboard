"use client";

import { useEffect, useState } from "react";
import { RecomputeProgressBar } from "./RecomputeProgressBar";
import { runChunkedRecompute, type RecomputeProgress } from "./run-recompute";
import { runChunkedRankedKeywordsSync } from "./run-ranked-keywords";
import { useMessages } from "@/i18n/I18nProvider";
import { urlCleanupMessages } from "@/i18n/messages/url-cleanup";

type Status = {
  inventoryCount: number;
  cacheCount: number;
  withRankings: number;
  missing: number;
};

export function RankedKeywordsSyncPanel({ onDone }: { onDone?: () => void }) {
  const t = useMessages(urlCleanupMessages);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<RecomputeProgress | null>(null);
  const [phase, setPhase] = useState<"fetch" | "scores" | null>(null);

  function loadStatus() {
    fetch("/api/url-cleanup/ranked-keywords-sync")
      .then((r) => r.json())
      .then((d) => {
        if (d.inventoryCount != null) setStatus(d);
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (!busy) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [busy]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3 h-full">
      <h2 className="font-semibold">{t.rankedKeywords.title}</h2>
      <p className="text-sm text-slate-500">
        {t.rankedKeywords.description}
      </p>
      {status && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t.rankedKeywords.status(
            status.inventoryCount.toLocaleString(t.displayLocale),
            (status.inventoryCount - status.missing).toLocaleString(t.displayLocale),
            status.missing.toLocaleString(t.displayLocale),
            status.withRankings.toLocaleString(t.displayLocale)
          )}
        </p>
      )}
      <button
        type="button"
        disabled={busy || (status?.missing ?? 0) === 0}
        onClick={async () => {
          const missing = status?.missing ?? 0;
          const ok = window.confirm(t.rankedKeywords.confirm(missing.toLocaleString(t.displayLocale)));
          if (!ok) return;
          setBusy(true);
          setMsg(null);
          setPhase("fetch");
          setProgress({ processed: 0, total: missing, percent: 0, etaSeconds: null });
          try {
            const result = await runChunkedRankedKeywordsSync(setProgress);
            setPhase("scores");
            await runChunkedRecompute(setProgress);
            setMsg(
              t.rankedKeywords.done(
                result.fetched.toLocaleString(t.displayLocale),
                result.withKeywords.toLocaleString(t.displayLocale)
              )
            );
            loadStatus();
            onDone?.();
          } catch (e) {
            setMsg(e instanceof Error && e.message ? e.message : t.error);
          } finally {
            setBusy(false);
            setProgress(null);
            setPhase(null);
          }
        }}
        className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
      >
        {busy
          ? phase === "scores"
            ? t.rankedKeywords.busyScores
            : t.rankedKeywords.busyFetch
          : t.rankedKeywords.button}
      </button>
      {msg && <p className="text-xs text-slate-500">{msg}</p>}
      {progress && (
        <RecomputeProgressBar
          progress={progress}
          title={
            phase === "scores"
              ? t.rankedKeywords.progressScores
              : t.rankedKeywords.progressFetch
          }
        />
      )}
    </div>
  );
}
