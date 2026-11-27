"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useMessages } from "@/i18n/I18nProvider";
import { seoHelperKeywordMappingMessages } from "@/i18n/messages/seo-helper-keyword-mapping";
import type { ProjectTopicGap, ProjectTopicGapsResponse } from "@/lib/keyword-map/shared";
import { BrandExclusionButton } from "./BrandExclusionButton";
import { Notice, Spinner, apiFetch, buttonSecondary, formatNumber, inputClass } from "./ui";

const PAGE_SIZE = 50;
const filterClass = inputClass.replace(/\bw-full\b/, "").trim();

type SortKey = "urls" | "topic";

function shortUrl(url: string) {
  return url.replace(/^https?:\/\/[^/]+/, "") || url;
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function csvCell(value: string) {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function TopicGapsTab({
  projectId,
  projectName,
  editable,
  onOpenUrl,
  onAnalysesChanged,
}: {
  projectId: string;
  projectName: string;
  editable: boolean;
  onOpenUrl: (urlId: string) => void;
  onAnalysesChanged?: () => void;
}) {
  const t = useMessages(seoHelperKeywordMappingMessages);
  const { intlLocale } = useLocale();
  const [data, setData] = useState<ProjectTopicGapsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [urlFilter, setUrlFilter] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("urls");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<ProjectTopicGapsResponse>(`/api/seo-helper/keyword-mapping/projects/${projectId}/topic-gaps`));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
    }
  }, [projectId, t.errorGeneric]);

  useEffect(() => {
    void load();
  }, [load]);

  const urlOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const g of data?.gaps ?? []) for (const o of g.occurrences) byId.set(o.urlId, o.url);
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (data?.gaps ?? []).filter((g) => {
      if (urlFilter && !g.occurrences.some((o) => o.urlId === urlFilter)) return false;
      if (onlyOpen && g.occurrences.some((o) => o.editorialArticleId)) return false;
      if (q) {
        const hay = [g.topic, ...g.occurrences.flatMap((o) => [o.url, o.focusKeyword, ...o.path])].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return sort === "topic" ? [...list].sort((a, b) => a.topic.localeCompare(b.topic)) : list;
  }, [data, search, urlFilter, onlyOpen, sort]);

  useEffect(() => setPage(0), [search, urlFilter, onlyOpen, sort]);

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const occurrenceCount = filtered.reduce((sum, g) => sum + g.occurrences.length, 0);

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const createArticle = async (gap: ProjectTopicGap) => {
    const target = gap.occurrences[0];
    setCreating((prev) => new Set(prev).add(gap.key));
    setError(null);
    try {
      const res = await apiFetch<{ article: { id: string } }>(`/api/seo-helper/keyword-mapping/urls/${target.urlId}/topic-gap/editorial`, {
        method: "POST",
        body: JSON.stringify({ gapId: target.gapId, index: target.index, plannedDate: today() }),
      });
      setData((prev) =>
        prev && {
          ...prev,
          gaps: prev.gaps.map((g) =>
            g.key === gap.key
              ? { ...g, occurrences: g.occurrences.map((o) => (o === target ? { ...o, editorialArticleId: res.article.id } : o)) }
              : g
          ),
        }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
    } finally {
      setCreating((prev) => {
        const next = new Set(prev);
        next.delete(gap.key);
        return next;
      });
    }
  };

  const exportCsv = () => {
    const header = [t.gapsTab.topic, t.gapsTab.path, t.gapsTab.urlCount, t.fields.url, t.fields.focusKeyword, t.gapsTab.reason, t.gapsTab.editorial];
    const lines = filtered.flatMap((g) =>
      g.occurrences.map((o) =>
        [g.topic, o.path.join(" > "), String(g.occurrences.length), o.url, o.focusKeyword, o.reason, o.editorialArticleId ? "x" : ""]
          .map(csvCell)
          .join(";")
      )
    );
    const blob = new Blob([`\uFEFF${[header.join(";"), ...lines].join("\n")}`], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `topic-gaps-${projectName.replace(/[^\w-]+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(href);
  };

  if (!data) {
    return error ? (
      <Notice kind="error">{error}</Notice>
    ) : (
      <div className="flex items-center gap-2 text-slate-500">
        <Spinner /> {t.loading}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Notice kind="info">
        {t.gapsTab.intro}
        <span className="block mt-1 text-xs opacity-80">{t.gapsTab.analyzed(data.stats.analyzed, data.stats.urls)}</span>
      </Notice>
      {data.stats.unchecked > 0 && <Notice kind="warning">{t.gapsTab.unchecked(data.stats.unchecked)}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      {notice && <Notice kind="success">{notice}</Notice>}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${filterClass} flex-1 min-w-[12rem]`}
            placeholder={t.gapsTab.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className={`${filterClass} max-w-[20rem]`} value={urlFilter} onChange={(e) => setUrlFilter(e.target.value)}>
            <option value="">
              {t.fields.url}: {t.table.filterAll}
            </option>
            {urlOptions.map(([id, url]) => (
              <option key={id} value={id}>
                {shortUrl(url)}
              </option>
            ))}
          </select>
          <select className={`${filterClass} max-w-[13rem]`} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="urls">{t.gapsTab.sortUrls}</option>
            <option value="topic">{t.gapsTab.sortTopic}</option>
          </select>
          <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 px-1 whitespace-nowrap">
            <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
            {t.gapsTab.onlyWithoutArticle}
          </label>
          <button className={buttonSecondary} disabled={filtered.length === 0} onClick={exportCsv}>
            {t.gapsTab.exportCsv}
          </button>
          <BrandExclusionButton
            editable={editable}
            onSaved={(text) => {
              setNotice(text);
              void load();
              onAnalysesChanged?.();
            }}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500 dark:text-slate-400">
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="px-3 py-2 text-left font-medium">{t.gapsTab.topic}</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">{t.gapsTab.urlCount}</th>
                <th className="px-3 py-2 text-left font-medium">{t.gapsTab.foundAt}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    {data.gaps.length === 0 ? t.gapsTab.emptyAll : t.gapsTab.empty}
                  </td>
                </tr>
              )}
              {pageRows.map((g) => {
                const isOpen = expanded.has(g.key);
                const path = g.occurrences[0].path;
                const article = g.occurrences.find((o) => o.editorialArticleId);
                return (
                  <Fragment key={g.key}>
                    <tr className="align-top hover:bg-slate-50 dark:hover:bg-slate-700/40">
                      <td className="px-3 py-2 min-w-[16rem]">
                        <button className="text-left" onClick={() => toggle(g.key)}>
                          <span className="text-slate-400 mr-1">{isOpen ? "▾" : "▸"}</span>
                          <span className="font-medium text-slate-900 dark:text-white">{g.topic}</span>
                        </button>
                        {path.length > 0 && <div className="ml-4 text-xs text-slate-400">{path.join(" › ")}</div>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300">{g.occurrences.length}</td>
                      <td className="px-3 py-2 max-w-[28rem]">
                        <div className="flex flex-wrap gap-1">
                          {g.occurrences.map((o) => (
                            <button
                              key={`${o.gapId}-${o.index}`}
                              onClick={() => onOpenUrl(o.urlId)}
                              title={`${o.url}\n${t.fields.focusKeyword}: ${o.focusKeyword}`}
                              className="max-w-[16rem] truncate px-1.5 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-teal-700 dark:text-teal-300 hover:underline"
                            >
                              {shortUrl(o.url)}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {article ? (
                          <a href="/redaktionsplan" target="_blank" rel="noreferrer" className="text-xs text-teal-600 hover:underline whitespace-nowrap">
                            ✓ {t.drawer.gapInEditorialPlan} ↗
                          </a>
                        ) : (
                          editable && (
                            <button
                              className="px-2 py-0.5 rounded text-xs border whitespace-nowrap inline-flex items-center gap-1 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                              disabled={creating.has(g.key)}
                              title={t.drawer.gapNewArticleHint}
                              onClick={() => void createArticle(g)}
                            >
                              {creating.has(g.key) && <Spinner />}
                              {t.drawer.gapNewArticle}
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-slate-50/60 dark:bg-slate-900/30">
                        <td colSpan={4} className="px-3 py-2 pl-8">
                          <ul className="space-y-1.5">
                            {g.occurrences.map((o) => (
                              <li key={`${o.gapId}-${o.index}`} className="text-xs text-slate-600 dark:text-slate-300">
                                <button onClick={() => onOpenUrl(o.urlId)} className="font-medium text-teal-700 dark:text-teal-400 hover:underline">
                                  {shortUrl(o.url)}
                                </button>
                                <span className="text-slate-400"> · {o.focusKeyword}</span>
                                {o.reason && <div className="mt-0.5">{o.reason}</div>}
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-500">
          <span>{t.gapsTab.results(formatNumber(filtered.length, intlLocale), formatNumber(occurrenceCount, intlLocale))}</span>
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center gap-2">
              <button className={buttonSecondary} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                ‹
              </button>
              <span>
                {page + 1} / {Math.ceil(filtered.length / PAGE_SIZE)}
              </span>
              <button className={buttonSecondary} disabled={(page + 1) * PAGE_SIZE >= filtered.length} onClick={() => setPage((p) => p + 1)}>
                ›
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
