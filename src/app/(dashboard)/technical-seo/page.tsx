"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useProperty } from "@/contexts/PropertyContext";
import { useLocale, useMessages } from "@/i18n/I18nProvider";
import { technicalSeoMessages } from "@/i18n/messages/technical-seo";
import { propertyToDomain, type TechnicalSeoOverview, type UrlFilter } from "@/lib/technical-seo";
import { Spinner } from "@/components/technical-seo/shared";
import { OverviewTab } from "@/components/technical-seo/OverviewTab";
import { IssuesTab } from "@/components/technical-seo/IssuesTab";
import { UrlsTab } from "@/components/technical-seo/UrlsTab";
import { CrawlerTab } from "@/components/technical-seo/CrawlerTab";

type TabType = "overview" | "issues" | "urls" | "crawler";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "empty" }
  | { status: "ready"; overview: TechnicalSeoOverview };

export default function TechnicalSeoPage() {
  const t = useMessages(technicalSeoMessages);
  const { intlLocale } = useLocale();
  const { selectedProperty } = useProperty();
  const domain = selectedProperty ? propertyToDomain(selectedProperty) : null;

  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [urlFilter, setUrlFilter] = useState<UrlFilter>("all");
  const [result, setResult] = useState<{ domain: string; state: LoadState } | null>(null);
  const state: LoadState = result && result.domain === domain ? result.state : { status: "loading" };

  useEffect(() => {
    if (!domain) return;
    let cancelled = false;
    fetch(`/api/conductor-monitoring/overview?domain=${encodeURIComponent(domain)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((data: { overview: TechnicalSeoOverview | null }) => {
        if (cancelled) return;
        setResult({
          domain,
          state: data.overview ? { status: "ready", overview: data.overview } : { status: "empty" },
        });
      })
      .catch(() => {
        if (!cancelled) setResult({ domain, state: { status: "error" } });
      });
    return () => {
      cancelled = true;
    };
  }, [domain]);

  const openUrls = (filter: UrlFilter) => {
    setUrlFilter(filter);
    setActiveTab("urls");
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(intlLocale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const overview = state.status === "ready" ? state.overview : null;
  const openIssues = overview ? overview.issues.critical + overview.issues.fix + overview.issues.opportunity : 0;

  const tabs: { id: TabType; label: string; badge?: number }[] = [
    { id: "overview", label: t.tabs.overview },
    { id: "issues", label: t.tabs.issues, badge: openIssues },
    { id: "urls", label: t.tabs.urls },
    { id: "crawler", label: t.tabs.crawler },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.title}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {overview ? `${overview.website.name} · ${t.subtitle}` : t.subtitle}
          </p>
        </div>
        {overview && (
          <div className="text-xs text-slate-500 dark:text-slate-400 sm:text-right">
            {overview.capturedAt && <div>{t.dataAsOf(formatDate(overview.capturedAt))}</div>}
            {overview.website.lastSyncAt && <div>{t.lastSync(formatDate(overview.website.lastSyncAt))}</div>}
          </div>
        )}
      </div>

      {!domain ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">{t.selectProperty}</p>
      ) : state.status === "loading" ? (
        <Spinner label={t.loading} />
      ) : state.status === "error" ? (
        <p className="text-sm text-red-600 dark:text-red-400">{t.loadFailed}</p>
      ) : state.status === "empty" ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-2">{t.noData.title}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 max-w-xl mx-auto">{t.noData.text(domain)}</p>
          <Link
            href="/settings"
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {t.noData.toSettings}
          </Link>
        </div>
      ) : (
        <>
          <div className="border-b border-slate-200 dark:border-slate-700">
            <nav className="flex gap-6 -mb-px overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {tab.label}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {activeTab === "overview" && (
            <OverviewTab
              overview={state.overview}
              t={t}
              onOpenUrls={openUrls}
              onOpenIssues={() => setActiveTab("issues")}
            />
          )}
          {activeTab === "issues" && <IssuesTab domain={domain} t={t} />}
          {activeTab === "urls" && (
            <UrlsTab domain={domain} t={t} filter={urlFilter} onFilterChange={setUrlFilter} />
          )}
          {activeTab === "crawler" && <CrawlerTab domain={domain} crawlers={state.overview.crawlers} t={t} />}
        </>
      )}
    </div>
  );
}
