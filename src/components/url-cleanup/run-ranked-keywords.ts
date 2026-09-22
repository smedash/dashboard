import type { RecomputeProgress } from "./run-recompute";

export async function runChunkedRankedKeywordsSync(
  onProgress: (p: RecomputeProgress) => void
): Promise<{ fetched: number; withKeywords: number }> {
  const statusRes = await fetch("/api/url-cleanup/ranked-keywords-sync");
  const status = (await statusRes.json()) as {
    missing?: number;
    error?: string;
  };
  if (!statusRes.ok) throw new Error(status.error || "Status fehlgeschlagen");

  const total = status.missing ?? 0;
  if (total === 0) {
    onProgress({ processed: 0, total: 0, percent: 100, etaSeconds: 0 });
    return { fetched: 0, withKeywords: 0 };
  }

  let cursor: string | undefined;
  let processed = 0;
  let fetchedTotal = 0;
  let withKeywords = 0;
  const started = Date.now();
  onProgress({ processed: 0, total, percent: 0, etaSeconds: null });

  for (;;) {
    const res = await fetch("/api/url-cleanup/ranked-keywords-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cursor }),
    });
    const data = (await res.json()) as {
      done?: boolean;
      nextCursor?: string | null;
      fetched?: number;
      backfilled?: number;
      withKeywords?: number;
      error?: string;
      needsCredentials?: boolean;
    };
    if (!res.ok) throw new Error(data.error || "Ranked-Keywords-Abruf fehlgeschlagen");

    const step = (data.fetched ?? 0) + (data.backfilled ?? 0);
    fetchedTotal += data.fetched ?? 0;
    withKeywords += data.withKeywords ?? 0;
    processed += step;
    const elapsed = (Date.now() - started) / 1000;
    const etaSeconds =
      processed > 24 && elapsed > 1 && total > processed
        ? ((total - processed) * elapsed) / processed
        : processed >= total
          ? 0
          : null;

    onProgress({
      processed: Math.min(processed, total),
      total,
      percent: total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 100,
      etaSeconds,
    });

    if (data.done || !data.nextCursor) {
      onProgress({ processed: total, total, percent: 100, etaSeconds: 0 });
      return { fetched: fetchedTotal, withKeywords };
    }
    cursor = data.nextCursor ?? undefined;
  }
}
