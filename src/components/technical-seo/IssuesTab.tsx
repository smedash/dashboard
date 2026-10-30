"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { downloadExcel } from "@/lib/excel-export";
import { useLocale } from "@/i18n/I18nProvider";
import {
  isOpenIssue,
  type IssuesResponse,
  type PageIssueCoverage,
  type TechnicalSeoIssue,
} from "@/lib/technical-seo";
import { IssueUrls } from "./IssueUrls";
import {
  ExportButton,
  IssueTypeBadge,
  SearchInput,
  SegmentedControl,
  Spinner,
  formatIssueName,
  type TechnicalSeoTexts,
} from "./shared";

type TypeFilter = "all" | "critical" | "fix" | "opportunity";
type TagFilter = "all" | "seo" | "aeo";

export function IssuesTab({ domain, t }: { domain: string; t: TechnicalSeoTexts }) {
  const { intlLocale } = useLocale();
  const [result, setResult] = useState<{
    domain: string;
    issues: TechnicalSeoIssue[] | null;
    coverage: PageIssueCoverage | null;
    error: boolean;
  } | null>(null);
  const current = result?.domain === domain ? result : null;
  const issues = current?.issues ?? null;
  const coverage = current?.coverage ?? null;
  const error = current?.error ?? false;
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [tagFilter, setTagFilter] = useState<TagFilter>("all");
  const [onlyOpen, setOnlyOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/conductor-monitoring/issues?domain=${encodeURIComponent(domain)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: IssuesResponse) => {
        if (!cancelled) {
          setResult({ domain, issues: data.issues ?? [], coverage: data.coverage ?? null, error: false });
        }
      })
      .catch(() => {
        if (!cancelled) setResult({ domain, issues: null, coverage: null, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [domain]);

  const rows = useMemo(() => {
    const searchLower = search.toLowerCase().trim();
    return (issues ?? [])
      .map((issue) => {
        const { group, label } = formatIssueName(issue.name, t);
        return { ...issue, label: `${group}: ${label}`, tagList: issue.tags.join(", ") };
      })
      .filter((issue) => {
        if (onlyOpen && !isOpenIssue(issue)) return false;
        if (typeFilter !== "all" && issue.type !== typeFilter) return false;
        if (tagFilter !== "all" && !issue.tags.includes(tagFilter)) return false;
        if (
          searchLower &&
          !issue.label.toLowerCase().includes(searchLower) &&
          !issue.name.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
        return true;
      });
  }, [issues, search, typeFilter, tagFilter, onlyOpen, t]);

  const exportToXlsx = () => {
    const c = t.issues.columns;
    downloadExcel(
      `${t.issues.export.filePrefix}_${domain}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      [
        {
          name: t.issues.export.sheetName,
          rows: rows.map((r) => ({
            [c.issue]: r.label,
            [t.issues.export.key]: r.name,
            [c.type]: t.issueTypes[r.type] ?? r.type,
            [c.tags]: r.tagList,
            [c.pagesOpen]: r.pagesOpen,
            [c.pagesClosed]: r.pagesClosed,
            [c.pagesIgnored]: r.pagesIgnored,
            [c.pointsToGain]: r.pointsToGain,
            [c.pointsGained]: r.pointsGained,
          })),
        },
      ]
    );
  };

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{t.loadFailed}</p>;
  }

  const c = t.issues.columns;
  const formatNumber = (value: unknown) => Number(value).toLocaleString(intlLocale);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder={t.issues.searchPlaceholder} />
          <SegmentedControl<TypeFilter>
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { value: "all", label: t.issues.allTypes },
              { value: "critical", label: t.issueTypes.critical },
              { value: "fix", label: t.issueTypes.fix },
              { value: "opportunity", label: t.issueTypes.opportunity },
            ]}
          />
          <SegmentedControl<TagFilter>
            value={tagFilter}
            onChange={setTagFilter}
            options={[
              { value: "all", label: t.issues.allTags },
              { value: "seo", label: "SEO" },
              { value: "aeo", label: "AEO" },
            ]}
          />
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyOpen}
              onChange={(e) => setOnlyOpen(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600"
            />
            {t.issues.onlyOpen}
          </label>
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {t.issues.count(rows.length, issues?.length ?? 0)}
          </span>
          <ExportButton
            onClick={exportToXlsx}
            disabled={rows.length === 0}
            label={t.common.exportExcel}
            title={t.common.exportTitle}
          />
        </div>
        {coverage && coverage.pages > 0 && (
          <p
            className={`mt-3 text-sm ${
              coverage.synced < coverage.pages
                ? "text-amber-600 dark:text-amber-400"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {coverage.synced === 0
              ? t.issues.coverageNone
              : coverage.synced < coverage.pages
                ? t.issues.coveragePartial(coverage.synced, coverage.pages)
                : `${t.issues.expandHint} ${
                    coverage.syncedAt
                      ? t.issues.coverageAsOf(new Date(coverage.syncedAt).toLocaleDateString(intlLocale))
                      : ""
                  }`}
          </p>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {issues === null ? (
          <Spinner label={t.loading} />
        ) : (
          <DataTable
            data={rows}
            keyField="id"
            expandableRow={{
              render: (row) => <IssueUrls domain={domain} issue={row} label={row.label} t={t} />,
            }}
            columns={[
              {
                key: "label",
                header: c.issue,
                sortable: true,
                render: (value, row) => (
                  <div className="min-w-[220px]">
                    <div className="font-medium text-slate-900 dark:text-white">{String(value)}</div>
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400">{row.name}</div>
                  </div>
                ),
              },
              {
                key: "type",
                header: c.type,
                sortable: true,
                render: (value) => <IssueTypeBadge type={String(value)} t={t} />,
              },
              {
                key: "tagList",
                header: c.tags,
                render: (_, row) => (
                  <div className="flex gap-1">
                    {row.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ),
              },
              {
                key: "pagesOpen",
                header: c.pagesOpen,
                sortable: true,
                render: (value) => (
                  <span className={Number(value) > 0 ? "font-semibold text-slate-900 dark:text-white" : "text-slate-400"}>
                    {formatNumber(value)}
                  </span>
                ),
              },
              { key: "pagesClosed", header: c.pagesClosed, sortable: true, render: formatNumber },
              { key: "pagesIgnored", header: c.pagesIgnored, sortable: true, render: formatNumber },
              {
                key: "pointsToGain",
                header: c.pointsToGain,
                sortable: true,
                render: (value) =>
                  Number(value) > 0 ? (
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{String(value)}</span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  ),
              },
              { key: "pointsGained", header: c.pointsGained, sortable: true, render: formatNumber },
            ]}
          />
        )}
      </div>
    </div>
  );
}
