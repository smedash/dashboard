import { displayCleanupStatus, type CleanupStatus } from "@/lib/url-cleanup/cleanup-status";

const STATUS_CLASS: Record<CleanupStatus, string> = {
  kill: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  candidate: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  keep: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  mustKeep: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

export function CleanupStatusBadge({ killBand }: { killBand: string }) {
  const { status, label } = displayCleanupStatus(killBand);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${STATUS_CLASS[status]}`}>
      {label}
    </span>
  );
}
