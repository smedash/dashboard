"use client";

import { useState } from "react";
import { downloadExcel } from "@/lib/excel-export";
import { useLocale } from "@/i18n/I18nProvider";
import { URL_EXPORT_LIMIT, type TechnicalSeoIssue, type UrlSortField } from "@/lib/technical-seo";
import { ExportButton, HealthBadge, StatusCode, type TechnicalSeoTexts } from "./shared";
import { ConductorLink, UrlTable, fetchUrlExport, urlPath, useUrlList, type UrlColumn } from "./UrlTable";

interface IssueUrlsProps {
  domain: string;
  issue: TechnicalSeoIssue;
  label: string;
  t: TechnicalSeoTexts;
}

/** Expanded panel of an issue row: the pages that currently have this issue open. */
export function IssueUrls(props: IssueUrlsProps) {
  if (props.issue.pagesOpen === 0) {
    return <p className="text-sm text-slate-600 dark:text-slate-400 py-2">{props.t.issues.websiteWideHint}</p>;
  }
  return <IssueUrlList {...props} />;
}

function IssueUrlList({ domain, issue, label, t }: IssueUrlsProps) {
  const { intlLocale } = useLocale();
  const [sort, setSort] = useState<UrlSortField>("health");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const query = { filter: "all" as const, search: "", issue: issue.name, sort, dir, page };
  const { data, loading, error } = useUrlList(domain, query);

  const handleSort = (field: UrlSortField) => {
    if (field === sort) {
      setDir(dir === "asc" ? "desc" : "asc");
    } else {
      setSort(field);
      setDir(field === "url" || field === "health" ? "asc" : "desc");
    }
    setPage(1);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportNotice(null);
    try {
      const result = await fetchUrlExport(domain, { filter: "all", search: "", issue: issue.name, sort, dir });
      const e = t.issues.urlExport;
      await downloadExcel(
        `${e.filePrefix}_${domain}_${issue.name.replace(/\//g, "-")}_${new Date().toISOString().slice(0, 10)}.xlsx`,
        [
          {
            name: e.sheetName,
            rows: result.rows.map((r) => ({
              [e.issue]: label,
              [e.url]: r.url,
              [e.statusCode]: r.statusCode ?? "",
              [e.health]: r.health ?? "",
              [e.title]: r.title ?? "",
              [e.conductor]: r.appUrl ?? "",
            })),
          },
        ]
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
        <div className="max-w-[520px]">
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
    { key: "status", header: c.status, sortField: "statusCode", render: (row) => <StatusCode code={row.statusCode} /> },
    { key: "health", header: c.health, sortField: "health", render: (row) => <HealthBadge value={row.health} /> },
    {
      key: "linksIn",
      header: c.linksIn,
      sortField: "incomingInternalLinks",
      render: (row) => row.incomingInternalLinks.toLocaleString(intlLocale),
    },
    {
      key: "conductor",
      header: "",
      render: (row) => (row.appUrl ? <ConductorLink href={row.appUrl} label={t.issues.openInConductor} /> : null),
    },
  ];

  return (
    <div className="space-y-3 py-1" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-3">
        {data && (
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {t.issues.affectedUrls(data.total, issue.pagesOpen)}
          </span>
        )}
        <div className="ml-auto">
          <ExportButton
            onClick={handleExport}
            disabled={!data || data.total === 0}
            busy={exporting}
            label={t.common.exportExcel}
            busyLabel={t.urls.exporting}
            title={t.common.exportTitle}
          />
        </div>
      </div>
      {exportNotice && <p className="text-sm text-amber-600 dark:text-amber-400">{exportNotice}</p>}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <UrlTable
          data={data}
          loading={loading}
          error={error}
          columns={columns}
          query={query}
          onSort={handleSort}
          onPageChange={setPage}
          emptyText={t.issues.noAffectedUrls}
          t={t}
        />
      </div>
    </div>
  );
}
