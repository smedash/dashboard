"use client";

import { useEffect, useState } from "react";
import type { KillScoreSettings } from "@/lib/url-cleanup/kill-score";
import { parseKeepUrlPatterns } from "@/lib/url-cleanup/keep-patterns";
import { RecomputeProgressBar } from "./RecomputeProgressBar";
import { runChunkedRecompute, type RecomputeProgress } from "./run-recompute";
import { useMessages } from "@/i18n/I18nProvider";
import { urlCleanupMessages } from "@/i18n/messages/url-cleanup";

export function ThresholdPanel({ onSaved }: { onSaved?: () => void }) {
  const t = useMessages(urlCleanupMessages);
  const [settings, setSettings] = useState<KillScoreSettings | null>(null);
  const [keepText, setKeepText] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<RecomputeProgress | null>(null);

  useEffect(() => {
    fetch("/api/url-cleanup/settings")
      .then((r) => r.json())
      .then((d) => {
        const next = d.settings as KillScoreSettings | undefined;
        if (!next) throw new Error(d.error || "Settings fehlen");
        setSettings(next);
        setKeepText((next.keepUrlPatterns ?? []).join("\n"));
      })
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

  const num = (k: Exclude<keyof KillScoreSettings, "gscPeriod" | "keepUrlPatterns">, label: string) => (
    <label className="block text-xs text-slate-500">
      {label}
      <input
        type="number"
        value={settings[k]}
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
        {t.thresholds.title}
        {parseKeepUrlPatterns(keepText).length > 0
          ? ` (${parseKeepUrlPatterns(keepText).length})`
          : ""}{" "}
        {open ? "▸" : "▾"}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="block text-xs text-slate-500">
              {t.thresholds.gscPeriod}
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
            {num("maxGscClicks", t.thresholds.maxGscClicks)}
            {num("maxGscImpressions", t.thresholds.maxGscImpressions)}
            {num("maxAaVisits", t.thresholds.maxAaVisits)}
            {num("maxAaLeads", t.thresholds.maxAaLeads)}
            {num("lastmodMonths", t.thresholds.lastmodMonths)}
            {num("vetoGscClicks", t.thresholds.vetoGscClicks)}
            {num("vetoAaVisits", t.thresholds.vetoAaVisits)}
          </div>
          <label className="block text-xs text-slate-500">
            {t.thresholds.keepUrls}
            <span className="mt-0.5 block font-normal text-slate-400">
              {t.thresholds.keepHelpBefore} <code className="text-slate-500">/legal/</code>{" "}
              {t.thresholds.keepHelpAfter}
            </span>
            <textarea
              value={keepText}
              onChange={(e) => setKeepText(e.target.value)}
              disabled={saving}
              rows={6}
              spellCheck={false}
              placeholder={"/legal/\nhttps://www.ubs.com/ch/de/legal/privacy.html"}
              className="mt-1 w-full px-2 py-1.5 text-sm font-mono rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            />
            <span className="mt-1 block text-[11px] text-slate-400">
              {t.thresholds.patterns(
                parseKeepUrlPatterns(keepText).length,
                parseKeepUrlPatterns(keepText).length.toLocaleString(t.displayLocale)
              )}
            </span>
          </label>
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
                  const keepUrlPatterns = parseKeepUrlPatterns(keepText);
                  const payload = { ...settings, keepUrlPatterns };
                  const res = await fetch("/api/url-cleanup/settings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ settings: payload, recompute: false }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || t.error);
                  const updated = await runChunkedRecompute(setProgress);
                  setSettings({ ...payload });
                  setKeepText(keepUrlPatterns.join("\n"));
                  setMsg(t.thresholds.recomputed(updated.toLocaleString(t.displayLocale)));
                  onSaved?.();
                } catch (e) {
                  setMsg(e instanceof Error && e.message ? e.message : t.error);
                } finally {
                  setSaving(false);
                  setProgress(null);
                }
              }}
              className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
            >
              {saving ? t.thresholds.saving : t.thresholds.save}
            </button>
            {msg && !saving && <span className="text-xs text-slate-500">{msg}</span>}
          </div>
          {progress && <RecomputeProgressBar progress={progress} />}
        </div>
      )}
    </div>
  );
}
