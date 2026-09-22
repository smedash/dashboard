"use client";

import { useEffect, useState } from "react";
import { RecomputeProgressBar } from "./RecomputeProgressBar";
import { runChunkedRecompute, type RecomputeProgress } from "./run-recompute";
import { runChunkedRankedKeywordsSync } from "./run-ranked-keywords";

type Status = {
  inventoryCount: number;
  cacheCount: number;
  withRankings: number;
  missing: number;
};

export function RankedKeywordsSyncPanel({ onDone }: { onDone?: () => void }) {
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
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
      <h2 className="font-semibold">ranked Keywords (DataForSEO)</h2>
      <p className="text-sm text-slate-500">
        Einmaliger Abruf der Top-Rankings je Inventar-URL. Bereits gespeicherte URLs werden übersprungen.
        Kostenpflichtig — DataForSEO rechnet pro URL. Danach kannst du in der Übersicht nach «mit / ohne
        Rankings» filtern.
      </p>
      {status && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Inventar {status.inventoryCount.toLocaleString("de-CH")} · bereits abgerufen{" "}
          {(status.inventoryCount - status.missing).toLocaleString("de-CH")} · offen{" "}
          {status.missing.toLocaleString("de-CH")} · mit Rankings{" "}
          {status.withRankings.toLocaleString("de-CH")}
        </p>
      )}
      <button
        type="button"
        disabled={busy || (status?.missing ?? 0) === 0}
        onClick={async () => {
          const missing = status?.missing ?? 0;
          const ok = window.confirm(
            `Ranked Keywords für ${missing.toLocaleString("de-CH")} URLs bei DataForSEO holen?\n\nKostenpflichtig, kann mehrere Stunden dauern. Bitte dieses Fenster geöffnet lassen.`
          );
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
              `Fertig: ${result.fetched.toLocaleString("de-CH")} URLs abgerufen, ${result.withKeywords.toLocaleString("de-CH")} mit Rankings. Scores neu berechnet.`
            );
            loadStatus();
            onDone?.();
          } catch (e) {
            setMsg(e instanceof Error ? e.message : "Fehler");
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
            ? "Scores…"
            : "Hole ranked Keywords…"
          : "Fehlende ranked Keywords holen"}
      </button>
      {msg && <p className="text-xs text-slate-500">{msg}</p>}
      {progress && (
        <RecomputeProgressBar
          progress={progress}
          title={
            phase === "scores"
              ? "Scores werden berechnet…"
              : "ranked Keywords werden abgerufen…"
          }
        />
      )}
    </div>
  );
}
