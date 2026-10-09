export const CLEANUP_STATUSES = ["kill", "candidate", "keep", "mustKeep"] as const;
export type CleanupStatus = (typeof CLEANUP_STATUSES)[number];

export const CLEANUP_STATUS_LABELS: Record<CleanupStatus, string> = {
  kill: "Kill",
  candidate: "Candidate",
  keep: "Keep",
  mustKeep: "MustKeep",
};

export const CLEANUP_STATUS_COLORS: Record<CleanupStatus, string> = {
  kill: "#ef4444",
  candidate: "#f97316",
  keep: "#22c55e",
  mustKeep: "#3b82f6",
};

export type CleanupStatusCounts = Record<CleanupStatus, number>;

export function emptyCleanupStatusCounts(): CleanupStatusCounts {
  return { kill: 0, candidate: 0, keep: 0, mustKeep: 0 };
}

export function tallyCleanupStatusCounts(
  rows: Array<{ killBand: string; count: number }>
): CleanupStatusCounts {
  const counts = emptyCleanupStatusCounts();
  for (const row of rows) {
    counts[cleanupStatusFromKillBand(row.killBand)] += row.count;
  }
  return counts;
}

/** Status analog zur 3D-Wolke: rot=Kill, orange/gelb=Candidate, grün=Keep, blau=MustKeep. */
export function cleanupStatusFromKillBand(band: string): CleanupStatus {
  if (band === "protected") return "mustKeep";
  if (band === "keep") return "keep";
  if (band === "high") return "kill";
  return "candidate";
}

export function formatCleanupStatus(status: string): string {
  if (status in CLEANUP_STATUS_LABELS) {
    return CLEANUP_STATUS_LABELS[status as CleanupStatus];
  }
  return status;
}

export function displayCleanupStatus(killBand: string): { status: CleanupStatus; label: string } {
  const status = cleanupStatusFromKillBand(killBand);
  return { status, label: CLEANUP_STATUS_LABELS[status] };
}

/** Filter auf denselben Bändern wie die Wolke, unabhängig vom gespeicherten cleanupStatus. */
export function killBandsForCleanupStatus(status: string): string[] | undefined {
  if (status === "mustKeep") return ["protected"];
  if (status === "keep") return ["keep"];
  if (status === "kill") return ["high"];
  if (status === "candidate") return ["medium", "low"];
  return undefined;
}

export function isCleanupStatus(value: string): value is CleanupStatus {
  return (CLEANUP_STATUSES as readonly string[]).includes(value);
}
