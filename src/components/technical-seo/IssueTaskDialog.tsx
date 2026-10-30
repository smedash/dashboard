"use client";

import { useEffect, useState } from "react";
import { useMessages } from "@/i18n/I18nProvider";
import { tasksMessages } from "@/i18n/messages/tasks";
import type { TechnicalSeoIssue, UrlListResponse } from "@/lib/technical-seo";
import type { TechnicalSeoTexts } from "./shared";
import { useUrlList } from "./UrlTable";

const MAX_URLS_IN_DESCRIPTION = 20;

const PRIORITY_BY_TYPE: Record<string, string> = {
  critical: "high",
  fix: "medium",
  opportunity: "low",
};

const PRIORITIES = ["low", "medium", "high", "urgent"];

interface TaskUser {
  id: string;
  name: string | null;
  email: string;
}

interface IssueTaskDialogProps {
  domain: string;
  issue: TechnicalSeoIssue;
  label: string;
  t: TechnicalSeoTexts;
  onClose: () => void;
  onCreated: () => void;
}

function buildDescription(
  domain: string,
  issue: TechnicalSeoIssue,
  label: string,
  urls: UrlListResponse | null,
  t: TechnicalSeoTexts
): string {
  const d = t.issues.task.description;
  const lines = [
    `${d.website}: ${domain}`,
    `${d.issue}: ${label}`,
    `${d.key}: ${issue.name}`,
    `${d.type}: ${t.issueTypes[issue.type] ?? issue.type}`,
    issue.tags.length > 0 ? `${d.tags}: ${issue.tags.join(", ").toUpperCase()}` : "",
    `${d.pagesOpen}: ${issue.pagesOpen}`,
    issue.pointsToGain > 0 ? `${d.pointsToGain}: +${issue.pointsToGain}` : "",
  ].filter(Boolean);

  if (issue.pagesOpen === 0) {
    lines.push("", d.websiteWide);
  } else if (urls && urls.rows.length > 0) {
    const shown = urls.rows.slice(0, MAX_URLS_IN_DESCRIPTION);
    lines.push("", d.affectedUrls(shown.length, urls.total), ...shown.map((row) => `- ${row.url}`));
    if (shown.length < urls.total) lines.push("", d.moreUrls);
  }
  return lines.join("\n");
}

export function IssueTaskDialog({ domain, issue, label, t, onClose, onCreated }: IssueTaskDialogProps) {
  const tt = useMessages(tasksMessages);
  const texts = t.issues.task;
  const [title, setTitle] = useState(() => texts.title(label, domain));
  const [editedDescription, setEditedDescription] = useState<string | null>(null);
  const [priority, setPriority] = useState(PRIORITY_BY_TYPE[issue.type] ?? "medium");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [users, setUsers] = useState<TaskUser[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(false);

  const { data: urls, loading: urlsLoading } = useUrlList(domain, {
    filter: "all",
    search: "",
    issue: issue.name,
    sort: "health",
    dir: "asc",
    page: 1,
  });
  const waitingForUrls = issue.pagesOpen > 0 && urlsLoading && editedDescription === null;
  const description = editedDescription ?? buildDescription(domain, issue, label, urls, t);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: { users?: TaskUser[] }) => {
        if (!cancelled) setUsers(data.users ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const toggleAssignee = (userId: string) => {
    setAssigneeIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    setError(false);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          status: "backlog",
          priority,
          labels: ["technical-seo", issue.type, ...issue.tags],
          assigneeIds,
        }),
      });
      if (!res.ok) throw new Error(res.statusText);
      onCreated();
    } catch {
      setError(true);
      setCreating(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white";
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{texts.dialogTitle}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{tt.create.inColumn(tt.columns.backlog)}</p>
        </div>

        <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto">
          <div>
            <label className={labelClass}>{tt.create.titleLabel}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label className={labelClass}>{tt.create.description}</label>
            {waitingForUrls ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-2">{texts.loadingUrls}</p>
            ) : (
              <textarea
                value={description}
                onChange={(e) => setEditedDescription(e.target.value)}
                rows={10}
                className={`${inputClass} font-mono text-xs`}
              />
            )}
          </div>

          <div>
            <label className={labelClass}>{tt.create.priority}</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {tt.priorities[p]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>{tt.create.assignTo(assigneeIds.length)}</label>
            <div className="border border-slate-300 dark:border-slate-600 rounded-lg p-2 max-h-32 overflow-y-auto space-y-1">
              {users.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center gap-2 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={assigneeIds.includes(user.id)}
                    onChange={() => toggleAssignee(user.id)}
                    className="rounded border-slate-300 dark:border-slate-600"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{user.name || user.email}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{texts.createFailed}</p>}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            {tt.create.cancel}
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || waitingForUrls || !title.trim()}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg transition-colors"
          >
            {creating ? tt.create.creating : tt.create.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
