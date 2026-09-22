"use client";

import { useEffect, useState } from "react";
import type { KillScoreSettings } from "@/lib/url-cleanup/kill-score";
import { RecomputeProgressBar } from "./RecomputeProgressBar";
import { runChunkedRecompute, type RecomputeProgress } from "./run-recompute";

export function ThresholdPanel({ onSaved }: { onSaved?: () => void }) {
  const [settings, setSettings] = useState<KillScoreSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<RecomputeProgress | null>(null);

  useEffect(() => {
    fetch("/api/url-cleanup/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings))
      .catch(() => setSettings(null));
  }, []);

  useEffect(() => {
    if (!saving) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [saving]);

  if (!settings) return null;

  const num = (k: keyof KillScoreSettings, label: string) => (
    <label className="block text-xs text-slate-500">
      {label}
      <input
        type="number"
        value={settings[k] as number}
        onChange={(e) => setSettings({ ...settings, [k]: Number(e.target.value) })}
        disabled={saving}
        className="mt-1 w-full px-2 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
      />
    </label>
  );

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800">
      <button
        type="button"
        onClick={() => {
          if (!saving) setOpen(!open);
        }}
        className="w-full px-4 py-3 text-left text-sm font-medium text-slate-800 dark:text-slate-100"
      >
        Score-Schwellen {open ? "▸" : "▾"}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="block text-xs text-slate-500">
              GSC-Zeitraum
              <select
                value={settings.gscPeriod}
                onChange={(e) => setSettings({ ...settings, gscPeriod: e.target.value })}
                disabled={saving}
                className="mt-1 w-full px-2 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
              >
                {["7d", "28d", "3m", "6m", "8m", "12m"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            {num("maxGscClicks", "Max. GSC-Klicks")}
            {num("maxGscImpressions", "Max. GSC-Impressions")}
            {num("maxAaVisits", "Max. Adobe-Visits")}
            {num("maxAaLeads", "Max. Leads")}
            {num("lastmodMonths", "lastmod älter (Monate)")}
            {num("vetoGscClicks", "Veto ab GSC-Klicks")}
            {num("vetoAaVisits", "Veto ab Adobe-Visits")}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                setOpen(true);
                setMsg(null);
                setProgress({ processed: 0, total: 0, percent: 0, etaSeconds: null });
                try {
                  const res = await fetch("/api/url-cleanup/settings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ settings, recompute: false }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Fehler");
                  const updated = await runChunkedRecompute(setProgress);
                  setMsg(`Neu berechnet: ${updated.toLocaleString("de-CH")} URLs`);
                  onSaved?.();
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : "Fehler");
                } finally {
                  setSaving(false);
                  setProgress(null);
                }
              }}
              className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
            >
              {saving ? "Berechne…" : "Speichern & Scores neu rechnen"}
            </button>
            {msg && !saving && <span className="text-xs text-slate-500">{msg}</span>}
          </div>
          {progress && <RecomputeProgressBar progress={progress} />}
        </div>
      )}
    </div>
  );
}
