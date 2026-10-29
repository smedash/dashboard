export type RecomputeProgress = {
  processed: number;
  total: number;
  percent: number;
  etaSeconds: number | null;
  aligning?: boolean;
};

export async function runChunkedRecompute(
  onProgress: (p: RecomputeProgress) => void
): Promise<number> {
  let cursor: string | undefined;
  let processed = 0;
  let total = 0;
  const started = Date.now();

  for (;;) {
    const res = await fetch("/api/url-cleanup/recompute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cursor }),
    });
    const data = (await res.json()) as {
      done?: boolean;
      batchUpdated?: number;
      nextCursor?: string | null;
      total?: number;
      error?: string;
    };
    if (!res.ok) throw new Error(data.error || "");

    total = data.total ?? total;
    processed += data.batchUpdated ?? 0;
    const finished = Boolean(data.done);
    const elapsed = (Date.now() - started) / 1000;
    const aligning = !finished && total > 0 && processed >= total;
    const etaSeconds = aligning
      ? null
      : processed > 1500 && elapsed > 0.5 && total > processed
        ? ((total - processed) * elapsed) / processed
        : finished
          ? 0
          : null;

    onProgress({
      processed: Math.min(processed, total || processed),
      total,
      percent: total > 0 ? Math.min(finished ? 100 : 99, Math.round((processed / total) * 100)) : 0,
      etaSeconds,
      aligning,
    });

    if (data.done || !data.nextCursor) return processed;
    cursor = data.nextCursor;
  }
}
