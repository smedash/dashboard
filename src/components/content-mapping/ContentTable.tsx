"use client";

import { Fragment } from "react";
import { useLocale, useMessages } from "@/i18n/I18nProvider";
import { seoHelperContentMappingMessages } from "@/i18n/messages/seo-helper-content-mapping";
import { formatNumber } from "@/components/keyword-mapping/ui";
import { ContentDetail } from "./ContentDetail";
import type { ContentRow } from "./types";

const STATUS_STYLES: Record<string, string> = {
  succeeded: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  skipped: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  open: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export type SortKey = "url" | "gscImpressions" | "wordCount" | "sectionCount" | "crawledAt";

export function ContentTable({
  rows,
  expandedId,
  onToggle,
  sort,
  sortDir,
  onSort,
  editable,
  onRecrawled,
}: {
  rows: ContentRow[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  sort: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  editable: boolean;
  onRecrawled: () => void;
}) {
  const t = useMessages(seoHelperContentMappingMessages);
  const { intlLocale } = useLocale();

  const sortHeader = (key: SortKey, label: string, className = "") => (
    <th className={`px-3 py-2 font-medium ${className}`}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white" onClick={() => onSort(key)}>
        {label}
        {sort === key && <span>{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900/40 text-left text-xs text-slate-500 dark:text-slate-400">
          <tr>
            <th className="w-8" />
            {sortHeader("url", t.table.url)}
            <th className="px-3 py-2 font-medium">{t.table.title}</th>
            <th className="px-3 py-2 font-medium">{t.table.status}</th>
            {sortHeader("wordCount", t.table.words, "text-right")}
            {sortHeader("sectionCount", t.table.sections, "text-right")}
            <th className="px-3 py-2 font-medium text-right">{t.table.http}</th>
            {sortHeader("crawledAt", t.table.crawledAt)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                {t.table.empty}
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const isOpen = expandedId === row.id;
            const status = row.content?.status && row.content.status !== "pending" ? row.content.status : "open";
            return (
              <Fragment key={row.id}>
                <tr
                  className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 ${isOpen ? "bg-slate-50 dark:bg-slate-700/40" : ""}`}
                  onClick={() => onToggle(row.id)}
                >
                  <td className="pl-3">
                    <svg
                      className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </td>
                  <td className="px-3 py-2 max-w-md">
                    <div className="truncate text-slate-800 dark:text-slate-100" title={row.url}>
                      {row.url}
                    </div>
                    <div className="text-xs text-slate-400">
                      {[row.country, row.language, row.section].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="px-3 py-2 max-w-sm">
                    <div className="truncate text-slate-700 dark:text-slate-200" title={row.content?.title ?? ""}>
                      {row.content?.title || t.none}
                    </div>
                    {row.content?.h1 && (
                      <div className="truncate text-xs text-slate-500" title={row.content.h1}>
                        H1: {row.content.h1}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.open}`}
                      title={row.content?.error ?? undefined}
                    >
                      {t.status[status] ?? status}
                    </span>
                    {row.content?.robots?.includes("noindex") && (
                      <span className="ml-1 inline-flex px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        noindex
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.content ? formatNumber(row.content.wordCount, intlLocale) : t.none}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.content ? row.content.sectionCount : t.none}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{row.content?.httpStatus ?? t.none}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                    {row.content?.crawledAt ? new Date(row.content.crawledAt).toLocaleDateString(intlLocale) : t.none}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="bg-slate-50/60 dark:bg-slate-900/30">
                    <td colSpan={8} className="px-6 py-4">
                      <ContentDetail inventoryId={row.id} editable={editable} onRecrawled={onRecrawled} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
