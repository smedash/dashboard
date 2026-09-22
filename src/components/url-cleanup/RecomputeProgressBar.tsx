import type { RecomputeProgress } from "./run-recompute";
import { formatEta } from "./run-recompute";

export function RecomputeProgressBar({
  progress,
  title = "Scores werden berechnet…",
}: {
  progress: RecomputeProgress;
  title?: string;
}) {
  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-100">
        <span
          className="inline-block h-4 w-4 shrink-0 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"
          aria-hidden
        />
        {title}
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
        {progress.processed.toLocaleString("de-CH")} / {progress.total.toLocaleString("de-CH")} URLs
        {progress.total > 0 ? ` · ${progress.percent} %` : ""}
        {" · "}
        {formatEta(progress.etaSeconds)}
      </p>
      <p className="text-xs text-amber-800 dark:text-amber-200">
        Bitte dieses Fenster geöffnet lassen und nicht neu laden. Die Berechnung hängt am Browser-Request
        und läuft auch in Production nicht im Hintergrund weiter, wenn der Tab geschlossen wird.
      </p>
    </div>
  );
}
