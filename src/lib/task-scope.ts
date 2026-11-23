export const TASK_SCOPES = ["technical", "content", "ux_ui", "offpage", "linking", "other"] as const;

export type TaskScope = (typeof TASK_SCOPES)[number];

export const DEFAULT_TASK_SCOPE: TaskScope = "other";

export function isTaskScope(value: unknown): value is TaskScope {
  return typeof value === "string" && (TASK_SCOPES as readonly string[]).includes(value);
}
