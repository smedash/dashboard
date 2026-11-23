"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useMessages } from "@/i18n/I18nProvider";
import { seoHelperKeywordMappingMessages } from "@/i18n/messages/seo-helper-keyword-mapping";
import type {
  DfsKeywordRow,
  DropdownOptions,
  MapCta,
  MapUrlDto,
  SubkeywordSuggestion,
  TopicCoverageStatus,
  TopicGapItem,
} from "@/lib/keyword-map/shared";
import { splitKeywords } from "@/lib/keyword-map/shared";
import { Notice, Spinner, apiFetch, buttonPrimary, buttonSecondary, formatNumber, inputClass } from "./ui";

type Tab = "keywords" | "gap" | "details" | "kvp";

interface DrawerProps {
  url: MapUrlDto;
  project: { id: string; countryCode: string; languageCode: string; category: string | null };
  editable: boolean;
  dropdownOptions: DropdownOptions;
  onUpdated: (url: MapUrlDto) => void;
  onClose: () => void;
}

export function UrlDrawer({ url, project, editable, dropdownOptions, onUpdated, onClose }: DrawerProps) {
  const t = useMessages(seoHelperKeywordMappingMessages);
  const [tab, setTab] = useState<Tab>("keywords");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "keywords", label: t.drawer.tabKeywords },
    { id: "gap", label: t.drawer.tabTopicGap },
    { id: "details", label: t.drawer.tabDetails },
    { id: "kvp", label: t.drawer.tabKvp },
  ];

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/40" onMouseDown={onClose}>
      <aside
        className="w-full max-w-3xl h-full flex flex-col bg-white dark:bg-slate-800 shadow-2xl border-l border-slate-200 dark:border-slate-700"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="px-6 pt-5 pb-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-400 truncate">{url.url}</div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white truncate">{url.h1 || url.url}</h2>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                {url.pageType && <span>{url.pageType}</span>}
                {url.topicAuthority && <span>· {url.topicAuthority}</span>}
                <a href={url.url} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">
                  {t.drawer.openPage} ↗
                </a>
              </div>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title={t.close}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="mt-4 flex gap-1">
            {tabs.map((x) => (
              <button
                key={x.id}
                onClick={() => setTab(x.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  tab === x.id
                    ? "bg-teal-600 text-white"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                {x.label}
              </button>
            ))}
          </nav>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "keywords" && <KeywordsTab url={url} editable={editable} onUpdated={onUpdated} />}
          {tab === "gap" && <TopicGapTab url={url} project={project} editable={editable} onUpdated={onUpdated} />}
          {tab === "details" && (
            <DetailsTab url={url} editable={editable} dropdownOptions={dropdownOptions} onUpdated={onUpdated} />
          )}
          {tab === "kvp" && <KvpTab url={url} editable={editable} onUpdated={onUpdated} />}
        </div>
        <footer className="px-6 py-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-400">
          {project.countryCode.toUpperCase()}/{project.languageCode}
          {project.category ? ` · ${project.category}` : ""}
        </footer>
      </aside>
    </div>
  );
}

