"use client";

import { useMessages } from "@/i18n/I18nProvider";
import { urlCleanupMessages } from "@/i18n/messages/url-cleanup";
import type { InventoryFilters } from "./filter-state";

type Facets = { countries: string[]; languages: string[] };
type Sitemap = { id: string; sitemapUrl: string; countryPath: string | null };

export function FilterBar({
  filters,
  onChange,
  facets,
  sitemaps,
}: {
  filters: InventoryFilters;
  onChange: (next: InventoryFilters) => void;
  facets: Facets;
  sitemaps: Sitemap[];
}) {
  const t = useMessages(urlCleanupMessages);
  const set = (k: keyof InventoryFilters, v: string) => onChange({ ...filters, [k]: v });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {[
          { id: "", label: t.filters.presets.all },
          { id: "high", label: t.filters.presets.high },
          { id: "zero", label: t.filters.presets.zero },
          { id: "protected", label: t.filters.presets.protected },
        ].map((p) => (
          <button
            key={p.id || "all"}
            type="button"
            onClick={() => onChange({ ...filters, preset: p.id })}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border ${
              filters.preset === p.id
                ? "bg-blue-600 text-white border-blue-600"
                : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <input
          value={filters.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder={t.filters.searchPlaceholder}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        />
        <select
          value={filters.country}
          onChange={(e) => set("country", e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        >
          <option value="">{t.filters.allCountries}</option>
          {facets.countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filters.language}
          onChange={(e) => set("language", e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        >
          <option value="">{t.filters.allLanguages}</option>
          {facets.languages.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filters.sitemapId}
          onChange={(e) => set("sitemapId", e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        >
          <option value="">{t.filters.allSitemaps}</option>
          {sitemaps.map((s) => (
            <option key={s.id} value={s.id}>
              {s.countryPath || s.sitemapUrl.replace("https://www.ubs.com/", "")}
            </option>
          ))}
        </select>
        <Tri label={t.filters.gscData} value={filters.gscHasData} onChange={(v) => set("gscHasData", v)} />
        <Tri label={t.filters.adobeData} value={filters.aaHasData} onChange={(v) => set("aaHasData", v)} />
        <Tri label={t.filters.timeSpent} value={filters.aaTimeSpentHasData} onChange={(v) => set("aaTimeSpentHasData", v)} />
        <Tri label={t.filters.gatingData} value={filters.gatingHasData} onChange={(v) => set("gatingHasData", v)} />
        <Tri label={t.filters.gated} value={filters.gatingIsGated} onChange={(v) => set("gatingIsGated", v)} />
        <select
          value={filters.aaSegment}
          onChange={(e) => set("aaSegment", e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        >
          <option value="">{t.filters.adobeSegmentAny}</option>
          {["AM", "WM", "IB", "About_us", "Swiss_website"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filters.gatingRole}
          onChange={(e) => set("gatingRole", e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        >
          <option value="">{t.filters.gatingRoleAny}</option>
          {["institutional-investor", "distribution-partner", "private-investor", "liquidity-investor"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          max={100}
          inputMode="numeric"
          value={filters.minTimeSpentShortPct}
          onChange={(e) => set("minTimeSpentShortPct", clampScore(e.target.value))}
          placeholder={t.filters.minShortPctPlaceholder}
          aria-label={t.filters.minShortPctLabel}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        />
        <select
          value={filters.killBand}
          onChange={(e) => set("killBand", e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        >
          <option value="">{t.filters.confidenceBand}</option>
          <option value="high">high (≥ 75)</option>
          <option value="medium">medium (50–74)</option>
          <option value="low">low (1–49)</option>
          <option value="keep">keep (0)</option>
          <option value="protected">{t.filters.protectedBand}</option>
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            value={filters.minKillConfidence}
            onChange={(e) => set("minKillConfidence", clampScore(e.target.value))}
            placeholder={t.filters.minConfidencePlaceholder}
            aria-label={t.filters.minConfidenceLabel}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
          />
          <input
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            value={filters.maxKillConfidence}
            onChange={(e) => set("maxKillConfidence", clampScore(e.target.value))}
            placeholder={t.filters.maxConfidencePlaceholder}
            aria-label={t.filters.maxConfidenceLabel}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
          />
        </div>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={filters.minGscClicks}
          onChange={(e) => set("minGscClicks", nonNegInt(e.target.value))}
          placeholder={t.filters.minGscClicksPlaceholder}
          aria-label={t.filters.minGscClicksLabel}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        />
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={filters.minAaVisits}
          onChange={(e) => set("minAaVisits", nonNegInt(e.target.value))}
          placeholder={t.filters.minAaVisitsPlaceholder}
          aria-label={t.filters.minAaVisitsLabel}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        />
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={filters.minAaFormSuccess}
          onChange={(e) => set("minAaFormSuccess", nonNegInt(e.target.value))}
          placeholder={t.filters.minLeadsPlaceholder}
          aria-label={t.filters.minLeadsLabel}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        />
        <Tri label={t.filters.focusKeyword} value={filters.hasFocusKeywords} onChange={(v) => set("hasFocusKeywords", v)} />
        <Tri label={t.filters.editorialPlan} value={filters.inEditorialPlan} onChange={(v) => set("inEditorialPlan", v)} />
        <select
          value={filters.labsHasData}
          onChange={(e) => set("labsHasData", e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        >
          <option value="">{t.filters.rankedKeywordsAll}</option>
          <option value="true">{t.filters.withRankings}</option>
          <option value="false">{t.filters.withoutRankings}</option>
        </select>
        <select
          value={filters.cleanupStatus}
          onChange={(e) => set("cleanupStatus", e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        >
          <option value="">{t.filters.status}</option>
          <option value="kill">Kill</option>
          <option value="candidate">Candidate</option>
          <option value="keep">Keep</option>
          <option value="mustKeep">MustKeep</option>
        </select>
      </div>
    </div>
  );
}

function nonNegInt(raw: string): string {
  if (raw === "") return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";
  return String(Math.max(0, Math.round(n)));
}

function clampScore(raw: string): string {
  if (raw === "") return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return "";
  return String(Math.min(100, Math.max(0, Math.round(n))));
}

function Tri({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useMessages(urlCleanupMessages);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
    >
      <option value="">{t.filters.triAll(label)}</option>
      <option value="true">{t.filters.triYes(label)}</option>
      <option value="false">{t.filters.triNo(label)}</option>
    </select>
  );
}
