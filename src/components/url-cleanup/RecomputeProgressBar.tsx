"use client";

import { useMessages } from "@/i18n/I18nProvider";
import { urlCleanupMessages } from "@/i18n/messages/url-cleanup";
import type { RecomputeProgress } from "./run-recompute";

export function RecomputeProgressBar({
  progress,
  title,
}: {
  progress: RecomputeProgress;
  title?: string;
}) {
  const t = useMessages(urlCleanupMessages);
  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
        <span
          className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"
          aria-hidden
        />
        {title ?? t.progress.defaultTitle}
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
        {progress.processed.toLocaleString(t.displayLocale)} / {progress.total.toLocaleString(t.displayLocale)} URLs
        {progress.total > 0 ? ` · ${progress.percent} %` : ""}
        {" · "}
        {progress.aligning ? t.progress.aligning : t.progress.eta(progress.etaSeconds)}
      </p>
      <p className="text-xs text-amber-800 dark:text-amber-200">
        {t.progress.keepOpen}
      </p>
    </div>
  );
}
