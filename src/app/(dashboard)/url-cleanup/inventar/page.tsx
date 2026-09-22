"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterBar } from "@/components/url-cleanup/FilterBar";
import { KillBadge } from "@/components/url-cleanup/KillBadge";
import { RankedKeywordsSyncPanel } from "@/components/url-cleanup/RankedKeywordsSyncPanel";
import { ThresholdPanel } from "@/components/url-cleanup/ThresholdPanel";
import {
  EMPTY_FILTERS,
  filtersToParams,
  type InventoryFilters,
} from "@/components/url-cleanup/filter-state";

type Row = {
  id: string;
  url: string;
  country: string | null;
  language: string | null;
  section: string | null;
  gscClicks: number;
  gscImpressions: number;
  gscPeriod: string | null;
  aaVisits: number;
  aaFormSuccess: number;
  aaHasData: boolean;
  aaSegments: string[];
  focusKeywords: string[];
  labsKeywords: string[];
  labsBestRank: number | null;
  labsMaxSearchVolume: number | null;
  labsHasData: boolean;
  killConfidence: number;
  killReason: string;
  killBand: string;
  cleanupStatus: string;
  lastmod: string | null;
};

type LabsRow = { keyword: string; rankGroup: number; searchVolume: number | null };

export default function InventarPage() {
  const [filters, setFilters] = useState<InventoryFilters>(EMPTY_FILTERS);
  const [debounced, setDebounced] = useState(filters);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [facets, setFacets] = useState<{ countries: string[]; languages: string[] }>({
    countries: [],
    languages: [],
  });
  const [sitemaps, setSitemaps] = useState<Array<{ id: string; sitemapUrl: string; countryPath: string | null }>>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Row | null>(null);
  const [labs, setLabs] = useState<Record<string, LabsRow[]>>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(filters);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [filters]);

  useEffect(() => {
    fetch("/api/url-cleanup/dimensions")
      .then((r) => r.json())
      .then((d) => setSitemaps(d.sitemaps ?? []))
      .catch(() => setSitemaps([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = filtersToParams(debounced, page);
    const res = await fetch(`/api/url-cleanup/inventory?${params.toString()}`);
    const data = await res.json();
    setRows(data.rows ?? []);
    setTotal(data.total ?? 0);
    if (data.facets) setFacets(data.facets);
    setLoading(false);
  }, [debounced, page]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (rows.length === 0) return;
    const items = rows.map((r) => ({ id: r.id, url: r.url }));
    (async () => {
      const cached = await fetch("/api/keyword-mapping/ranked-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, useCache: true }),
      });
      const cacheData = await cached.json();
      const byId = (cacheData.byId ?? {}) as Record<string, { keywords?: LabsRow[] }>;
      const next: Record<string, LabsRow[]> = {};
      for (const r of rows) {
        const kws = byId[r.id]?.keywords;
        if (kws && kws.length > 0) next[r.id] = kws;
        else next[r.id] = r.labsKeywords.map((keyword) => ({ keyword, rankGroup: 0, searchVolume: null }));
      }
      setLabs((prev) => ({ ...prev, ...next }));
    })().catch(() => undefined);
  }, [rows]);

  const pageCount = Math.max(1, Math.ceil(total / 25));

  const exportHref = useMemo(() => {
    const p = filtersToParams(debounced, 0, 50000);
    p.delete("page");
    return `/api/url-cleanup/export?${p.toString()}`;
  }, [debounced]);

  async function setStatus(status: string) {
    const ids = [...selected];
    if (ids.length === 0) return;
    const res = await fetch("/api/url-cleanup/flags", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, status }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMsg(data.error || "Fehler");
      return;
    }
    setStatusMsg(`${ids.length} URLs → ${status}`);
    setSelected(new Set());
    load();
  }

  return (
    <div className="space-y-4">
      <ThresholdPanel onSaved={() => load()} />
      <FilterBar
        filters={filters}
        onChange={setFilters}
        facets={facets}
        sitemaps={sitemaps}
      />
      <RankedKeywordsSyncPanel onDone={() => load()} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500">
          {total.toLocaleString("de-CH")} URLs
        </span>
        <a
          href={exportHref}
          className="px-3 py-1.5 text-sm rounded-lg bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900"
        >
          Excel-Export
        </a>
        <button type="button" className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600" onClick={() => setStatus("kill")}>
          Markieren: kill
        </button>
        <button type="button" className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600" onClick={() => setStatus("keep")}>
          keep
        </button>
        <button type="button" className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600" onClick={() => setStatus("candidate")}>
          candidate
        </button>
        {statusMsg && <span className="text-xs text-slate-500">{statusMsg}</span>}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-x-auto">
        <table className="w-full min-w-[70rem] table-fixed text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs uppercase text-slate-500">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
                  onChange={(e) => {
                    if (e.target.checked) setSelected(new Set(rows.map((r) => r.id)));
                    else setSelected(new Set());
                  }}
                />
              </th>
              <th className="w-[26%] px-3 py-2 text-left">URL</th>
              <th className="w-24 px-3 py-2 text-left">Konfidenz</th>
              <th className="px-3 py-2 text-left">Begründung</th>
              <th className="w-24 px-3 py-2 text-right">GSC</th>
              <th className="w-24 px-3 py-2 text-right">Adobe</th>
              <th className="w-36 px-3 py-2 text-left">Fokuskeywords</th>
              <th className="w-44 px-3 py-2 text-left">ranked Keywords</th>
              <th className="w-24 px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {loading && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  Laden…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  Keine Treffer. Inventar ggf. zuerst importieren.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                <td className="px-3 py-2 align-top">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={(e) => {
                      const n = new Set(selected);
                      if (e.target.checked) n.add(r.id);
                      else n.delete(r.id);
                      setSelected(n);
                    }}
                  />
                </td>
                <td className="px-3 py-2 overflow-hidden align-top">
                  <button
                    type="button"
                    onClick={() => setDetail(r)}
                    className="text-left text-blue-600 dark:text-blue-400 hover:underline block w-full min-w-0 break-all line-clamp-2"
                    title={r.url}
                  >
                    {r.url.replace("https://www.ubs.com", "")}
                  </button>
                  <div className="text-[10px] text-slate-400 uppercase truncate">
                    {[r.country, r.language, r.section].filter(Boolean).join(" / ")}
                  </div>
                </td>
                <td className="px-3 py-2 overflow-hidden align-top">
                  <KillBadge score={r.killConfidence} band={r.killBand} />
                </td>
                <td className="px-3 py-2 overflow-hidden align-top">
                  <span className="line-clamp-3 break-words text-xs text-slate-600 dark:text-slate-300" title={r.killReason}>
                    {r.killReason}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-xs align-top overflow-hidden">
                  {r.gscClicks.toLocaleString("de-CH")} / {r.gscImpressions.toLocaleString("de-CH")}
                  <div className="text-[10px] text-slate-400">{r.gscPeriod ?? ""}</div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-xs align-top overflow-hidden">
                  {r.aaVisits.toLocaleString("de-CH")} Vis.
                  <div className="text-[10px] text-slate-400">{r.aaFormSuccess} Leads</div>
                </td>
                <td className="px-3 py-2 text-xs align-top overflow-hidden">
                  {r.focusKeywords.length ? (
                    <span className="line-clamp-2 break-words">{r.focusKeywords.join(", ")}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs align-top overflow-hidden">
                  {(labs[r.id] ?? []).length > 0 ? (
                    <span className="line-clamp-2 break-words">
                      {(labs[r.id] ?? [])
                        .slice(0, 5)
                        .map((k) => `${k.keyword} (Pos. ${k.rankGroup}${k.searchVolume != null ? `, ${k.searchVolume}` : ""})`)
                        .join("; ")}
                    </span>
                  ) : r.labsKeywords.length > 0 ? (
                    <span className="line-clamp-2 break-words">{r.labsKeywords.join("; ")}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td
                  className={`px-3 py-2 text-xs align-top overflow-hidden ${
                    r.cleanupStatus === "keep"
                      ? "text-green-700 dark:text-green-400 font-medium"
                      : r.cleanupStatus === "kill"
                        ? "text-red-700 dark:text-red-400 font-medium"
                        : ""
                  }`}
                >
                  {r.cleanupStatus}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 text-sm">
          <span className="text-slate-500">
            Seite {page + 1} / {pageCount}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-40"
            >
              Zurück
            </button>
            <button
              type="button"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((p) => p + 1)}
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-40"
            >
              Weiter
            </button>
          </div>
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => setDetail(null)}>
          <div
            className="w-full max-w-lg h-full overflow-y-auto bg-white dark:bg-slate-900 p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold break-all">{detail.url}</h2>
            <KillBadge score={detail.killConfidence} band={detail.killBand} />
            <p className="text-sm text-slate-600 dark:text-slate-300">{detail.killReason}</p>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-slate-500">GSC Klicks</dt>
              <dd>{detail.gscClicks}</dd>
              <dt className="text-slate-500">GSC Impressions</dt>
              <dd>{detail.gscImpressions}</dd>
              <dt className="text-slate-500">Adobe Visits</dt>
              <dd>{detail.aaVisits}</dd>
              <dt className="text-slate-500">Leads</dt>
              <dd>{detail.aaFormSuccess}</dd>
              <dt className="text-slate-500">Segmente</dt>
              <dd>{detail.aaSegments.join(", ") || "—"}</dd>
              <dt className="text-slate-500">Status</dt>
              <dd>{detail.cleanupStatus}</dd>
            </dl>
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1">Fokuskeywords</div>
              <p className="text-sm">{detail.focusKeywords.join(", ") || "—"}</p>
            </div>
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="mt-4 px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600"
            >
              Schliessen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
