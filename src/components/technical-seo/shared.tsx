"use client";

import { useEffect, useState, type ReactNode } from "react";
import { HEALTH_GOOD, HEALTH_MEDIUM, type MetricValue } from "@/lib/technical-seo";
import type { technicalSeoMessages } from "@/i18n/messages/technical-seo";

export type TechnicalSeoTexts = (typeof technicalSeoMessages)["de"];

function humanize(key: string): string {
  return key
    .split("_")
    .map((part) => (part.length <= 3 && part !== "to" && part !== "too" ? part.toUpperCase() : part))
    .join(" ");
}

/** "title/incorrect_length" → { group: "Title", label: "falsche Länge" } */
export function formatIssueName(name: string, t: TechnicalSeoTexts): { group: string; label: string } {
  const [groupKey, ...rest] = name.split("/");
  const nameKey = rest.join("/");
  return {
    group: t.issueGroups[groupKey] ?? humanize(groupKey),
    label: nameKey ? (t.issueNames[nameKey] ?? humanize(nameKey)) : "",
  };
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 px-5 pt-5">
          {title && <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="p-8 flex flex-col items-center justify-center gap-3">
      <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      {label && <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>}
    </div>
  );
}

export function healthColor(score: number): string {
  if (score >= HEALTH_GOOD) return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20";
  if (score >= HEALTH_MEDIUM) return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20";
  return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20";
}

export function HealthBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400">–</span>;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${healthColor(value)}`}
    >
      {value}
    </span>
  );
}

export function StatusCode({ code }: { code: number | null }) {
  if (code === null) return <span className="text-slate-400">–</span>;
  const color =
    code >= 200 && code < 300
      ? "text-green-600 dark:text-green-400"
      : code >= 300 && code < 400
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";
  return <span className={`font-mono text-xs font-semibold ${color}`}>{code}</span>;
}

export function BoolIcon({
  value,
  trueTitle,
  falseTitle,
  falseIsBad = true,
}: {
  value: boolean;
  trueTitle: string;
  falseTitle: string;
  falseIsBad?: boolean;
}) {
  if (value) {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full"
        title={trueTitle}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${
        falseIsBad
          ? "bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400"
          : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500"
      }`}
      title={falseTitle}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  );
}

const ISSUE_TYPE_STYLES: Record<string, string> = {
  critical: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  fix: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  opportunity: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
};

export function IssueTypeBadge({ type, t }: { type: string; t: TechnicalSeoTexts }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        ISSUE_TYPE_STYLES[type] ?? "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
      }`}
    >
      {t.issueTypes[type] ?? type}
    </span>
  );
}

export function MetricBadge({ metric, format }: { metric: MetricValue | null; format: (v: number) => string }) {
  if (!metric) return <span className="text-slate-400">–</span>;
  const color =
    metric.range === "good"
      ? "text-green-600 dark:text-green-400"
      : metric.range === "needsImprovement"
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";
  return <span className={`text-xs font-semibold ${color}`}>{format(metric.value)}</span>;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            value === option.value
              ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative flex-1 min-w-[240px]">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg className="h-5 w-5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

export function ExportButton({
  onClick,
  disabled,
  busy,
  label,
  busyLabel,
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  label: string;
  busyLabel?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:pointer-events-none transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {busy && busyLabel ? busyLabel : label}
    </button>
  );
}

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
