"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canEdit } from "@/lib/rbac";
import { KVP_CATEGORIES } from "@/lib/kvp-categories";
import { useLocale, useMessages } from "@/i18n/I18nProvider";
import { seoHelperKeywordMappingMessages } from "@/i18n/messages/seo-helper-keyword-mapping";
import {
  DROPDOWN_KEYS,
  type DropdownKey,
  type DropdownOptions,
  type MapUrlDto,
  computeKpis,
  computeScore,
  effectiveRank,
  totalSearchVolume,
} from "@/lib/keyword-map/shared";
import { EditableCell } from "@/components/keyword-mapping/EditableCell";
import { ImportDialog } from "@/components/keyword-mapping/ImportDialog";
import { UrlDrawer } from "@/components/keyword-mapping/UrlDrawer";
import {
  Modal,
  Notice,
  PageHeader,
  Spinner,
  apiFetch,
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  formatNumber,
  inputClass,
} from "@/components/keyword-mapping/ui";

interface ProjectInfo {
  id: string;
  name: string;
  category: string | null;
  countryCode: string;
  languageCode: string;
  dropdownOptions: DropdownOptions;
}

type ColumnGroup = "basics" | "topic" | "linking" | "performance" | "analysis";
type SortKey = "url" | "focusSv" | "totalSv" | "rank" | "gscClicks" | "score" | "coverage";
type FocusFilter = "all" | "none" | "has";
type KvpFilter = "all" | "in" | "out";

const PAGE_SIZE = 50;
const DFS_BATCH = 20;
const KVP_BATCH = 50;
const GROUPS_STORAGE_KEY = "keyword-mapping-visible-groups";
const DEFAULT_GROUPS: ColumnGroup[] = ["basics", "topic", "performance", "analysis"];

function shortUrl(url: string) {
  return url.replace(/^https?:\/\/[^/]+/, "") || url;
}