function Section({ title, hint, actions, children }: { title: string; hint?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
        </div>
        {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/* ---------------------------------- Keywords ---------------------------------- */

function KeywordsTab({ url, editable, onUpdated }: { url: MapUrlDto; editable: boolean; onUpdated: (u: MapUrlDto) => void }) {
  const t = useMessages(seoHelperKeywordMappingMessages);
  const { intlLocale } = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [focusDraft, setFocusDraft] = useState("");
  const [focusSvDraft, setFocusSvDraft] = useState("");
  const [subDraft, setSubDraft] = useState("");
  const [dfsRows, setDfsRows] = useState<DfsKeywordRow[] | null>(null);
  const [dfsBusy, setDfsBusy] = useState(false);

  const assigned = useMemo(() => {
    const m = new Map<string, "focus" | "sub">();
    if (url.focusKeyword) m.set(url.focusKeyword.keyword, "focus");
    for (const k of url.subKeywords) m.set(k.keyword, "sub");
    return m;
  }, [url.focusKeyword, url.subKeywords]);

  const loadDfs = useCallback(
    () =>
      apiFetch<{ dfsKeywords: DfsKeywordRow[] }>(`/api/seo-helper/keyword-mapping/urls/${url.id}`)
        .then((res) => setDfsRows(res.dfsKeywords))
        .catch(() => setDfsRows([])),
    [url.id]
  );

  useEffect(() => {
    void loadDfs();
  }, [loadDfs, url.dfsFetchedAt]);

  const call = async (fn: () => Promise<{ url?: MapUrlDto; urls?: MapUrlDto[] }>) => {
    setError(null);
    try {
      const res = await fn();
      const next = res.url ?? res.urls?.[0];
      if (next) onUpdated(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
    }
  };

  const setFocus = (keyword: string | null, searchVolume: number | null, source: string) =>
    call(() =>
      apiFetch(`/api/seo-helper/keyword-mapping/urls/${url.id}/keywords`, {
        method: "PUT",
        body: JSON.stringify({ keyword, searchVolume, source }),
      })
    );

  const addSubs = (keywords: Array<{ keyword: string; searchVolume?: number | null }>, source: string) =>
    call(() =>
      apiFetch(`/api/seo-helper/keyword-mapping/urls/${url.id}/keywords`, {
        method: "POST",
        body: JSON.stringify({ keywords, source }),
      })
    );

  const removeSub = (keywordId: string) =>
    call(() =>
      apiFetch(`/api/seo-helper/keyword-mapping/urls/${url.id}/keywords`, {
        method: "DELETE",
        body: JSON.stringify({ keywordIds: [keywordId] }),
      })
    );

  const fetchDfs = async (force: boolean) => {
    setDfsBusy(true);
    await call(() =>
      apiFetch("/api/seo-helper/keyword-mapping/urls/ranked-keywords", {
        method: "POST",
        body: JSON.stringify({ ids: [url.id], force }),
      })
    );
    await loadDfs();
    setDfsBusy(false);
  };

  const sourceLabel = (s: string) => t.drawer.sources[s] ?? s;

  return (
    <div>
      {error && (
        <div className="mb-4">
          <Notice kind="error">{error}</Notice>
        </div>
      )}

      <Section title={t.drawer.focusTitle}>
        {url.focusKeyword ? (
          <div className="flex items-center gap-3 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 px-3 py-2">
            <span className="flex-1 font-semibold text-slate-900 dark:text-white">{url.focusKeyword.keyword}</span>
            <span className="text-xs text-slate-500">
              {t.drawer.searchVolume}: {formatNumber(url.focusKeyword.searchVolume, intlLocale)}
            </span>
            <span className="text-xs text-slate-400">{sourceLabel(url.focusKeyword.source)}</span>
            {editable && (
              <button className="text-xs text-red-600 hover:underline" onClick={() => void setFocus(null, null, "manual")}>
                {t.drawer.focusRemove}
              </button>
            )}
          </div>
        ) : (
          <Notice kind="info">{t.drawer.focusNone}</Notice>
        )}
        {editable && (
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!focusDraft.trim()) return;
              const sv = focusSvDraft.trim() ? Number(focusSvDraft) : null;
              void setFocus(focusDraft, Number.isFinite(sv) ? sv : null, "manual").then(() => {
                setFocusDraft("");
                setFocusSvDraft("");
              });
            }}
          >
            <input className={inputClass} placeholder={t.drawer.focusManual} value={focusDraft} onChange={(e) => setFocusDraft(e.target.value)} />
            <input
              className={`${inputClass} w-28`}
              placeholder={t.drawer.searchVolume}
              inputMode="numeric"
              value={focusSvDraft}
              onChange={(e) => setFocusSvDraft(e.target.value.replace(/[^\d]/g, ""))}
            />
            <button className={buttonSecondary} disabled={!focusDraft.trim()}>
              {t.drawer.focusSet}
            </button>
          </form>
        )}
      </Section>

      <Section title={t.drawer.subTitle}>
        {url.subKeywords.length === 0 ? (
          <p className="text-sm text-slate-500">{t.drawer.subNone}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {url.subKeywords.map((k) => (
              <span
                key={k.id}
                className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-200"
                title={sourceLabel(k.source)}
              >
                {k.keyword}
                {k.searchVolume !== null && <span className="text-xs text-slate-400">{formatNumber(k.searchVolume, intlLocale)}</span>}
                {editable && (
                  <button className="w-4 h-4 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-red-600 text-xs leading-none" onClick={() => void removeSub(k.id)}>
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        {url.subKeywords.length > 0 && url.subKeywords.every((k) => k.searchVolume === null) && url.subSearchVolume !== null && (
          <p className="mt-1 text-xs text-slate-400">{t.drawer.subSumImported(url.subSearchVolume)}</p>
        )}
        {editable && (
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const kws = splitKeywords(subDraft);
              if (kws.length === 0) return;
              void addSubs(kws.map((keyword) => ({ keyword })), "manual").then(() => setSubDraft(""));
            }}
          >
            <input className={inputClass} placeholder={t.drawer.subManual} value={subDraft} onChange={(e) => setSubDraft(e.target.value)} />
            <button className={buttonSecondary} disabled={!subDraft.trim()}>
              {t.drawer.subAdd}
            </button>
          </form>
        )}
      </Section>

      <Section
        title={t.drawer.dfsTitle}
        hint={t.drawer.dfsHint}
        actions={
          editable && (
            <button className={buttonSecondary} disabled={dfsBusy} onClick={() => void fetchDfs(!!url.dfsFetchedAt)}>
              {dfsBusy && <Spinner />}
              {url.dfsFetchedAt ? t.drawer.dfsRefresh : t.drawer.dfsFetch}
            </button>
          )
        }
      >
        {url.dfsFetchedAt && (
          <p className="text-xs text-slate-400 mb-2">{t.drawer.dfsFetchedAt(new Date(url.dfsFetchedAt).toLocaleDateString(intlLocale))}</p>
        )}
        {dfsRows === null ? (
          <Spinner />
        ) : !url.dfsFetchedAt ? (
          <p className="text-sm text-slate-500">{t.drawer.dfsNotFetched}</p>
        ) : dfsRows.length === 0 ? (
          <Notice kind="warning">{t.drawer.dfsEmpty}</Notice>
        ) : (
          <KeywordTable
            rows={dfsRows.map((r) => ({ keyword: r.keyword, searchVolume: r.searchVolume, extra: r.rankGroup || "–", top: r.keyword === url.dfsTopKeyword }))}
            extraLabel={t.drawer.position}
            assigned={assigned}
            editable={editable}
            onFocus={(r) => void setFocus(r.keyword, r.searchVolume, "dataforseo")}
            onSub={(r) => void addSubs([{ keyword: r.keyword, searchVolume: r.searchVolume }], "dataforseo")}
          />
        )}
      </Section>

      <SeosparkSection url={url} editable={editable} assigned={assigned} onAdd={(items) => addSubs(items, "seospark")} onFocus={(k, sv) => setFocus(k, sv, "seospark")} />
    </div>
  );
}

function KeywordTable({
  rows,
  extraLabel,
  assigned,
  editable,
  onFocus,
  onSub,
}: {
  rows: Array<{ keyword: string; searchVolume: number | null; extra: string | number; top?: boolean }>;
  extraLabel: string;
  assigned: Map<string, "focus" | "sub">;
  editable: boolean;
  onFocus: (r: { keyword: string; searchVolume: number | null }) => void;
  onSub: (r: { keyword: string; searchVolume: number | null }) => void;
}) {
  const t = useMessages(seoHelperKeywordMappingMessages);
  const { intlLocale } = useLocale();
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500">
          <tr>
            <th className="px-3 py-1.5 text-left">Keyword</th>
            <th className="px-3 py-1.5 text-right">{extraLabel}</th>
            <th className="px-3 py-1.5 text-right">{t.drawer.searchVolume}</th>
            <th className="px-3 py-1.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
          {rows.map((r) => {
            const state = assigned.get(r.keyword);
            return (
              <tr key={r.keyword} className={r.top ? "bg-amber-50/60 dark:bg-amber-900/10" : ""}>
                <td className="px-3 py-1.5 text-slate-800 dark:text-slate-200">
                  {r.keyword}
                  {r.top && <span className="ml-2 text-[10px] uppercase font-semibold text-amber-600">Top</span>}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{r.extra}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(r.searchVolume, intlLocale)}</td>
                <td className="px-3 py-1.5 text-right whitespace-nowrap">
                  {state ? (
                    <span className="text-xs font-medium text-teal-600">{state === "focus" ? t.drawer.isFocus : t.drawer.isSub}</span>
                  ) : (
                    editable && (
                      <span className="inline-flex gap-1">
                        <button className="px-2 py-0.5 rounded text-xs bg-teal-600 text-white hover:bg-teal-700" onClick={() => onFocus(r)}>
                          {t.drawer.asFocus}
                        </button>
                        <button className="px-2 py-0.5 rounded text-xs border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700" onClick={() => onSub(r)}>
                          {t.drawer.asSub}
                        </button>
                      </span>
                    )
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SeosparkSection({
  url,
  editable,
  assigned,
  onAdd,
  onFocus,
}: {
  url: MapUrlDto;
  editable: boolean;
  assigned: Map<string, "focus" | "sub">;
  onAdd: (items: Array<{ keyword: string; searchVolume: number | null }>) => Promise<void>;
  onFocus: (keyword: string, sv: number | null) => Promise<void>;
}) {
  const t = useMessages(seoHelperKeywordMappingMessages);
  const { intlLocale } = useLocale();
  const [seed, setSeed] = useState(url.focusKeyword?.keyword ?? "");
  const [result, setResult] = useState<{ suggestions: SubkeywordSuggestion[]; cached: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  useEffect(() => {
    setSeed(url.focusKeyword?.keyword ?? "");
  }, [url.focusKeyword?.keyword]);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ suggestions: SubkeywordSuggestion[]; cached: boolean }>(
        `/api/seo-helper/keyword-mapping/urls/${url.id}/subkeyword-suggestions`,
        { method: "POST", body: JSON.stringify({ keyword: seed }) }
      );
      setResult(res);
      setChecked(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  const visible = (result?.suggestions ?? []).filter((s) => !filter.trim() || s.keyword.includes(filter.trim().toLowerCase()));
  const selectedItems = (result?.suggestions ?? []).filter((s) => checked.has(s.keyword));

  return (
    <Section title={t.drawer.sparkTitle} hint={t.drawer.sparkHint}>
      {!url.focusKeyword && !seed && <Notice kind="info">{t.drawer.noFocusForSpark}</Notice>}
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (seed.trim()) void run();
        }}
      >
        <input className={inputClass} placeholder={t.drawer.sparkSeed} value={seed} onChange={(e) => setSeed(e.target.value)} />
        <button className={buttonSecondary} disabled={!seed.trim() || busy}>
          {busy && <Spinner />}
          {t.drawer.sparkRun}
        </button>
      </form>
      {error && (
        <div className="mt-2">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
      {result && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <input className={`${inputClass} max-w-xs`} placeholder={t.drawer.sparkFilter} value={filter} onChange={(e) => setFilter(e.target.value)} />
            {result.cached && <span className="text-xs text-slate-400">{t.drawer.sparkCached}</span>}
            <div className="flex-1" />
            {editable && (
              <button
                className={buttonPrimary}
                disabled={selectedItems.length === 0}
                onClick={() =>
                  void onAdd(selectedItems.map((s) => ({ keyword: s.keyword, searchVolume: s.searchVolume }))).then(() => setChecked(new Set()))
                }
              >
                {t.drawer.sparkAddSelected(selectedItems.length)}
              </button>
            )}
          </div>
          <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-1.5 w-8" />
                  <th className="px-3 py-1.5 text-left">Keyword</th>
                  <th className="px-3 py-1.5 text-right">{t.drawer.searchVolume}</th>
                  <th className="px-3 py-1.5 text-right">{t.drawer.difficulty}</th>
                  <th className="px-3 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {visible.map((s) => {
                  const state = assigned.get(s.keyword);
                  return (
                    <tr key={s.keyword}>
                      <td className="px-3 py-1.5">
                        {!state && editable && (
                          <input
                            type="checkbox"
                            checked={checked.has(s.keyword)}
                            onChange={() =>
                              setChecked((prev) => {
                                const next = new Set(prev);
                                if (next.has(s.keyword)) next.delete(s.keyword);
                                else next.add(s.keyword);
                                return next;
                              })
                            }
                          />
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-slate-800 dark:text-slate-200">
                        {s.keyword}
                        {s.assignedElsewhere.length > 0 && (
                          <span
                            className="ml-2 px-1.5 py-0.5 rounded text-[11px] bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                            title={s.assignedElsewhere.map((e) => `${e.type}: ${e.url}`).join("\n")}
                          >
                            ⚠ {t.drawer.sparkElsewhere(s.assignedElsewhere.length)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(s.searchVolume, intlLocale)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{s.difficulty ?? "–"}</td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        {state ? (
                          <span className="text-xs font-medium text-teal-600">{state === "focus" ? t.drawer.isFocus : t.drawer.isSub}</span>
                        ) : (
                          editable && (
                            <span className="inline-flex gap-1">
                              <button className="px-2 py-0.5 rounded text-xs bg-teal-600 text-white hover:bg-teal-700" onClick={() => void onFocus(s.keyword, s.searchVolume)}>
                                {t.drawer.asFocus}
                              </button>
                              <button
                                className="px-2 py-0.5 rounded text-xs border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                                onClick={() => void onAdd([{ keyword: s.keyword, searchVolume: s.searchVolume }])}
                              >
                                {t.drawer.asSub}
                              </button>
                            </span>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ---------------------------------- Topic-Gap ---------------------------------- */

interface GapResponse {
  gap: {
    id: string;
    focusKeyword: string;
    status: string;
    coverageScore: number | null;
    results: TopicGapItem[];
    summary: string | null;
    error: string | null;
    taskId: string | null;
    createdAt: string;
  } | null;
  topicGraph: { status: string; totalTopics: number; tree: TreeNode | null } | null;
}

interface TreeNode {
  label: string;
  children: TreeNode[];
}

const POLL_MS = 5000;

const statusStyles: Record<TopicCoverageStatus, string> = {
  covered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  partial: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  missing: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};
const statusDot: Record<TopicCoverageStatus, string> = {
  covered: "bg-emerald-500",
  partial: "bg-amber-500",
  missing: "bg-red-500",
};

function TopicGapTab({
  url,
  project,
  editable,
  onUpdated,
}: {
  url: MapUrlDto;
  project: DrawerProps["project"];
  editable: boolean;
  onUpdated: (u: MapUrlDto) => void;
}) {
  const t = useMessages(seoHelperKeywordMappingMessages);
  const { intlLocale } = useLocale();
  const [data, setData] = useState<GapResponse | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTopics, setRefreshTopics] = useState(false);
  const [filter, setFilter] = useState<"all" | TopicCoverageStatus>("all");
  const [view, setView] = useState<"list" | "tree">("list");
  const [copied, setCopied] = useState(false);

  const running = data?.gap && (data.gap.status === "processing" || data.gap.status === "analyzing");

  const refreshUrl = useCallback(async () => {
    try {
      const res = await apiFetch<{ url: MapUrlDto }>(`/api/seo-helper/keyword-mapping/urls/${url.id}`);
      onUpdated(res.url);
    } catch {
      // Tabellenzeile bleibt dann bis zum nächsten Laden unverändert
    }
  }, [url.id, onUpdated]);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<GapResponse>(`/api/seo-helper/keyword-mapping/urls/${url.id}/topic-gap`);
      setData(res);
      return res;
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
      return null;
    }
  }, [url.id, t.errorGeneric]);

  useEffect(() => {
    void load();
    apiFetch<{ credits: number }>("/api/seo-helper/keyword-mapping/topicloops-account")
      .then((r) => setCredits(r.credits))
      .catch(() => setCredits(null));
  }, [load]);

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(async () => {
      const res = await load();
      if (res?.gap && (res.gap.status === "succeeded" || res.gap.status === "failed")) void refreshUrl();
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [running, data, load, refreshUrl]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<GapResponse>(`/api/seo-helper/keyword-mapping/urls/${url.id}/topic-gap`, {
        method: "POST",
        body: JSON.stringify({ refreshTopics }),
      });
      setData(res);
      void refreshUrl();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  const gap = data?.gap;
  const items = useMemo(() => (gap?.status === "succeeded" ? gap.results.map((i, index) => ({ ...i, index })) : []), [gap]);
  const counts = {
    covered: items.filter((i) => i.status === "covered").length,
    partial: items.filter((i) => i.status === "partial").length,
    missing: items.filter((i) => i.status === "missing").length,
  };
  const selectedCount = items.filter((i) => i.selected).length;
  const visible = items.filter((i) => filter === "all" || i.status === filter);
  const statusByTopic = useMemo(() => new Map(items.map((i) => [i.topic.toLowerCase(), i])), [items]);

  const toggleSelected = async (index: number, selected: boolean) => {
    if (!gap) return;
    const gapId = gap.id;
    const setLocal = (value: boolean) =>
      setData((prev) =>
        prev?.gap?.id === gapId
          ? { ...prev, gap: { ...prev.gap, results: prev.gap.results.map((r, i) => (i === index ? { ...r, selected: value } : r)) } }
          : prev
      );
    setLocal(selected);
    setError(null);
    try {
      const res = await apiFetch<{ selectedCount: number }>(`/api/seo-helper/keyword-mapping/urls/${url.id}/topic-gap`, {
        method: "PATCH",
        body: JSON.stringify({ gapId, index, selected }),
      });
      if (url.latestTopicGap?.id === gapId) onUpdated({ ...url, latestTopicGap: { ...url.latestTopicGap, selectedCount: res.selectedCount } });
    } catch (e) {
      setLocal(!selected);
      setError(e instanceof Error ? e.message : t.errorGeneric);
    }
  };

  const [creating, setCreating] = useState<Set<number>>(new Set());
  const createArticle = async (index: number) => {
    if (!gap) return;
    const gapId = gap.id;
    const now = new Date();
    const plannedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    setCreating((prev) => new Set(prev).add(index));
    setError(null);
    try {
      const res = await apiFetch<{ article: { id: string } }>(`/api/seo-helper/keyword-mapping/urls/${url.id}/topic-gap/editorial`, {
        method: "POST",
        body: JSON.stringify({ gapId, index, plannedDate }),
      });
      setData((prev) =>
        prev?.gap?.id === gapId
          ? { ...prev, gap: { ...prev.gap, results: prev.gap.results.map((r, i) => (i === index ? { ...r, editorialArticleId: res.article.id } : r)) } }
          : prev
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
    } finally {
      setCreating((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  const topicActions = (i: TopicGapItem & { index: number }) => (
    <span className="shrink-0 flex items-center gap-3">
      {i.status !== "covered" &&
        (i.editorialArticleId ? (
          <a href="/redaktionsplan" target="_blank" rel="noreferrer" className="text-xs text-teal-600 hover:underline whitespace-nowrap">
            ✓ {t.drawer.gapInEditorialPlan} ↗
          </a>
        ) : (
          editable && (
            <button
              className="px-2 py-0.5 rounded text-xs border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap inline-flex items-center gap-1"
              disabled={creating.has(i.index)}
              title={t.drawer.gapNewArticleHint}
              onClick={() => void createArticle(i.index)}
            >
              {creating.has(i.index) && <Spinner />}
              {t.drawer.gapNewArticle}
            </button>
          )
        ))}
      <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer whitespace-nowrap">
        <input type="checkbox" disabled={!editable} checked={!!i.selected} onChange={(e) => void toggleSelected(i.index, e.target.checked)} />
        {t.drawer.gapTakeOver}
      </label>
    </span>
  );

  const [creatingTask, setCreatingTask] = useState(false);
  const createTask = async () => {
    if (!gap) return;
    const gapId = gap.id;
    setCreatingTask(true);
    setError(null);
    try {
      const res = await apiFetch<{ task: { id: string } }>(`/api/seo-helper/keyword-mapping/urls/${url.id}/topic-gap/task`, {
        method: "POST",
        body: JSON.stringify({ gapId }),
      });
      setData((prev) => (prev?.gap?.id === gapId ? { ...prev, gap: { ...prev.gap, taskId: res.task.id } } : prev));
      if (url.latestTopicGap?.id === gapId) onUpdated({ ...url, latestTopicGap: { ...url.latestTopicGap, taskId: res.task.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
    } finally {
      setCreatingTask(false);
    }
  };

  const copyTask = async () => {
    if (!gap) return;
    const missing = items.filter((i) => i.status === "missing");
    const partial = items.filter((i) => i.status === "partial");
    const text = [
      t.drawer.gapTaskText(url.url, gap.focusKeyword, gap.coverageScore),
      gap.summary ? `\n${gap.summary}` : "",
      missing.length ? `\n${t.drawer.gapMissingHeading}:\n${missing.map((i) => `- ${[...i.path, i.topic].join(" > ")}`).join("\n")}` : "",
      partial.length ? `\n${t.drawer.gapPartialHeading}:\n${partial.map((i) => `- ${[...i.path, i.topic].join(" > ")}`).join("\n")}` : "",
    ].join("\n");
    await navigator.clipboard.writeText(text.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <Section
        title={t.drawer.gapTitle}
        hint={t.drawer.gapHint}
        actions={
          editable && (
            <button className={buttonPrimary} disabled={busy || !!running || !url.focusKeyword} onClick={() => void start()}>
              {busy && <Spinner />}
              {gap ? t.drawer.gapRestart : t.drawer.gapStart}
            </button>
          )
        }
      >
        {url.focusKeyword && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-sm">
            <span className="text-slate-500">{t.drawer.gapSendKeyword}:</span>
            <code className="font-semibold text-slate-900 dark:text-white">{url.focusKeyword.keyword.trim().toLowerCase()}</code>
            <span className="text-xs text-slate-400">
              ({project.countryCode}/{project.languageCode})
            </span>
            {gap && gap.focusKeyword !== url.focusKeyword.keyword && (
              <span className="text-xs text-slate-400">
                · {t.drawer.gapLastKeyword} „{gap.focusKeyword}“
              </span>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          {credits !== null && <span>{t.drawer.gapCredits(credits)}</span>}
          {editable && (
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={refreshTopics} onChange={(e) => setRefreshTopics(e.target.checked)} />
              {t.drawer.gapRefreshTopics}
            </label>
          )}
        </div>
        {!url.focusKeyword && (
          <div className="mt-2">
            <Notice kind="info">{t.drawer.noFocusForSpark}</Notice>
          </div>
        )}
      </Section>

      {error && <Notice kind="error">{error}</Notice>}
      {data === null && !error && <Spinner />}
      {data && !gap && <p className="text-sm text-slate-500">{t.drawer.gapNone}</p>}

      {gap && (
        <div className="space-y-4">
          {gap.focusKeyword !== url.focusKeyword?.keyword && <Notice kind="warning">{t.drawer.gapOutdated(gap.focusKeyword)}</Notice>}

          {running && (
            <Notice kind="info">
              <span className="flex items-center gap-2">
                <Spinner /> {gap.status === "processing" ? t.drawer.gapProcessing : t.drawer.gapAnalyzing}
              </span>
            </Notice>
          )}
          {gap.status === "failed" && (
            <Notice kind="error">
              {t.drawer.gapFailed}
              {gap.error ? `: ${gap.error}` : ""}
            </Notice>
          )}

          {gap.status === "succeeded" && (
            <>
              <div className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">{gap.coverageScore ?? "–"} %</div>
                  <div className="text-xs text-slate-500">{t.drawer.gapCoverage}</div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700">
                    {(["covered", "partial", "missing"] as const).map((s) => (
                      <span key={s} className={statusDot[s]} style={{ width: `${items.length ? (counts[s] / items.length) * 100 : 0}%` }} />
                    ))}
                  </div>
                  <div className="flex gap-3 text-xs text-slate-600 dark:text-slate-300">
                    <span>● {t.drawer.covered}: {counts.covered}</span>
                    <span>● {t.drawer.partial}: {counts.partial}</span>
                    <span>● {t.drawer.missing}: {counts.missing}</span>
                  </div>
                  <div className="text-xs text-slate-400">{t.drawer.gapFor(gap.focusKeyword, new Date(gap.createdAt).toLocaleString(intlLocale))}</div>
                </div>
                {gap.taskId ? (
                  <a href="/tasks" target="_blank" rel="noreferrer" className="shrink-0 self-start text-xs text-teal-600 hover:underline whitespace-nowrap">
                    ✓ {t.drawer.gapInKanban} ↗
                  </a>
                ) : (
                  editable && (
                    <button className={`${buttonSecondary} shrink-0 self-start`} disabled={creatingTask} title={t.drawer.gapCreateTaskHint} onClick={() => void createTask()}>
                      {creatingTask && <Spinner />}
                      {t.drawer.gapCreateTask}
                    </button>
                  )
                )}
              </div>
              {gap.summary && <p className="text-sm text-slate-700 dark:text-slate-300">{gap.summary}</p>}

              <div className="flex flex-wrap items-center gap-2">
                {(["all", "missing", "partial", "covered"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2.5 py-1 rounded-lg text-xs border ${
                      filter === f ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900" : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {f === "all" ? t.drawer.gapFilterAll : t.drawer[f]} {f !== "all" && `(${counts[f]})`}
                  </button>
                ))}
                <div className="flex-1" />
                <span className="text-xs text-slate-500">{t.drawer.gapSelectedCount(selectedCount)}</span>
                {data.topicGraph?.tree && (
                  <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden text-xs">
                    {(["list", "tree"] as const).map((v) => (
                      <button key={v} onClick={() => setView(v)} className={`px-2.5 py-1 ${view === v ? "bg-slate-100 dark:bg-slate-700 font-medium" : ""}`}>
                        {v === "list" ? t.drawer.gapViewList : t.drawer.gapViewTree}
                      </button>
                    ))}
                  </div>
                )}
                <button className={buttonSecondary} onClick={() => void copyTask()}>
                  {copied ? t.drawer.gapCopied : t.drawer.gapCopy}
                </button>
              </div>

              {view === "list" || !data.topicGraph?.tree ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/60 rounded-lg border border-slate-200 dark:border-slate-700">
                  {visible.map((i) => (
                    <li key={`${i.index}-${i.topic}`} className={`px-3 py-2 ${i.selected ? "bg-teal-50/60 dark:bg-teal-900/10" : ""}`}>
                      <div className="flex items-start gap-2">
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[11px] font-medium ${statusStyles[i.status]}`}>{t.drawer[i.status]}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-slate-900 dark:text-white">
                            {i.path.length > 0 && <span className="text-slate-400">{i.path.join(" › ")} › </span>}
                            {i.topic}
                          </div>
                          {i.reason && <div className="text-xs text-slate-500">{i.reason}</div>}
                          {i.evidence && (
                            <div className="mt-0.5 text-xs italic text-slate-400">
                              {t.drawer.evidence}: „{i.evidence}“
                            </div>
                          )}
                        </div>
                        {topicActions(i)}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                  <TopicTree
                    node={data.topicGraph.tree}
                    statusByTopic={statusByTopic}
                    filter={filter}
                    renderActions={topicActions}
                    root
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TopicTree({
  node,
  statusByTopic,
  filter,
  renderActions,
  root,
}: {
  node: TreeNode;
  statusByTopic: Map<string, TopicGapItem & { index: number }>;
  filter: "all" | TopicCoverageStatus;
  renderActions: (item: TopicGapItem & { index: number }) => React.ReactNode;
  root?: boolean;
}) {
  const item = statusByTopic.get(node.label.toLowerCase());
  const matches = (n: TreeNode): boolean => {
    const s = statusByTopic.get(n.label.toLowerCase());
    return filter === "all" || s?.status === filter || n.children.some(matches);
  };
  if (!root && !matches(node)) return null;
  return (
    <div className={root ? "" : "ml-4 border-l border-slate-100 dark:border-slate-700 pl-3"}>
      <div className="flex items-center gap-2 py-0.5 text-sm" title={item?.reason}>
        {item ? <span className={`w-2 h-2 rounded-full ${statusDot[item.status]}`} /> : <span className="w-2 h-2 rounded-full bg-slate-300" />}
        <span className={root ? "font-semibold text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}>{node.label}</span>
        {item && <span className="ml-auto">{renderActions(item)}</span>}
      </div>
      {node.children.map((c, idx) => (
        <TopicTree key={`${c.label}-${idx}`} node={c} statusByTopic={statusByTopic} filter={filter} renderActions={renderActions} />
      ))}
    </div>
  );
}

/* ---------------------------------- Mapping-Daten ---------------------------------- */

function DetailsTab({
  url,
  editable,
  dropdownOptions,
  onUpdated,
}: {
  url: MapUrlDto;
  editable: boolean;
  dropdownOptions: DropdownOptions;
  onUpdated: (u: MapUrlDto) => void;
}) {
  const t = useMessages(seoHelperKeywordMappingMessages);
  const initial = useMemo(
    () => ({
      h1: url.h1 ?? "",
      noindex: url.noindex,
      statusCode: url.statusCode !== null ? String(url.statusCode) : "",
      navigationType: url.navigationType ?? "",
      pageType: url.pageType ?? "",
      funnel: url.funnel ?? "",
      targetGroup: url.targetGroup ?? "",
      topicAuthority: url.topicAuthority ?? "",
      ctas: url.ctas.length ? url.ctas : [{ label: "", link: "" }],
      furtherLinks: url.furtherLinks.join("\n"),
      subSearchVolume: url.subSearchVolume !== null ? String(url.subSearchVolume) : "",
      manualRank: url.manualRank ?? "",
      gscClicks: url.gscClicks !== null ? String(url.gscClicks) : "",
      comment: url.comment ?? "",
    }),
    [url]
  );
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => setForm(initial), [initial]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setCta = (i: number, patch: Partial<MapCta>) =>
    setForm((f) => ({ ...f, ctas: f.ctas.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await apiFetch<{ url: MapUrlDto }>(`/api/seo-helper/keyword-mapping/urls/${url.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...form, furtherLinks: form.furtherLinks.split("\n") }),
      });
      onUpdated(res.url);
      setStatus({ kind: "success", text: t.drawer.detailsSaved });
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof Error ? e.message : t.errorGeneric });
    } finally {
      setBusy(false);
    }
  };

  const text = (key: "h1" | "statusCode" | "manualRank" | "gscClicks" | "subSearchVolume", label: string, extra?: string) => (
    <label className={`block ${extra ?? ""}`}>
      <span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>
      <input className={inputClass} disabled={!editable} value={form[key]} onChange={(e) => set(key, e.target.value)} />
    </label>
  );
  const select = (key: "navigationType" | "pageType" | "funnel" | "targetGroup" | "topicAuthority", label: string, values: string[]) => (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>
      <input className={inputClass} disabled={!editable} list={`dd-${key}`} value={form[key]} onChange={(e) => set(key, e.target.value)} />
      <datalist id={`dd-${key}`}>
        {values.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {text("h1", t.fields.h1, "sm:col-span-2")}
        {select("navigationType", t.fields.navigationType, ["Guide", "Help", "Navigation"])}
        {select("pageType", t.fields.pageType, dropdownOptions.pageType ?? [])}
        {select("funnel", t.fields.funnel, dropdownOptions.funnel ?? [])}
        {select("targetGroup", t.fields.targetGroup, dropdownOptions.targetGroup ?? [])}
        {select("topicAuthority", t.fields.topicAuthority, dropdownOptions.topicAuthority ?? [])}
        <div className="grid grid-cols-2 gap-3">
          {text("statusCode", t.fields.statusCode)}
          <label className="flex items-end gap-2 pb-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" disabled={!editable} checked={form.noindex} onChange={(e) => set("noindex", e.target.checked)} />
            {t.fields.noindex}
          </label>
        </div>
        {text("manualRank", t.fields.manualRank)}
        {text("gscClicks", t.fields.gscClicks)}
        {text("subSearchVolume", t.fields.subSearchVolume)}
      </div>

      <div>
        <span className="block text-xs font-medium text-slate-500 mb-1">{t.fields.ctas}</span>
        <div className="space-y-2">
          {form.ctas.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input className={inputClass} disabled={!editable} placeholder={`${t.fields.ctaLabel} ${i + 1}`} value={c.label} onChange={(e) => setCta(i, { label: e.target.value })} />
              <input className={inputClass} disabled={!editable} placeholder={t.fields.ctaLink} value={c.link} onChange={(e) => setCta(i, { link: e.target.value })} />
              {editable && (
                <button className="px-2 text-slate-400 hover:text-red-600" onClick={() => set("ctas", form.ctas.filter((_, idx) => idx !== i))}>
                  ×
                </button>
              )}
            </div>
          ))}
          {editable && (
            <button className="text-xs text-teal-600 hover:underline" onClick={() => set("ctas", [...form.ctas, { label: "", link: "" }])}>
              + {t.drawer.ctaAdd}
            </button>
          )}
        </div>
      </div>

      <label className="block">
        <span className="block text-xs font-medium text-slate-500 mb-1">
          {t.fields.furtherLinks} <span className="font-normal">({t.drawer.linksHint})</span>
        </span>
        <textarea className={`${inputClass} font-mono text-xs`} rows={5} disabled={!editable} value={form.furtherLinks} onChange={(e) => set("furtherLinks", e.target.value)} />
      </label>

      <label className="block">
        <span className="block text-xs font-medium text-slate-500 mb-1">{t.fields.comment}</span>
        <textarea className={inputClass} rows={3} disabled={!editable} value={form.comment} onChange={(e) => set("comment", e.target.value)} />
      </label>

      {status && <Notice kind={status.kind}>{status.text}</Notice>}
      {editable && (
        <div className="flex justify-end">
          <button className={buttonPrimary} disabled={busy} onClick={() => void save()}>
            {busy && <Spinner />}
            {t.save}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- KVP ---------------------------------- */

function KvpTab({ url, editable, onUpdated }: { url: MapUrlDto; editable: boolean; onUpdated: (u: MapUrlDto) => void }) {
  const t = useMessages(seoHelperKeywordMappingMessages);
  const [includeGap, setIncludeGap] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const push = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const res = await apiFetch<{ results: Record<string, { status: string; reason?: string }>; urls: MapUrlDto[] }>(
        "/api/seo-helper/keyword-mapping/urls/kvp-push",
        { method: "POST", body: JSON.stringify({ ids: [url.id], includeGapComment: includeGap }) }
      );
      if (res.urls[0]) onUpdated(res.urls[0]);
      const r = res.results[url.id];
      setStatus({
        kind: r?.status === "skipped" ? "error" : "success",
        text: r?.status === "skipped" ? r.reason ?? t.errorGeneric : t.bulk.kvpDone(r?.status === "created" ? 1 : 0, r?.status === "updated" ? 1 : 0, 0),
      });
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof Error ? e.message : t.errorGeneric });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Notice kind={url.kvpUrlId ? "success" : "info"}>{url.kvpUrlId ? t.drawer.kvpLinked : t.drawer.kvpNotLinked}</Notice>
      <dl className="grid grid-cols-[10rem_1fr] gap-y-1 text-sm">
        <dt className="text-slate-500">{t.fields.focusKeyword}</dt>
        <dd className="font-medium text-slate-900 dark:text-white">{url.focusKeyword?.keyword ?? "–"}</dd>
        <dt className="text-slate-500">{t.fields.subKeywords}</dt>
        <dd className="text-slate-700 dark:text-slate-300">{url.subKeywords.map((k) => k.keyword).join(", ") || "–"}</dd>
      </dl>
      {!url.focusKeyword && <Notice kind="warning">{t.drawer.kvpNeedsFocus}</Notice>}
      {editable && (
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={includeGap} onChange={(e) => setIncludeGap(e.target.checked)} />
          {t.bulk.kvpIncludeGap}
        </label>
      )}
      {editable && includeGap && url.latestTopicGap?.status === "succeeded" && (
        <p className="text-xs text-slate-500">
          {url.latestTopicGap.selectedCount > 0 ? t.drawer.kvpSelectedTopics(url.latestTopicGap.selectedCount) : t.drawer.kvpNoSelectedTopics}
        </p>
      )}
      {status && <Notice kind={status.kind}>{status.text}</Notice>}
      <div className="flex gap-2">
        {editable && (
          <button className={buttonPrimary} disabled={busy || !url.focusKeyword} onClick={() => void push()}>
            {busy && <Spinner />}
            {url.kvpUrlId ? t.drawer.kvpUpdate : t.drawer.kvpPush}
          </button>
        )}
        {url.kvpUrlId && (
          <a className={buttonSecondary} href={`/ubs-kvp?search=${encodeURIComponent(url.url)}`} target="_blank" rel="noreferrer">
            {t.drawer.kvpOpen} ↗
          </a>
        )}
      </div>
    </div>
  );
}
