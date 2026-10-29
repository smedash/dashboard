"use client";

import { useState } from "react";
import { useLocale } from "@/i18n/I18nProvider";
import { CRAWLER_BOTS, type CrawlerBot, type CrawlerSummary, type UrlSortField } from "@/lib/technical-seo";
import { Panel, SegmentedControl, type TechnicalSeoTexts } from "./shared";
import { UrlTable, formatFrequency, urlPath, useUrlList, type UrlColumn } from "./UrlTable";

const SORT_FIELD: Record<CrawlerBot, UrlSortField> = {
  google: "lfaGoogleLastVisit",
  bing: "lfaBingLastVisit",
  openai: "lfaOpenaiLastVisit",
  perplexity: "lfaPerplexityLastVisit",
};

type BotScope = "all" | "ai";

export function CrawlerTab({
  domain,
  crawlers,
  t,
}: {
  domain: string;
  crawlers: CrawlerSummary[];
  t: TechnicalSeoTexts;
}) {
  const hasData = crawlers.some((c) => c.pagesVisited > 0);

  if (!hasData) {
    return (
      <Panel>
        <div className="py-8 max-w-2xl mx-auto text-center">
          <svg className="w-10 h-10 mx-auto mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">{t.crawler.emptyTitle}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">{t.crawler.emptyText}</p>
        </div>
      </Panel>
    );
  }

  return <CrawlerData domain={domain} crawlers={crawlers} t={t} />;
}

function CrawlerData({
  domain,
  crawlers,
  t,
}: {
  domain: string;
  crawlers: CrawlerSummary[];
  t: TechnicalSeoTexts;
}) {
  const { intlLocale } = useLocale();
  const [scope, setScope] = useState<BotScope>("all");
  const [sort, setSort] = useState<UrlSortField>("lfaGoogleLastVisit");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const query = { filter: scope === "ai" ? "aiCrawled" : "crawled", search: "", sort, dir, page } as const;
  const { data, loading, error } = useUrlList(domain, query);

  const bots: CrawlerBot[] = scope === "ai" ? ["openai", "perplexity"] : [...CRAWLER_BOTS];
  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(intlLocale) : t.crawler.never;

  const handleScope = (next: BotScope) => {
    setScope(next);
    setSort(next === "ai" ? "lfaOpenaiLastVisit" : "lfaGoogleLastVisit");
    setDir("desc");
    setPage(1);
  };

  const handleSort = (field: UrlSortField) => {
    if (field === sort) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSort(field);
      setDir(field === "url" ? "asc" : "desc");
    }
    setPage(1);
  };

  const columns: UrlColumn[] = [
    {
      key: "url",
      header: t.urls.columns.url,
      sortField: "url",
      render: (row) => (
        <div className="max-w-[420px] font-medium text-blue-600 dark:text-blue-400 truncate" title={row.url}>
          {urlPath(row.url)}
        </div>
      ),
    },
    ...bots.map<UrlColumn>((bot) => ({
      key: bot,
      header: t.crawler.bots[bot],
      sortField: SORT_FIELD[bot],
      render: (row) => {
        const visit = row.crawlers[bot];
        if (!visit.lastVisit) return <span className="text-slate-400">–</span>;
        return (
          <div className="whitespace-nowrap">
            <div>{formatDate(visit.lastVisit)}</div>
            {formatFrequency(visit, t) && (
              <div className="text-xs text-slate-500 dark:text-slate-400">{formatFrequency(visit, t)}</div>
            )}
          </div>
        );
      },
    })),
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {crawlers.map((c) => (
          <Panel key={c.bot} title={t.crawler.bots[c.bot]}>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-slate-500 dark:text-slate-400">{t.crawler.pagesVisited}</dt>
              <dd className="text-right font-semibold text-slate-900 dark:text-white tabular-nums">
                {c.pagesVisited.toLocaleString(intlLocale)}
              </dd>
              <dt className="text-slate-500 dark:text-slate-400">{t.crawler.last7}</dt>
              <dd className="text-right tabular-nums text-slate-700 dark:text-slate-300">
                {c.visitedLast7Days.toLocaleString(intlLocale)}
              </dd>
              <dt className="text-slate-500 dark:text-slate-400">{t.crawler.last30}</dt>
              <dd className="text-right tabular-nums text-slate-700 dark:text-slate-300">
                {c.visitedLast30Days.toLocaleString(intlLocale)}
              </dd>
              <dt className="text-slate-500 dark:text-slate-400">{t.crawler.lastVisit}</dt>
              <dd className="text-right text-slate-700 dark:text-slate-300">{formatDate(c.lastVisit)}</dd>
            </dl>
          </Panel>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap items-center gap-3">
        <SegmentedControl<BotScope>
          value={scope}
          onChange={handleScope}
          options={[
            { value: "all", label: t.crawler.filterAll },
            { value: "ai", label: t.crawler.filterAi },
          ]}
        />
        {data && <span className="text-sm text-slate-600 dark:text-slate-400">{t.urls.count(data.total)}</span>}
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
