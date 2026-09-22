export type RecomputeProgress = {
  processed: number;
  total: number;
  percent: number;
  etaSeconds: number | null;
};

export function formatEta(seconds: number | null): string {
  if (seconds == null) return "Restzeit wird ermittelt…";
  if (seconds < 20) return "noch wenige Sekunden";
  if (seconds < 90) return `noch ca. ${Math.round(seconds)} Sek.`;
  if (seconds < 3600) return `noch ca. ${Math.max(1, Math.round(seconds / 60))} Min.`;
  const hours = seconds / 3600;
  if (hours < 10) return `noch ca. ${hours.toFixed(1).replace(".", ",")} Std.`;
  return `noch ca. ${Math.round(hours)} Std.`;
}

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
    if (!res.ok) throw new Error(data.error || "Score-Berechnung fehlgeschlagen");

    total = data.total ?? total;
    processed += data.batchUpdated ?? 0;
    const elapsed = (Date.now() - started) / 1000;
    const etaSeconds =
      processed > 1500 && elapsed > 0.5 && total > processed
        ? ((total - processed) * elapsed) / processed
        : processed >= total
          ? 0
          : null;

    onProgress({
      processed: Math.min(processed, total || processed),
      total,
      percent: total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0,
      etaSeconds,
    });

    if (data.done || !data.nextCursor) return processed;
    cursor = data.nextCursor;
  }
}
