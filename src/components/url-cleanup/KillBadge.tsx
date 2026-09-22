export function KillBadge({ score, band }: { score: number; band: string }) {
  const cls =
    band === "high"
      ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
      : band === "medium"
        ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
        : band === "low"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
          : "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
  const bar =
    band === "high"
      ? "bg-red-500"
      : band === "medium"
        ? "bg-orange-500"
        : band === "low"
          ? "bg-amber-400"
          : "bg-green-500";
  return (
    <div className="min-w-[4.5rem]">
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tabular-nums ${cls}`}>
        {score}
      </span>
      <div className="mt-1 h-1 w-full rounded bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${Math.max(2, score)}%` }} />
      </div>
    </div>
  );
}