export default function KeywordMappingProjectPage() {
  const t = useMessages(seoHelperKeywordMappingMessages);
  const { intlLocale } = useLocale();
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const editable = canEdit(session?.user?.role);

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [rawUrls, setRawUrls] = useState<MapUrlDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const [search, setSearch] = useState("");
  const [focusFilter, setFocusFilter] = useState<FocusFilter>("all");
  const [kvpFilter, setKvpFilter] = useState<KvpFilter>("all");
  const [rankOver10, setRankOver10] = useState(false);
  const [topicAuthorityFilter, setTopicAuthorityFilter] = useState("");
  const [pageTypeFilter, setPageTypeFilter] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "url", dir: "asc" });
  const [page, setPage] = useState(0);
  const [visibleGroups, setVisibleGroups] = useState<ColumnGroup[]>(DEFAULT_GROUPS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showAddUrls, setShowAddUrls] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showKvpDialog, setShowKvpDialog] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(GROUPS_STORAGE_KEY) ?? "null");
      if (Array.isArray(stored)) setVisibleGroups(stored);
    } catch {
      // Ungültiger Wert im localStorage
    }
  }, []);

  const toggleGroup = (g: ColumnGroup) => {
    setVisibleGroups((prev) => {
      const next = prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g];
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ project: ProjectInfo; urls: MapUrlDto[] }>(
        `/api/seo-helper/keyword-mapping/projects/${projectId}`
      );
      setProject(res.project);
      setRawUrls(res.urls);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
    } finally {
      setLoading(false);
    }
  }, [projectId, t.errorGeneric]);

  useEffect(() => {
    void load();
  }, [load]);

  // Score hängt vom Suchvolumen-Maximum des ganzen Projekts ab und wird daher hier neu berechnet
  const urls = useMemo(() => {
    const max = rawUrls.reduce((m, u) => Math.max(m, totalSearchVolume(u)), 0);
    return rawUrls.map((u) => ({ ...u, score: computeScore(totalSearchVolume(u), effectiveRank(u), max) }));
  }, [rawUrls]);

  const mergeUrls = useCallback((updated: MapUrlDto[]) => {
    const byId = new Map(updated.map((u) => [u.id, u]));
    setRawUrls((prev) => prev.map((u) => byId.get(u.id) ?? u));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = urls.filter((u) => {
      if (q) {
        const hay = [u.url, u.h1, u.focusKeyword?.keyword, u.dfsTopKeyword, ...u.subKeywords.map((k) => k.keyword)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (focusFilter === "none" && u.focusKeyword) return false;
      if (focusFilter === "has" && !u.focusKeyword) return false;
      if (kvpFilter === "in" && !u.kvpUrlId) return false;
      if (kvpFilter === "out" && u.kvpUrlId) return false;
      if (rankOver10) {
        const r = effectiveRank(u);
        if (r === null || r <= 10) return false;
      }
      if (topicAuthorityFilter && u.topicAuthority !== topicAuthorityFilter) return false;
      if (pageTypeFilter && u.pageType !== pageTypeFilter) return false;
      return true;
    });
    const value = (u: MapUrlDto): number | string | null => {
      switch (sort.key) {
        case "url":
          return u.url;
        case "focusSv":
          return u.focusKeyword?.searchVolume ?? null;
        case "totalSv":
          return totalSearchVolume(u);
        case "rank":
          return effectiveRank(u);
        case "gscClicks":
          return u.gscClicks;
        case "score":
          return u.score;
        case "coverage":
          return u.latestTopicGap?.coverageScore ?? null;
      }
    };
    return [...list].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      const cmp = typeof va === "string" ? va.localeCompare(String(vb)) : va - (vb as number);
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [urls, search, focusFilter, kvpFilter, rankOver10, topicAuthorityFilter, pageTypeFilter, sort]);

  useEffect(() => setPage(0), [search, focusFilter, kvpFilter, rankOver10, topicAuthorityFilter, pageTypeFilter, sort]);

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const kpis = useMemo(() => computeKpis(filtered), [filtered]);
  const options = project?.dropdownOptions ?? {};
  const optionValues = (key: DropdownKey) => {
    const set = new Set(options[key] ?? []);
    for (const u of rawUrls) if (u[key]) set.add(u[key]!);
    return [...set];
  };

  const patchUrl = async (id: string, data: Record<string, unknown>) => {
    try {
      const res = await apiFetch<{ url: MapUrlDto }>(`/api/seo-helper/keyword-mapping/urls/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      mergeUrls([res.url]);
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : t.errorGeneric });
      throw e;
    }
  };

  const setFocus = async (id: string, keyword: string | null, searchVolume: number | null = null, source = "manual") => {
    try {
      const res = await apiFetch<{ url: MapUrlDto }>(`/api/seo-helper/keyword-mapping/urls/${id}/keywords`, {
        method: "PUT",
        body: JSON.stringify({ keyword, searchVolume, source }),
      });
      mergeUrls([res.url]);
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : t.errorGeneric });
      throw e;
    }
  };

  const selectedIds = [...selected].filter((id) => rawUrls.some((u) => u.id === id));
  const allFilteredSelected = filtered.length > 0 && filtered.every((u) => selected.has(u.id));

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function runInBatches<T>(ids: string[], size: number, fn: (batch: string[]) => Promise<T>): Promise<T[]> {
    const results: T[] = [];
    setProgress({ done: 0, total: ids.length });
    try {
      for (let i = 0; i < ids.length; i += size) {
        results.push(await fn(ids.slice(i, i + size)));
        setProgress({ done: Math.min(i + size, ids.length), total: ids.length });
      }
    } finally {
      setProgress(null);
    }
    return results;
  }

  const bulkDfs = async (opts: { force?: boolean; fetch?: boolean; applyAsFocus?: "never" | "ifEmpty" | "always" }) => {
    setMessage(null);
    try {
      const results = await runInBatches(selectedIds, DFS_BATCH, async (batch) => {
        const res = await apiFetch<{ results: Record<string, { error?: string }>; urls: MapUrlDto[] }>(
          "/api/seo-helper/keyword-mapping/urls/ranked-keywords",
          { method: "POST", body: JSON.stringify({ ids: batch, ...opts }) }
        );
        mergeUrls(res.urls);
        return res.results;
      });
      const merged = Object.assign({}, ...results) as Record<string, { error?: string }>;
      const errors = Object.values(merged).filter((r) => r.error).length;
      setMessage({
        kind: "success",
        text: opts.fetch === false ? t.bulk.applyDone(Object.keys(merged).length) : t.bulk.dfsDone(Object.keys(merged).length, errors),
      });
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : t.errorGeneric });
    }
  };

  const bulkKvp = async (includeGapComment: boolean) => {
    setShowKvpDialog(false);
    setMessage(null);
    try {
      const results = await runInBatches(selectedIds, KVP_BATCH, async (batch) => {
        const res = await apiFetch<{ results: Record<string, { status: string }>; urls: MapUrlDto[] }>(
          "/api/seo-helper/keyword-mapping/urls/kvp-push",
          { method: "POST", body: JSON.stringify({ ids: batch, includeGapComment }) }
        );
        mergeUrls(res.urls);
        return res.results;
      });
      const all = results.flatMap((r) => Object.values(r));
      setMessage({
        kind: "success",
        text: t.bulk.kvpDone(
          all.filter((r) => r.status === "created").length,
          all.filter((r) => r.status === "updated").length,
          all.filter((r) => r.status === "skipped").length
        ),
      });
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : t.errorGeneric });
    }
  };

  const bulkDelete = async () => {
    if (!confirm(t.bulk.deleteConfirm(selectedIds.length))) return;
    try {
      await apiFetch("/api/seo-helper/keyword-mapping/urls", { method: "DELETE", body: JSON.stringify({ ids: selectedIds }) });
      setRawUrls((prev) => prev.filter((u) => !selected.has(u.id)));
      setSelected(new Set());
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : t.errorGeneric });
    }
  };

  const exportExcel = async (ids?: string[]) => {
    const qs = ids?.length ? `?ids=${ids.join(",")}` : "";
    const res = await fetch(`/api/seo-helper/keyword-mapping/projects/${projectId}/export${qs}`);
    if (!res.ok) {
      setMessage({ kind: "error", text: t.errorGeneric });
      return;
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const name = decodeURIComponent(disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1] ?? "keyword-mapping.xlsx");
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
    URL.revokeObjectURL(href);
  };

  const sortHeader = (key: SortKey, label: string, className = "") => (
    <button
      type="button"
      className={`inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white ${className}`}
      onClick={() => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "url" ? "asc" : "desc" }))}
    >
      {label}
      {sort.key === key && <span>{sort.dir === "asc" ? "▲" : "▼"}</span>}
    </button>
  );

  const show = (g: ColumnGroup) => visibleGroups.includes(g);
  const drawerUrl = drawerId ? urls.find((u) => u.id === drawerId) ?? null : null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Spinner /> {t.loading}
      </div>
    );
  }
  if (!project) {
    return <Notice kind="error">{error ?? t.errorGeneric}</Notice>;
  }

  const groupHeaderCells: Array<{ group: ColumnGroup; span: number }> = (
    [
      { group: "basics", span: 5 },
      { group: "topic", span: 5 },
      { group: "linking", span: 2 },
      { group: "performance", span: 6 },
      { group: "analysis", span: 3 },
    ] as const
  ).filter((g) => show(g.group));

  return (
    <div className="space-y-4">
      <PageHeader
        title={project.name}
        subtitle={`${t.title}${project.category ? ` · ${project.category}` : ""} · ${project.countryCode.toUpperCase()}/${project.languageCode}`}
        backHref="/seo-helper/keyword-mapping"
        actions={
          <>
            {editable && (
              <>
                <button className={buttonSecondary} onClick={() => setShowAddUrls(true)}>
                  {t.table.addUrls}
                </button>
                <button className={buttonSecondary} onClick={() => setShowImport(true)}>
                  {t.table.import}
                </button>
              </>
            )}
            <button className={buttonSecondary} onClick={() => void exportExcel()}>
              {t.table.export}
            </button>
            {editable && (
              <button className={buttonSecondary} onClick={() => setShowSettings(true)} title={t.table.settings}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
          </>
        }
      />

      {!editable && <Notice kind="info">{t.readOnlyHint}</Notice>}
      {message && (
        <Notice kind={message.kind}>
          <div className="flex items-center justify-between gap-2">
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100">
              ✕
            </button>
          </div>
        </Notice>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 xl:grid-cols-10 gap-2">
        <Kpi label={t.kpis.urls} value={formatNumber(kpis.urls, intlLocale)} />
        <Kpi label={t.kpis.focusSv} value={formatNumber(kpis.focusSv, intlLocale)} />
        <Kpi label={t.kpis.subSv} value={formatNumber(kpis.subSv, intlLocale)} />
        <Kpi label={t.kpis.gscClicks} value={formatNumber(kpis.gscClicks, intlLocale)} />
        <Kpi label={t.kpis.avgRank} value={kpis.avgRank !== null ? kpis.avgRank.toFixed(1) : "–"} />
        <Kpi label={t.kpis.top10} value={kpis.top10Share !== null ? `${Math.round(kpis.top10Share * 100)} %` : "–"} />
        <Kpi label={t.kpis.focusFilled} value={pct(kpis.focusFilled, kpis.urls)} />
        <Kpi label={t.kpis.topicAuthorityFilled} value={pct(kpis.topicAuthorityFilled, kpis.urls)} />
        <Kpi label={t.kpis.ctaFilled} value={pct(kpis.ctaFilled, kpis.urls)} />
        <Kpi label={t.kpis.inKvp} value={formatNumber(kpis.inKvp, intlLocale)} />
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder={t.table.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={`${inputClass} w-auto`} value={focusFilter} onChange={(e) => setFocusFilter(e.target.value as FocusFilter)}>
          <option value="all">{t.fields.focusKeyword}: {t.table.filterAll}</option>
          <option value="none">{t.table.filterNoFocus}</option>
          <option value="has">{t.table.filterHasFocus}</option>
        </select>
        <select className={`${inputClass} w-auto`} value={kvpFilter} onChange={(e) => setKvpFilter(e.target.value as KvpFilter)}>
          <option value="all">{t.fields.kvp}: {t.table.filterAll}</option>
          <option value="in">{t.table.filterInKvp}</option>
          <option value="out">{t.table.filterNotInKvp}</option>
        </select>
        <select className={`${inputClass} w-auto max-w-[14rem]`} value={topicAuthorityFilter} onChange={(e) => setTopicAuthorityFilter(e.target.value)}>
          <option value="">{t.table.filterTopicAuthority}: {t.table.filterAll}</option>
          {optionValues("topicAuthority").map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select className={`${inputClass} w-auto max-w-[14rem]`} value={pageTypeFilter} onChange={(e) => setPageTypeFilter(e.target.value)}>
          <option value="">{t.table.filterPageType}: {t.table.filterAll}</option>
          {optionValues("pageType").map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 px-2">
          <input type="checkbox" checked={rankOver10} onChange={(e) => setRankOver10(e.target.checked)} />
          {t.table.filterRankOver10}
        </label>
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="text-slate-400 mr-1">{t.table.columns}:</span>
          {(["basics", "topic", "linking", "performance", "analysis"] as ColumnGroup[]).map((g) => (
            <button
              key={g}
              onClick={() => toggleGroup(g)}
              className={`px-2 py-1 rounded-md border ${
                show(g)
                  ? "bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-700 text-teal-700 dark:text-teal-300"
                  : "border-slate-200 dark:border-slate-600 text-slate-400"
              }`}
            >
              {t.groups[g]}
            </button>
          ))}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-xl p-3">
          <span className="text-sm font-medium text-teal-800 dark:text-teal-200">{t.table.selected(selectedIds.length)}</span>
          {progress ? (
            <span className="flex items-center gap-2 text-sm text-teal-700 dark:text-teal-300">
              <Spinner /> {t.bulk.running(progress.done, progress.total)}
            </span>
          ) : (
            <>
              {editable && (
                <>
                  <button className={buttonSecondary} onClick={() => void bulkDfs({ applyAsFocus: "never" })}>
                    {t.bulk.fetchDfs}
                  </button>
                  <BulkMenu
                    label="…"
                    items={[
                      { label: t.bulk.fetchDfsForce, onClick: () => void bulkDfs({ force: true }) },
                      { label: t.bulk.applyTop, onClick: () => void bulkDfs({ fetch: false, applyAsFocus: "ifEmpty" }) },
                      { label: t.bulk.applyTopAll, onClick: () => void bulkDfs({ fetch: false, applyAsFocus: "always" }) },
                    ]}
                  />
                  <button className={buttonPrimary} onClick={() => setShowKvpDialog(true)}>
                    {t.bulk.pushKvp}
                  </button>
                </>
              )}
              <button className={buttonSecondary} onClick={() => void exportExcel(selectedIds)}>
                {t.table.exportSelected}
              </button>
              {editable && (
                <button className={buttonDanger} onClick={() => void bulkDelete()}>
                  {t.bulk.deleteUrls}
                </button>
              )}
              <button className="text-xs text-slate-500 hover:underline ml-auto" onClick={() => setSelected(new Set())}>
                ✕
              </button>
            </>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500 dark:text-slate-400">
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th colSpan={2} className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-900" />
                {groupHeaderCells.map((g) => (
                  <th key={g.group} colSpan={g.span} className="px-3 py-1.5 text-left font-semibold uppercase tracking-wide border-l border-slate-200 dark:border-slate-700">
                    {t.groups[g.group]}
                  </th>
                ))}
                <th />
              </tr>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-900 px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    title={t.table.selectAll}
                    checked={allFilteredSelected}
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        const ids = filtered.map((u) => u.id);
                        if (allFilteredSelected) ids.forEach((id) => next.delete(id));
                        else ids.forEach((id) => next.add(id));
                        return next;
                      })
                    }
                  />
                </th>
                <th className="sticky left-8 z-10 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-left min-w-[18rem]">{sortHeader("url", t.fields.url)}</th>
                {show("basics") && (
                  <>
                    <Th first>{t.fields.h1}</Th>
                    <Th>{t.fields.navigationType}</Th>
                    <Th>{t.fields.pageType}</Th>
                    <Th>{t.fields.funnel}</Th>
                    <Th>{t.fields.targetGroup}</Th>
                  </>
                )}
                {show("topic") && (
                  <>
                    <Th first>{t.fields.topicAuthority}</Th>
                    <Th>{t.fields.focusKeyword}</Th>
                    <Th right>{sortHeader("focusSv", t.fields.focusSearchVolume)}</Th>
                    <Th>{t.fields.subKeywords}</Th>
                    <Th right>{t.fields.subSearchVolume}</Th>
                  </>
                )}
                {show("linking") && (
                  <>
                    <Th first>{t.fields.ctas}</Th>
                    <Th right>{t.fields.furtherLinks}</Th>
                  </>
                )}
                {show("performance") && (
                  <>
                    <Th first>{t.fields.dfsTopKeyword}</Th>
                    <Th right>{t.fields.dfsSearchVolume}</Th>
                    <Th right>{sortHeader("rank", t.fields.dfsRank)}</Th>
                    <Th right>{t.fields.manualRank}</Th>
                    <Th right>{sortHeader("gscClicks", t.fields.gscClicks)}</Th>
                    <Th right>
                      <span title={t.table.scoreHint}>{sortHeader("score", t.fields.score)}</span>
                    </Th>
                  </>
                )}
                {show("analysis") && (
                  <>
                    <Th first>{sortHeader("coverage", t.fields.topicGap)}</Th>
                    <Th>{t.fields.kvp}</Th>
                    <Th>{t.fields.comment}</Th>
                  </>
                )}
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={30} className="px-4 py-10 text-center text-slate-500">
                    {t.table.empty}
                  </td>
                </tr>
              )}
              {pageRows.map((u) => {
                const isSelected = selected.has(u.id);
                const rowBg = isSelected ? "bg-teal-50/60 dark:bg-teal-900/20" : "bg-white dark:bg-slate-800";
                return (
                  <tr key={u.id} className={`${rowBg} hover:bg-slate-50 dark:hover:bg-slate-700/40 align-top`}>
                    <td className={`sticky left-0 z-10 px-3 py-2 ${rowBg}`}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(u.id)} />
                    </td>
                    <td className={`sticky left-8 z-10 px-3 py-2 max-w-[22rem] ${rowBg}`}>
                      <button onClick={() => setDrawerId(u.id)} className="block text-left text-teal-700 dark:text-teal-400 hover:underline truncate max-w-full" title={u.url}>
                        {shortUrl(u.url)}
                      </button>
                      <div className="flex gap-1 mt-0.5">
                        {u.noindex && <Tag tone="amber">noindex</Tag>}
                        {u.statusCode && u.statusCode !== 200 && <Tag tone="red">{u.statusCode}</Tag>}
                      </div>
                    </td>
                    {show("basics") && (
                      <>
                        <Td first className="min-w-[14rem] max-w-[18rem]">
                          <EditableCell editable={editable} value={u.h1} onSave={(v) => patchUrl(u.id, { h1: v })} />
                        </Td>
                        <Td className="min-w-[7rem]">
                          <EditableCell editable={editable} value={u.navigationType} options={["Guide", "Help", "Navigation"]} onSave={(v) => patchUrl(u.id, { navigationType: v })} />
                        </Td>
                        {(["pageType", "funnel", "targetGroup"] as const).map((key) => (
                          <Td key={key} className="min-w-[10rem] max-w-[14rem]">
                            <EditableCell editable={editable} value={u[key]} options={optionValues(key)} onSave={(v) => patchUrl(u.id, { [key]: v })} />
                          </Td>
                        ))}
                      </>
                    )}
                    {show("topic") && (
                      <>
                        <Td first className="min-w-[10rem] max-w-[14rem]">
                          <EditableCell editable={editable} value={u.topicAuthority} options={optionValues("topicAuthority")} onSave={(v) => patchUrl(u.id, { topicAuthority: v })} />
                        </Td>
                        <Td className="min-w-[12rem]">
                          <EditableCell
                            editable={editable}
                            value={u.focusKeyword?.keyword ?? null}
                            className="font-medium text-slate-900 dark:text-white"
                            onSave={(v) => setFocus(u.id, v)}
                          />
                        </Td>
                        <Td right>{formatNumber(u.focusKeyword?.searchVolume, intlLocale)}</Td>
                        <Td className="min-w-[12rem] max-w-[18rem]">
                          <button onClick={() => setDrawerId(u.id)} className="text-left w-full" title={u.subKeywords.map((k) => k.keyword).join(", ")}>
                            {u.subKeywords.length ? (
                              <span className="line-clamp-2 text-slate-600 dark:text-slate-300">{u.subKeywords.map((k) => k.keyword).join(", ")}</span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">–</span>
                            )}
                          </button>
                        </Td>
                        <Td right>{formatNumber(u.subSearchVolume, intlLocale)}</Td>
                      </>
                    )}
                    {show("linking") && (
                      <>
                        <Td first className="min-w-[12rem] max-w-[16rem]">
                          {u.ctas.length ? (
                            <span className="line-clamp-2 text-slate-600 dark:text-slate-300" title={u.ctas.map((c) => c.label).join("\n")}>
                              {u.ctas.map((c) => c.label || c.link).join(" · ")}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">–</span>
                          )}
                        </Td>
                        <Td right>{u.furtherLinks.length || "–"}</Td>
                      </>
                    )}
                    {show("performance") && (
                      <>
                        <Td first className="min-w-[12rem]">
                          {u.dfsTopKeyword ? (
                            <div className="flex items-start gap-1">
                              <span className="flex-1">{u.dfsTopKeyword}</span>
                              {editable && u.dfsTopKeyword !== u.focusKeyword?.keyword && (
                                <button
                                  title={t.drawer.asFocus}
                                  onClick={() => void setFocus(u.id, u.dfsTopKeyword, u.dfsSearchVolume, "dataforseo")}
                                  className="shrink-0 px-1.5 rounded text-xs text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100"
                                >
                                  → {t.drawer.isFocus}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">{u.dfsFetchedAt ? "∅" : "–"}</span>
                          )}
                        </Td>
                        <Td right>{formatNumber(u.dfsSearchVolume, intlLocale)}</Td>
                        <Td right>{u.dfsRank ?? "–"}</Td>
                        <Td right className="min-w-[5rem]">
                          <EditableCell editable={editable} value={u.manualRank} className="text-right" onSave={(v) => patchUrl(u.id, { manualRank: v })} />
                        </Td>
                        <Td right className="min-w-[5rem]">
                          <EditableCell
                            editable={editable}
                            value={u.gscClicks !== null ? String(u.gscClicks) : null}
                            className="text-right"
                            onSave={(v) => patchUrl(u.id, { gscClicks: v })}
                          />
                        </Td>
                        <Td right>
                          <ScoreBadge score={u.score} />
                        </Td>
                      </>
                    )}
                    {show("analysis") && (
                      <>
                        <Td first>
                          <CoverageBadge gap={u.latestTopicGap} onClick={() => setDrawerId(u.id)} />
                        </Td>
                        <Td>{u.kvpUrlId ? <Tag tone="teal">{t.table.inKvpBadge}</Tag> : <span className="text-slate-300 dark:text-slate-600">–</span>}</Td>
                        <Td className="min-w-[12rem] max-w-[18rem]">
                          <EditableCell editable={editable} value={u.comment} multiline onSave={(v) => patchUrl(u.id, { comment: v })} />
                        </Td>
                      </>
                    )}
                    <td className="px-3 py-2">
                      <button onClick={() => setDrawerId(u.id)} className="text-xs text-slate-500 hover:text-teal-600 whitespace-nowrap">
                        {t.table.details} →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 text-sm text-slate-500">
          <span>{t.table.results(filtered.length, urls.length)}</span>
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

      {drawerUrl && (
        <UrlDrawer
          url={drawerUrl}
          project={project}
          editable={editable}
          dropdownOptions={Object.fromEntries(DROPDOWN_KEYS.map((k) => [k, optionValues(k)]))}
          onUpdated={(u) => mergeUrls([u])}
          onClose={() => setDrawerId(null)}
        />
      )}

      {showImport && (
        <ImportDialog
          projectId={project.id}
          onClose={() => setShowImport(false)}
          onImported={(text) => {
            setShowImport(false);
            setMessage({ kind: "success", text });
            void load();
          }}
        />
      )}

      {showAddUrls && (
        <AddUrlsDialog
          projectId={project.id}
          onClose={() => setShowAddUrls(false)}
          onAdded={(text) => {
            setShowAddUrls(false);
            setMessage({ kind: "success", text });
            void load();
          }}
        />
      )}

      {showSettings && (
        <SettingsDialog
          project={project}
          onClose={() => setShowSettings(false)}
          onSaved={() => {
            setShowSettings(false);
            void load();
          }}
          onDeleted={() => router.push("/seo-helper/keyword-mapping")}
        />
      )}

      {showKvpDialog && (
        <KvpDialog
          count={selectedIds.length}
          withoutFocus={selectedIds.filter((id) => !rawUrls.find((u) => u.id === id)?.focusKeyword).length}
          onClose={() => setShowKvpDialog(false)}
          onSubmit={(includeGap) => void bulkKvp(includeGap)}
        />
      )}
    </div>
  );
}

function pct(n: number, total: number) {
  return total ? `${Math.round((n / total) * 100)} %` : "–";
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2">
      <div className="text-lg font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="text-xs text-slate-500 truncate">{label}</div>
    </div>
  );
}

function Th({ children, first, right }: { children: ReactNode; first?: boolean; right?: boolean }) {
  return (
    <th
      className={`px-3 py-2 font-medium whitespace-nowrap ${right ? "text-right" : "text-left"} ${
        first ? "border-l border-slate-200 dark:border-slate-700" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, first, right, className = "" }: { children: ReactNode; first?: boolean; right?: boolean; className?: string }) {
  return (
    <td
      className={`px-3 py-2 text-slate-700 dark:text-slate-300 ${right ? "text-right tabular-nums" : ""} ${
        first ? "border-l border-slate-100 dark:border-slate-700/60" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

function Tag({ children, tone }: { children: ReactNode; tone: "teal" | "amber" | "red" }) {
  const tones = {
    teal: "bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300",
    amber: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
    red: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  };
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-slate-300 dark:text-slate-600">–</span>;
  const tone = score >= 7 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" : score >= 4 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
  return <span className={`inline-block min-w-[2.5rem] text-center px-1.5 py-0.5 rounded font-semibold ${tone}`}>{score.toFixed(1)}</span>;
}

function CoverageBadge({ gap, onClick }: { gap: MapUrlDto["latestTopicGap"]; onClick: () => void }) {
  const t = useMessages(seoHelperKeywordMappingMessages);
  if (!gap) return <span className="text-slate-300 dark:text-slate-600">–</span>;
  if (gap.status !== "succeeded") {
    return (
      <button onClick={onClick} className="inline-flex items-center gap-1 text-xs text-slate-500">
        {gap.status === "failed" ? "⚠" : <Spinner className="w-3 h-3" />}
      </button>
    );
  }
  const score = gap.coverageScore ?? 0;
  const tone = score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <button onClick={onClick} className="flex items-center gap-2 min-w-[6rem]" title={`${t.drawer.missing}: ${gap.missingCount} · ${t.drawer.partial}: ${gap.partialCount}`}>
      <span className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
        <span className={`block h-full ${tone}`} style={{ width: `${score}%` }} />
      </span>
      <span className="text-xs tabular-nums">{score} %</span>
    </button>
  );
}

function BulkMenu({ label, items }: { label: string; items: Array<{ label: string; onClick: () => void }> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className={buttonSecondary} onClick={() => setOpen((o) => !o)} onBlur={() => setTimeout(() => setOpen(false), 150)}>
        {label}
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-72 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-1">
          {items.map((item) => (
            <button
              key={item.label}
              className="block w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddUrlsDialog({ projectId, onClose, onAdded }: { projectId: string; onClose: () => void; onAdded: (text: string) => void }) {
  const t = useMessages(seoHelperKeywordMappingMessages);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ created: number; skipped: number }>("/api/seo-helper/keyword-mapping/urls", {
        method: "POST",
        body: JSON.stringify({ projectId, urls: text.split(/\s*\n\s*/).filter(Boolean) }),
      });
      onAdded(t.table.addUrlsDone(res.created, res.skipped));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t.table.addUrls}
      onClose={onClose}
      footer={
        <>
          <button className={buttonSecondary} onClick={onClose}>
            {t.cancel}
          </button>
          <button className={buttonPrimary} disabled={!text.trim() || busy} onClick={submit}>
            {busy && <Spinner />}
            {t.table.addUrls}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <textarea
          className={`${inputClass} font-mono`}
          rows={10}
          autoFocus
          value={text}
          placeholder={t.table.addUrlsPlaceholder}
          onChange={(e) => setText(e.target.value)}
        />
        {error && <Notice kind="error">{error}</Notice>}
      </div>
    </Modal>
  );
}

function KvpDialog({
  count,
  withoutFocus,
  onClose,
  onSubmit,
}: {
  count: number;
  withoutFocus: number;
  onClose: () => void;
  onSubmit: (includeGap: boolean) => void;
}) {
  const t = useMessages(seoHelperKeywordMappingMessages);
  const [includeGap, setIncludeGap] = useState(true);
  return (
    <Modal
      title={t.bulk.kvpDialogTitle}
      onClose={onClose}
      footer={
        <>
          <button className={buttonSecondary} onClick={onClose}>
            {t.cancel}
          </button>
          <button className={buttonPrimary} disabled={count === withoutFocus} onClick={() => onSubmit(includeGap)}>
            {t.bulk.kvpSubmit}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
        <p>{t.bulk.kvpDialogText(count, withoutFocus)}</p>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={includeGap} onChange={(e) => setIncludeGap(e.target.checked)} />
          {t.bulk.kvpIncludeGap}
        </label>
      </div>
    </Modal>
  );
}

function SettingsDialog({
  project,
  onClose,
  onSaved,
  onDeleted,
}: {
  project: ProjectInfo;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const t = useMessages(seoHelperKeywordMappingMessages);
  const [name, setName] = useState(project.name);
  const [category, setCategory] = useState(project.category ?? "");
  const [countryCode, setCountryCode] = useState(project.countryCode);
  const [languageCode, setLanguageCode] = useState(project.languageCode);
  const [dropdowns, setDropdowns] = useState<Record<DropdownKey, string>>(
    Object.fromEntries(DROPDOWN_KEYS.map((k) => [k, (project.dropdownOptions[k] ?? []).join("\n")])) as Record<DropdownKey, string>
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/seo-helper/keyword-mapping/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          category: category || null,
          countryCode,
          languageCode,
          dropdownOptions: Object.fromEntries(DROPDOWN_KEYS.map((k) => [k, dropdowns[k].split("\n")])),
        }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(t.projects.deleteConfirm(project.name))) return;
    await apiFetch(`/api/seo-helper/keyword-mapping/projects/${project.id}`, { method: "DELETE" });
    onDeleted();
  };

  return (
    <Modal
      title={t.settings.title}
      onClose={onClose}
      wide
      footer={
        <>
          <button className={`${buttonDanger} mr-auto`} onClick={() => void remove()}>
            {t.settings.deleteProject}
          </button>
          <button className={buttonSecondary} onClick={onClose}>
            {t.cancel}
          </button>
          <button className={buttonPrimary} disabled={busy || !name.trim()} onClick={save}>
            {busy && <Spinner />}
            {t.save}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <label className="block md:col-span-2">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.createDialog.name}</span>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.createDialog.category}</span>
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">{t.createDialog.noCategory}</option>
              {KVP_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.createDialog.country}</span>
              <input className={inputClass} value={countryCode} maxLength={2} onChange={(e) => setCountryCode(e.target.value)} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.createDialog.language}</span>
              <input className={inputClass} value={languageCode} maxLength={2} onChange={(e) => setLanguageCode(e.target.value)} />
            </label>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.settings.dropdownsTitle}</h3>
          <p className="text-xs text-slate-500 mb-2">{t.settings.dropdownsHint}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DROPDOWN_KEYS.map((k) => (
              <label key={k} className="block">
                <span className="block text-xs font-medium text-slate-500 mb-1">{t.fields[k]}</span>
                <textarea
                  className={`${inputClass} text-xs`}
                  rows={6}
                  value={dropdowns[k]}
                  onChange={(e) => setDropdowns((d) => ({ ...d, [k]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        </div>
        {error && <Notice kind="error">{error}</Notice>}
      </div>
    </Modal>
  );
}
