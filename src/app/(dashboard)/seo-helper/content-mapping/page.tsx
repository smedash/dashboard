"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { canEdit } from "@/lib/rbac";
import { useLocale, useMessages } from "@/i18n/I18nProvider";
import { seoHelperContentMappingMessages } from "@/i18n/messages/seo-helper-content-mapping";
import { Notice, Spinner, apiFetch, buttonSecondary, formatNumber, inputClass } from "@/components/keyword-mapping/ui";
import { ContentMappingIcon } from "@/components/content-mapping/ContentMappingIcon";
import { ContentTable, type SortKey } from "@/components/content-mapping/ContentTable";
import { CrawlBatchButton } from "@/components/content-mapping/CrawlBatchButton";
import {
  EMPTY_FILTERS,
  scopeFromFilters,
  type ContentFacets,
  type ContentFilters,
  type ContentListResponse,
} from "@/components/content-mapping/types";

const PAGE_SIZE = 25;

export default function ContentMappingPage() {
  const t = useMessages(seoHelperContentMappingMessages);
  const { intlLocale } = useLocale();
  const { data: session } = useSession();
  const editable = canEdit(session?.user?.role);

  const [filters, setFilters] = useState<ContentFilters>(EMPTY_FILTERS);
  const [debouncedFilters, setDebouncedFilters] = useState<ContentFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortKey>("gscImpressions");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [data, setData] = useState<ContentListResponse | null>(null);
  const [facets, setFacets] = useState<ContentFacets | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedFilters(filters);
      setPage(0);
    }, 300);
    return () => clearTimeout(id);
  }, [filters]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    const f = debouncedFilters;
    if (f.q.trim()) params.set("q", f.q.trim());
    for (const key of ["status", "country", "language", "section", "minWords"] as const) {
      if (f[key]) params.set(key, f[key]);
    }
    if (f.noindex) params.set("noindex", "true");
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    params.set("sort", sort);
    params.set("sortDir", sortDir);
    return params.toString();
  }, [debouncedFilters, page, sort, sortDir]);
  const requestKey = `${query}#${reloadKey}`;
  const loading = loadedKey !== requestKey;

  const facetsLoadedRef = useRef(false);
  useEffect(() => {
    let cancel = false;
    const url = `/api/seo-helper/content-mapping?${query}${facetsLoadedRef.current ? "" : "&facets=1"}`;
    apiFetch<ContentListResponse>(url)
      .then((res) => {
        if (cancel) return;
        setData(res);
        if (res.facets) {
          facetsLoadedRef.current = true;
          setFacets(res.facets);
        }
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancel) setError(e instanceof Error ? e.message : t.errorGeneric);
      })
      .finally(() => {
        if (!cancel) setLoadedKey(requestKey);
      });
    return () => {
      cancel = true;
    };
  }, [query, requestKey, t.errorGeneric]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const scope = useMemo(() => scopeFromFilters(debouncedFilters), [debouncedFilters]);

  const setFilter = <K extends keyof ContentFilters>(key: K, value: ContentFilters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const onSort = (key: SortKey) => {
    if (sort === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setSortDir(key === "url" ? "asc" : "desc");
    }
    setPage(0);
  };

  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const stats = data?.stats;
  const selectClass = `${inputClass} w-auto`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/seo-helper" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="p-3 rounded-2xl bg-gradient-to-br from-lime-500 to-emerald-600 shadow-lg shadow-emerald-500/25">
          <ContentMappingIcon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white truncate">{t.title}</h1>
          <p className="text-slate-500 dark:text-slate-400">{t.subtitle}</p>
        </div>
        {editable && <CrawlBatchButton scope={scope} onActivity={reload} />}
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(["total", "succeeded", "failed", "skipped", "open"] as const).map((key) => (
            <button
              key={key}
              type="button"
              className="text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 hover:border-teal-400"
              onClick={() => setFilter("status", key === "total" ? "" : key)}
            >
              <div className="text-xs text-slate-500">{t.stats[key]}</div>
              <div className="text-xl font-semibold text-slate-900 dark:text-white tabular-nums">
                {formatNumber(stats[key], intlLocale)}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder={t.filters.search}
          value={filters.q}
          onChange={(e) => setFilter("q", e.target.value)}
        />
        <select className={selectClass} value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
          <option value="">{t.filters.allStatus}</option>
          {["succeeded", "failed", "skipped", "open"].map((s) => (
            <option key={s} value={s}>
              {t.status[s]}
            </option>
          ))}
        </select>
        <select className={selectClass} value={filters.country} onChange={(e) => setFilter("country", e.target.value)}>
          <option value="">{t.filters.allCountries}</option>
          {facets?.countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={selectClass} value={filters.language} onChange={(e) => setFilter("language", e.target.value)}>
          <option value="">{t.filters.allLanguages}</option>
          {facets?.languages.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={selectClass} value={filters.section} onChange={(e) => setFilter("section", e.target.value)}>
          <option value="">{t.filters.allSections}</option>
          {facets?.sections.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          type="number"
          min={0}
          className={`${inputClass} w-32`}
          placeholder={t.filters.minWords}
          value={filters.minWords}
          onChange={(e) => setFilter("minWords", e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={filters.noindex} onChange={(e) => setFilter("noindex", e.target.checked)} />
          {t.filters.noindex}
        </label>
        <button type="button" className={buttonSecondary} onClick={() => setFilters(EMPTY_FILTERS)}>
          {t.filters.reset}
        </button>
        {loading && <Spinner className="w-4 h-4 text-slate-400" />}
      </div>

      {error && <Notice kind="error">{error}</Notice>}

      {data && (
        <>
          <ContentTable
            rows={data.rows}
            expandedId={expandedId}
            onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))}
            sort={sort}
            sortDir={sortDir}
            onSort={onSort}
            editable={editable}
            onRecrawled={reload}
          />
          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
            <span>
              {total > 0
                ? t.table.count(page * PAGE_SIZE + 1, Math.min(total, (page + 1) * PAGE_SIZE), formatNumber(total, intlLocale))
                : ""}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" className={buttonSecondary} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                {t.table.prev}
              </button>
              <span className="tabular-nums">
                {page + 1} / {pageCount}
              </span>
              <button
                type="button"
                className={buttonSecondary}
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                {t.table.next}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
