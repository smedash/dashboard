"use client";

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
  const set = (k: keyof InventoryFilters, v: string) => onChange({ ...filters, [k]: v });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {[
          { id: "", label: "Alle" },
          { id: "high", label: "Kill-Kandidaten (high)" },
          { id: "zero", label: "0/0/0 Traffic" },
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
          placeholder="URL / Pfad…"
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        />
        <select
          value={filters.country}
          onChange={(e) => set("country", e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        >
          <option value="">Alle Länder</option>
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
          <option value="">Alle Sprachen</option>
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
          <option value="">Alle Sitemaps</option>
          {sitemaps.map((s) => (
            <option key={s.id} value={s.id}>
              {s.countryPath || s.sitemapUrl.replace("https://www.ubs.com/", "")}
            </option>
          ))}
        </select>
        <Tri label="GSC-Daten" value={filters.gscHasData} onChange={(v) => set("gscHasData", v)} />
        <Tri label="Adobe-Daten" value={filters.aaHasData} onChange={(v) => set("aaHasData", v)} />
        <select
          value={filters.aaSegment}
          onChange={(e) => set("aaSegment", e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        >
          <option value="">Adobe-Segment (any)</option>
          {["AM", "WM", "IB", "About_us", "Swiss_website"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filters.killBand}
          onChange={(e) => set("killBand", e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        >
          <option value="">Konfidenz-Band</option>
          <option value="high">high (≥ 75)</option>
          <option value="medium">medium (50–74)</option>
          <option value="low">low (1–49)</option>
          <option value="keep">keep (0)</option>
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            value={filters.minKillConfidence}
            onChange={(e) => set("minKillConfidence", clampScore(e.target.value))}
            placeholder="Konfidenz ab"
            aria-label="Konfidenz mindestens"
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
          />
          <input
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            value={filters.maxKillConfidence}
            onChange={(e) => set("maxKillConfidence", clampScore(e.target.value))}
            placeholder="Konfidenz bis"
            aria-label="Konfidenz höchstens"
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
          />
        </div>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={filters.minGscClicks}
          onChange={(e) => set("minGscClicks", nonNegInt(e.target.value))}
          placeholder="Min. GSC-Klicks"
          aria-label="Mindestens GSC-Klicks"
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        />
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={filters.minAaVisits}
          onChange={(e) => set("minAaVisits", nonNegInt(e.target.value))}
          placeholder="Min. Adobe-Visits"
          aria-label="Mindestens Adobe-Visits"
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        />
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={filters.minAaFormSuccess}
          onChange={(e) => set("minAaFormSuccess", nonNegInt(e.target.value))}
          placeholder="Min. Leads"
          aria-label="Mindestens Adobe-Leads"
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        />
        <Tri label="Fokuskeyword" value={filters.hasFocusKeywords} onChange={(v) => set("hasFocusKeywords", v)} />
        <Tri label="Redaktionsplan" value={filters.inEditorialPlan} onChange={(v) => set("inEditorialPlan", v)} />
        <select
          value={filters.labsHasData}
          onChange={(e) => set("labsHasData", e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        >
          <option value="">ranked Keywords: alle</option>
          <option value="true">mit Rankings</option>
          <option value="false">ohne Rankings</option>
        </select>
        <select
          value={filters.cleanupStatus}
          onChange={(e) => set("cleanupStatus", e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        >
          <option value="">Status</option>
          <option value="none">none</option>
          <option value="candidate">candidate</option>
          <option value="keep">keep</option>
          <option value="kill">kill</option>
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
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
    >
      <option value="">{label}: alle</option>
      <option value="true">{label}: ja</option>
      <option value="false">{label}: nein</option>
    </select>
  );
}
