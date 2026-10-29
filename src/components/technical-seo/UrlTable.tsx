"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { useLocale } from "@/i18n/I18nProvider";
import {
  CRAWLER_BOTS,
  URL_PAGE_SIZE,
  type CrawlerVisit,
  type TechnicalSeoUrl,
  type UrlFilter,
  type UrlListResponse,
  type UrlSortField,
} from "@/lib/technical-seo";
import { BoolIcon, MetricBadge, Spinner, type TechnicalSeoTexts } from "./shared";

export interface UrlQueryState {
  filter: UrlFilter;
  search: string;
  sort: UrlSortField;
  dir: "asc" | "desc";
  page: number;
}

export interface UrlColumn {
  key: string;
  header: string;
  sortField?: UrlSortField;
  render: (row: TechnicalSeoUrl) => ReactNode;
}

function buildQuery(domain: string, q: Omit<UrlQueryState, "page">, extra: Record<string, string>) {
  const params = new URLSearchParams({
    domain,
    filter: q.filter,
    search: q.search,
    sort: q.sort,
    dir: q.dir,
    ...extra,
  });
  return `/api/conductor-monitoring/urls?${params.toString()}`;
}

/** Keeps the previous page visible (dimmed) while the next one loads. */
export function useUrlList(domain: string, q: UrlQueryState) {
  const [result, setResult] = useState<{ url: string; data: UrlListResponse | null; error: boolean } | null>(
    null
  );
  const { filter, search, sort, dir, page } = q;
  const url = buildQuery(domain, { filter, search, sort, dir }, { page: String(page) });

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: UrlListResponse) => {
        if (!cancelled) setResult({ url, data, error: false });
      })
      .catch(() => {
        if (!cancelled) setResult((prev) => ({ url, data: prev?.data ?? null, error: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const settled = result?.url === url;
  return {
    data: result?.data ?? null,
    loading: !settled,
    error: settled && result.error,
  };
}

export async function fetchUrlExport(
  domain: string,
  q: Omit<UrlQueryState, "page">
): Promise<UrlListResponse> {
  const res = await fetch(buildQuery(domain, q, { export: "1" }));
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export function urlPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

export function formatFrequency(visit: CrawlerVisit, t: TechnicalSeoTexts): string | null {
  if (!visit.frequency) return null;
  const unit = t.crawler.units[visit.frequency.unit] ?? visit.frequency.unit;
  return t.crawler.frequency(visit.frequency.value, unit);
}

function DetailField({ label, value, t }: { label: string; value: string | null; t: TechnicalSeoTexts }) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </span>
        {value && (
          <span className="text-xs text-slate-400 dark:text-slate-500">{t.urls.detail.chars(value.length)}</span>
        )}
      </div>
      <p className="text-sm text-slate-800 dark:text-slate-200 break-words">{value || t.urls.detail.empty}</p>
    </div>
  );
}

function UrlDetail({ row, t }: { row: TechnicalSeoUrl; t: TechnicalSeoTexts }) {
  const { intlLocale } = useLocale();
  const d = t.urls.detail;
  const ms = (v: number) => `${(v / 1000).toFixed(1)} s`;
  const lighthouse = [
    { label: t.lighthouse.performance, metric: row.lighthouse.performance, format: (v: number) => String(Math.round(v)) },
    { label: t.lighthouse.lcp, metric: row.lighthouse.lcp, format: ms },
    { label: t.lighthouse.cls, metric: row.lighthouse.cls, format: (v: number) => v.toFixed(3) },
    { label: t.lighthouse.fcp, metric: row.lighthouse.fcp, format: ms },
    { label: t.lighthouse.si, metric: row.lighthouse.si, format: ms },
    { label: t.lighthouse.tbt, metric: row.lighthouse.tbt, format: (v: number) => `${Math.round(v)} ms` },
    { label: t.lighthouse.tti, metric: row.lighthouse.tti, format: ms },
  ];
  const hasLighthouse = lighthouse.some((l) => l.metric);
  const visits = CRAWLER_BOTS.filter((bot) => row.crawlers[bot].lastVisit || row.crawlers[bot].frequency);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-2">
      <div className="lg:col-span-2 space-y-3">
        <DetailField label={d.title} value={row.title} t={t} />
        <DetailField label={d.h1} value={row.h1} t={t} />
        <DetailField label={d.metaDescription} value={row.metaDescription} t={t} />
        <a
          href={row.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline break-all"
        >
          {d.open} ↗
        </a>
      </div>
      <div className="space-y-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            {d.signals}
          </div>
          <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
            <li className="flex items-center gap-2">
              <BoolIcon value={row.isHttps} trueTitle={t.common.yes} falseTitle={t.common.no} />
              {d.https}
            </li>
            <li className="flex items-center gap-2">
              <BoolIcon value={row.isLinked} trueTitle={t.common.yes} falseTitle={t.common.no} />
              {d.linked}
            </li>
            <li className="flex items-center gap-2">
              <BoolIcon
                value={!row.isDisallowedInRobotsTxt}
                trueTitle={t.common.no}
                falseTitle={t.common.yes}
              />
              {d.robotsBlocked}: {row.isDisallowedInRobotsTxt ? t.common.yes : t.common.no}
            </li>
          </ul>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            {d.lighthouse}
          </div>
          {hasLighthouse ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {lighthouse.map((l) => (
                <Fragment key={l.label}>
                  <dt className="text-slate-600 dark:text-slate-400">{l.label}</dt>
                  <dd>
                    <MetricBadge metric={l.metric} format={l.format} />
                  </dd>
                </Fragment>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-slate-400">{d.noLighthouse}</p>
          )}
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
            {d.crawlers}
          </div>
          {visits.length > 0 ? (
            <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
              {visits.map((bot) => {
                const visit = row.crawlers[bot];
                return (
                  <li key={bot} className="flex justify-between gap-2">
                    <span>{t.crawler.bots[bot]}</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {visit.lastVisit ? new Date(visit.lastVisit).toLocaleDateString(intlLocale) : t.crawler.never}
                      {formatFrequency(visit, t) ? ` · ${formatFrequency(visit, t)}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">{d.noCrawlerVisits}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function UrlTable({
  data,
  loading,
  error,
  columns,
  query,
  onSort,
  onPageChange,
  t,
}: {
  data: UrlListResponse | null;
  loading: boolean;
  error: boolean;
  columns: UrlColumn[];
  query: UrlQueryState;
  onSort: (field: UrlSortField) => void;
  onPageChange: (page: number) => void;
  t: TechnicalSeoTexts;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / URL_PAGE_SIZE)) : 1;

  if (error) {
    return <p className="p-6 text-sm text-red-600 dark:text-red-400">{t.loadFailed}</p>;
  }
  if (!data) {
    return <Spinner label={t.loading} />;
  }

  return (
    <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="w-8 px-2 py-3" />
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={column.sortField ? () => onSort(column.sortField!) : undefined}
                  className={`px-4 py-3 text-left text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap ${
                    column.sortField ? "cursor-pointer hover:text-slate-900 dark:hover:text-white" : ""
                  }`}
                >
                  {column.header}
                  {column.sortField && query.sort === column.sortField && (
                    <span className="ml-1">{query.dir === "asc" ? "↑" : "↓"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => {
              const isExpanded = expanded === row.id;
              return (
                <Fragment key={row.id}>
                  <tr
                    onClick={() => setExpanded(isExpanded ? null : row.id)}
                    className={`border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer transition-colors ${
                      isExpanded ? "bg-slate-50 dark:bg-slate-700/20" : ""
                    }`}
                  >
                    <td className="w-8 px-2 py-3 text-center text-slate-400">
                      <svg
                        className={`w-4 h-4 inline-block transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </td>
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && (
                    <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700/50">
                      <td colSpan={columns.length + 1} className="px-6 py-3">
                        <UrlDetail row={row} t={t} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {data.rows.length === 0 && (
          <div className="py-12 text-center text-slate-500 dark:text-slate-500">{t.urls.noResults}</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700">
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {t.urls.pageOf(query.page, totalPages)}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(query.page - 1)}
              disabled={query.page <= 1 || loading}
              className="px-3 py-1 text-sm rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← {t.urls.previous}
            </button>
            <button
              type="button"
              onClick={() => onPageChange(query.page + 1)}
              disabled={query.page >= totalPages || loading}
              className="px-3 py-1 text-sm rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t.urls.next} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
