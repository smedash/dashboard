"use client";

import { useState } from "react";
import { downloadExcel } from "@/lib/excel-export";
import { useLocale } from "@/i18n/I18nProvider";
import {
  CRAWLER_BOTS,
  URL_EXPORT_LIMIT,
  URL_FILTERS,
  type TechnicalSeoUrl,
  type UrlFilter,
  type UrlSortField,
} from "@/lib/technical-seo";
import {
  BoolIcon,
  ExportButton,
  HealthBadge,
  SearchInput,
  StatusCode,
  useDebouncedValue,
  type TechnicalSeoTexts,
} from "./shared";
import { UrlTable, fetchUrlExport, urlPath, useUrlList, type UrlColumn } from "./UrlTable";

export function UrlsTab({
  domain,
  t,
  filter,
  onFilterChange,
}: {
  domain: string;
  t: TechnicalSeoTexts;
  filter: UrlFilter;
  onFilterChange: (filter: UrlFilter) => void;
}) {
  const { intlLocale } = useLocale();
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim());
  const [sort, setSort] = useState<UrlSortField>("url");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const [prevQuery, setPrevQuery] = useState({ filter, search });
  if (prevQuery.filter !== filter || prevQuery.search !== search) {
    setPrevQuery({ filter, search });
    setPage(1);
  }

  const query = { filter, search, sort, dir, page };
  const { data, loading, error } = useUrlList(domain, query);

  const handleSort = (field: UrlSortField) => {
    if (field === sort) {
      setDir(dir === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setDir(field === "url" ? "asc" : "desc");
    }
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportNotice(null);
    try {
      const result = await fetchUrlExport(domain, { filter, search, sort, dir });
      const e = t.urls.export;
      const yesNo = (v: boolean) => (v ? e.yes : e.no);
      const rows = result.rows.map((r: TechnicalSeoUrl) => ({
        [e.url]: r.url,
        [e.type]: r.type ? (t.urlTypes[r.type] ?? r.type) : "",
        [e.statusCode]: r.statusCode ?? "",
        [e.health]: r.health ?? "",
        [e.indexable]: yesNo(r.isIndexable),
        [e.inSitemap]: yesNo(r.isInSitemap),
        [e.disallowed]: yesNo(r.isDisallowedInRobotsTxt),
        [e.linked]: yesNo(r.isLinked),
        [e.depth]: r.urlDepth ?? "",
        [e.title]: r.title ?? "",
        [e.h1]: r.h1 ?? "",
        [e.metaDescription]: r.metaDescription ?? "",
        [e.linksIn]: r.incomingInternalLinks,
        [e.linksOut]: r.outgoingInternalLinks,
        [e.external]: r.outgoingExternalLinks,
        [e.downloadMs]: r.timeDocumentDownload ?? "",
        [e.relevance]: r.relevance ?? "",
        [e.performance]: r.lighthouse.performance?.value ?? "",
        [e.lcp]: r.lighthouse.lcp?.value ?? "",
        [e.cls]: r.lighthouse.cls?.value ?? "",
        [e.openIssues]: r.openIssues.join(", "),
        ...Object.fromEntries(
          CRAWLER_BOTS.map((bot) => [
            e.lastVisit(t.crawler.bots[bot]),
            r.crawlers[bot].lastVisit ? new Date(r.crawlers[bot].lastVisit!).toLocaleDateString(intlLocale) : "",
          ])
        ),
      }));
      await downloadExcel(
        `${e.filePrefix}_${domain}_${filter}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        [{ name: e.sheetName, rows }]
      );
      if (result.truncated) setExportNotice(t.urls.exportTruncated(URL_EXPORT_LIMIT));
    } catch {
      setExportNotice(t.loadFailed);
    } finally {
      setExporting(false);
    }
  };

  const c = t.urls.columns;
  const columns: UrlColumn[] = [
    {
      key: "url",
      header: c.url,
      sortField: "url",
      render: (row) => (
        <div className="max-w-[420px]">
          <div className="font-medium text-blue-600 dark:text-blue-400 truncate" title={row.url}>
            {urlPath(row.url)}
          </div>
          {row.title && (
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate" title={row.title}>
              {row.title}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: c.status,
      sortField: "statusCode",
      render: (row) => (
        <div className="whitespace-nowrap">
          <StatusCode code={row.statusCode} />
          {row.type && row.type !== "page" && (
            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
              {t.urlTypes[row.type] ?? row.type}
            </span>
          )}
        </div>
      ),
    },
    { key: "health", header: c.health, sortField: "health", render: (row) => <HealthBadge value={row.health} /> },
    {
      key: "index",
      header: c.index,
      render: (row) =>
        row.type === "page" ? (
          <BoolIcon value={row.isIndexable} trueTitle={t.common.indexable} falseTitle={t.common.notIndexable} />
        ) : (
          <span className="text-slate-400">–</span>
        ),
    },
    {
      key: "sitemap",
      header: c.sitemap,
      render: (row) => (
        <BoolIcon
          value={row.isInSitemap}
          trueTitle={t.common.inSitemap}
          falseTitle={t.common.notInSitemap}
          falseIsBad={false}
        />
      ),
    },
    { key: "depth", header: c.depth, sortField: "urlDepth", render: (row) => row.urlDepth ?? "–" },
    {
      key: "linksIn",
      header: c.linksIn,
      sortField: "incomingInternalLinks",
      render: (row) => row.incomingInternalLinks.toLocaleString(intlLocale),
    },
    {
      key: "linksOut",
      header: c.linksOut,
      sortField: "outgoingInternalLinks",
      render: (row) => row.outgoingInternalLinks.toLocaleString(intlLocale),
    },
    {
      key: "external",
      header: c.external,
      sortField: "outgoingExternalLinks",
      render: (row) => row.outgoingExternalLinks.toLocaleString(intlLocale),
    },
    {
      key: "download",
      header: c.download,
      sortField: "timeDocumentDownload",
      render: (row) =>
        row.timeDocumentDownload === null ? (
          <span className="text-slate-400">–</span>
        ) : (
          <span className="whitespace-nowrap">{row.timeDocumentDownload.toLocaleString(intlLocale)} ms</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={searchInput} onChange={setSearchInput} placeholder={t.urls.searchPlaceholder} />
          <select
            value={filter}
            onChange={(e) => onFilterChange(e.target.value as UrlFilter)}
            className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {URL_FILTERS.map((f) => (
              <option key={f} value={f}>
                {t.urls.filters[f]}
              </option>
            ))}
          </select>
          {data && (
            <span className="text-sm text-slate-600 dark:text-slate-400">{t.urls.count(data.total)}</span>
          )}
          <ExportButton
            onClick={handleExport}
            disabled={!data || data.total === 0}
            busy={exporting}
            label={t.common.exportExcel}
            busyLabel={t.urls.exporting}
            title={t.common.exportTitle}
          />
        </div>
        {exportNotice && <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">{exportNotice}</p>}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <UrlTable
          data={data}
          loading={loading}
          error={error}
          columns={columns}
          query={query}
          onSort={handleSort}
          onPageChange={setPage}
          t={t}
        />
      </div>
    </div>
  );
}
