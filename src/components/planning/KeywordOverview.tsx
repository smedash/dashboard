"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useProperty } from "@/contexts/PropertyContext";
import { downloadExcel } from "@/lib/excel-export";

interface KeywordSuggestionItem {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  difficulty: number | null;
  searchIntents: string[] | null;
}

interface KeywordSuggestionResult {
  id: string;
  keyword: string;
  category?: string | null;
  suggestions: KeywordSuggestionItem[];
}

interface FlatKeyword {
  keyword: string;
  seedKeyword: string;
  category: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  difficulty: number | null;
  searchIntents: string[] | null;
  inGsc: boolean;
  gscClicks?: number;
  gscImpressions?: number;
  gscPosition?: number;
}

interface GscKeyword {
  keyword: string;
  clicks: number;
  impressions: number;
  position: number;
}

type SortField = "keyword" | "seedKeyword" | "category" | "searchVolume" | "difficulty" | "cpc" | "competition";
type SortDir = "asc" | "desc";

function IntentBadge({ intent }: { intent: string }) {
  const colors: Record<string, string> = {
    informational: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    navigational: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    commercial: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    transactional: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  };
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[intent] || "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
      {intent.charAt(0).toUpperCase() + intent.slice(1)}
    </span>
  );
}

function DifficultyBar({ value }: { value: number }) {
  const color = value <= 30 ? "bg-green-500" : value <= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{value}</span>
    </div>
  );
}

const PAGE_SIZE = 100;
const OWN_BRAND = { label: "UBS", terms: ["ubs"] };

const COMPETITOR_BRANDS = [
  { label: "ZKB", terms: ["zkb", "zürcher kantonalbank"] },
  { label: "Postfinance", terms: ["postfinance"] },
  { label: "Raiffeisen", terms: ["raiffeisen"] },
  { label: "Migros", terms: ["migros"] },
  { label: "Comparis", terms: ["comparis"] },
];

interface BrandVolume {
  keyword: string;
  volume: number | null;
}

interface ComparisonRow {
  baseTerm: string;
  category: string;
  brands: Record<string, BrandVolume>;
  maxVolume: number;
}

type CompSortField = "baseTerm" | string;

export default function KeywordOverview() {
  const [results, setResults] = useState<KeywordSuggestionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedIntent, setSelectedIntent] = useState<string>("");
  const [selectedSeed, setSelectedSeed] = useState<string>("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [sortField, setSortField] = useState<SortField>("searchVolume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [compSortField, setCompSortField] = useState<CompSortField>("competitorVolume");
  const [compSortDir, setCompSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [gscFilterMode, setGscFilterMode] = useState<"all" | "gaps" | "in_gsc">("all");
  const [ubsVolumes, setUbsVolumes] = useState<Map<string, { searchVolume: number | null; difficulty: number | null }>>(new Map());
  const [ubsVolumesLoading, setUbsVolumesLoading] = useState(false);

  const { selectedProperty } = useProperty();
  const [gscKeywords, setGscKeywords] = useState<Map<string, GscKeyword>>(new Map());
  const [gscLoading, setGscLoading] = useState(false);
  const [gscLoaded, setGscLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/keyword-suggestions");
        if (res.ok) setResults(await res.json());
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const loadGscData = useCallback(async () => {
    if (!selectedProperty || gscLoading) return;
    setGscLoading(true);
    try {
      const res = await fetch(`/api/gsc/queries?siteUrl=${encodeURIComponent(selectedProperty)}&period=90d&limit=25000`);
      if (res.ok) {
        const data = await res.json();
        const kwMap = new Map<string, GscKeyword>();
        for (const row of data.data || []) {
          const kw = (row.keys?.[0] || "").toLowerCase();
          if (kw) {
            kwMap.set(kw, { keyword: kw, clicks: row.clicks, impressions: row.impressions, position: row.position });
          }
        }
        setGscKeywords(kwMap);
        setGscLoaded(true);
      }
    } catch {
      // silently fail
    } finally {
      setGscLoading(false);
    }
  }, [selectedProperty, gscLoading]);

  useEffect(() => {
    if (selectedProperty && !gscLoaded && !gscLoading) {
      loadGscData();
    }
  }, [selectedProperty, gscLoaded, gscLoading, loadGscData]);

  const allKeywords = useMemo<FlatKeyword[]>(() => {
    const flat: FlatKeyword[] = [];
    for (const result of results) {
      for (const s of result.suggestions) {
        const normalized = s.keyword.toLowerCase();
        const gscMatch = gscKeywords.get(normalized);
        const inGsc = !!gscMatch && gscMatch.impressions > 0;
        flat.push({
          keyword: s.keyword,
          seedKeyword: result.keyword,
          category: result.category || "–",
          searchVolume: s.searchVolume,
          cpc: s.cpc,
          competition: s.competition,
          difficulty: s.difficulty,
          searchIntents: s.searchIntents,
          inGsc,
          gscClicks: gscMatch?.clicks,
          gscImpressions: gscMatch?.impressions,
          gscPosition: gscMatch?.position,
        });
      }
    }
    return flat;
  }, [results, gscKeywords]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const kw of allKeywords) {
      map.set(kw.category, (map.get(kw.category) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [allKeywords]);

  const seedKeywords = useMemo(() => {
    const map = new Map<string, number>();
    for (const kw of allKeywords) {
      map.set(kw.seedKeyword, (map.get(kw.seedKeyword) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [allKeywords]);

  const intents = useMemo(() => {
    const set = new Set<string>();
    for (const kw of allKeywords) {
      kw.searchIntents?.forEach((i) => set.add(i));
    }
    return Array.from(set).sort();
  }, [allKeywords]);

  const filteredKeywords = useMemo(() => {
    let result = allKeywords;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (kw) => kw.keyword.toLowerCase().includes(q) || kw.seedKeyword.toLowerCase().includes(q)
      );
    }

    if (selectedCategory) {
      result = result.filter((kw) => kw.category === selectedCategory);
    }

    if (selectedSeed) {
      result = result.filter((kw) => kw.seedKeyword === selectedSeed);
    }

    if (selectedIntent) {
      result = result.filter((kw) => kw.searchIntents?.includes(selectedIntent));
    }

    if (selectedBrands.length > 0) {
      const activeTerms = COMPETITOR_BRANDS
        .filter((b) => selectedBrands.includes(b.label))
        .flatMap((b) => b.terms);
      result = result.filter((kw) => {
        const lower = kw.keyword.toLowerCase();
        return activeTerms.some((term) => lower.includes(term));
      });
    }

    if (gscLoaded && gscFilterMode === "gaps") {
      result = result.filter((kw) => !kw.inGsc);
    } else if (gscLoaded && gscFilterMode === "in_gsc") {
      result = result.filter((kw) => kw.inGsc);
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === "keyword" || sortField === "seedKeyword" || sortField === "category") {
        cmp = (a[sortField] ?? "").localeCompare(b[sortField] ?? "", "de");
      } else {
        const aVal = a[sortField] ?? -1;
        const bVal = b[sortField] ?? -1;
        cmp = (aVal as number) - (bVal as number);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [allKeywords, searchQuery, selectedCategory, selectedSeed, selectedIntent, selectedBrands, gscFilterMode, gscLoaded, sortField, sortDir]);

  const pagedKeywords = useMemo(
    () => filteredKeywords.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredKeywords, page]
  );

  const totalPages = Math.ceil(filteredKeywords.length / PAGE_SIZE);

  // Lookup-Map: keyword (lowercase) → volume from existing suggestions
  const volumeLookup = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const kw of allKeywords) {
      const key = kw.keyword.toLowerCase();
      if (!map.has(key) || (kw.searchVolume != null && map.get(key) == null)) {
        map.set(key, kw.searchVolume);
      }
    }
    return map;
  }, [allKeywords]);

  // All brand labels in the comparison (selected competitors + UBS)
  const compBrandColumns = useMemo(
    () => [OWN_BRAND.label, ...selectedBrands],
    [selectedBrands]
  );

  // Build pivot rows: one row per baseTerm, columns per brand
  const comparisonRows = useMemo<ComparisonRow[]>(() => {
    if (!comparisonMode || selectedBrands.length === 0) return [];

    const rowMap = new Map<string, ComparisonRow>();

    for (const kw of filteredKeywords) {
      const lower = kw.keyword.toLowerCase();

      for (const brand of COMPETITOR_BRANDS) {
        if (!selectedBrands.includes(brand.label)) continue;

        const matchedTerm = brand.terms.find((t) => lower.includes(t));
        if (!matchedTerm) continue;

        const baseTerm = lower.replace(matchedTerm, "").replace(/\s+/g, " ").trim();
        if (!baseTerm) continue;

        let row = rowMap.get(baseTerm);
        if (!row) {
          row = { baseTerm, category: kw.category, brands: {}, maxVolume: -1 };
          rowMap.set(baseTerm, row);
        }

        if (!row.brands[brand.label]) {
          row.brands[brand.label] = { keyword: kw.keyword, volume: kw.searchVolume };
          if (kw.searchVolume != null && kw.searchVolume > row.maxVolume) {
            row.maxVolume = kw.searchVolume;
          }
        }

        // UBS equivalent
        if (!row.brands[OWN_BRAND.label]) {
          const ownKw = `ubs ${baseTerm}`;
          const vol = volumeLookup.get(ownKw) ?? ubsVolumes.get(ownKw)?.searchVolume ?? null;
          row.brands[OWN_BRAND.label] = { keyword: ownKw, volume: vol };
          if (vol != null && vol > row.maxVolume) {
            row.maxVolume = vol;
          }
        }
      }
    }

    return Array.from(rowMap.values());
  }, [comparisonMode, selectedBrands, filteredKeywords, volumeLookup, ubsVolumes]);

  // Fetch missing UBS volumes
  useEffect(() => {
    if (!comparisonMode || comparisonRows.length === 0) return;

    const missing: string[] = [];
    for (const row of comparisonRows) {
      const ubsEntry = row.brands[OWN_BRAND.label];
      if (ubsEntry && ubsEntry.volume == null && !volumeLookup.has(ubsEntry.keyword) && !ubsVolumes.has(ubsEntry.keyword)) {
        missing.push(ubsEntry.keyword);
      }
    }

    const unique = [...new Set(missing)];
    if (unique.length === 0) return;

    setUbsVolumesLoading(true);
    fetch("/api/keyword-volume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: unique }),
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data?.data) return;
        setUbsVolumes((prev) => {
          const next = new Map(prev);
          for (const [key, val] of Object.entries(data.data) as [string, { searchVolume: number | null }][]) {
            next.set(key, { searchVolume: val.searchVolume, difficulty: null });
          }
          for (const kw of unique) {
            if (!next.has(kw)) next.set(kw, { searchVolume: null, difficulty: null });
          }
          return next;
        });
      })
      .catch(() => {})
      .finally(() => setUbsVolumesLoading(false));
  }, [comparisonMode, comparisonRows.length]);

  const sortedComparisonRows = useMemo(() => {
    return [...comparisonRows].sort((a, b) => {
      if (compSortField === "baseTerm") {
        const cmp = a.baseTerm.localeCompare(b.baseTerm, "de");
        return compSortDir === "asc" ? cmp : -cmp;
      }
      // Sort by a brand column volume
      const aVal = a.brands[compSortField]?.volume ?? -1;
      const bVal = b.brands[compSortField]?.volume ?? -1;
      const cmp = aVal - bVal;
      return compSortDir === "asc" ? cmp : -cmp;
    });
  }, [comparisonRows, compSortField, compSortDir]);

  const pagedComparisonRows = useMemo(
    () => sortedComparisonRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sortedComparisonRows, page]
  );

  const compTotalPages = Math.ceil(sortedComparisonRows.length / PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [searchQuery, selectedCategory, selectedSeed, selectedIntent, selectedBrands, comparisonMode, gscFilterMode]);

  const gapCount = useMemo(() => allKeywords.filter((kw) => !kw.inGsc).length, [allKeywords]);
  const inGscCount = useMemo(() => allKeywords.filter((kw) => kw.inGsc).length, [allKeywords]);

  function handleCompSort(field: string) {
    if (compSortField === field) {
      setCompSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setCompSortField(field);
      setCompSortDir(field === "baseTerm" ? "asc" : "desc");
    }
  }

  function CompSortIcon({ field }: { field: string }) {
    if (compSortField !== field) {
      return (
        <svg className="w-3 h-3 ml-1 inline opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3 ml-1 inline text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={compSortDir === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
      </svg>
    );
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "keyword" || field === "seedKeyword" || field === "category" ? "asc" : "desc");
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) {
      return (
        <svg className="w-3 h-3 ml-1 inline opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3 ml-1 inline text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDir === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
      </svg>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center">
        <svg className="w-8 h-8 mx-auto animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Keywords werden geladen...</p>
      </div>
    );
  }

  if (allKeywords.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center">
        <svg className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-white">Noch keine Keywords recherchiert</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Wechsle zum Tab &ldquo;Keyword Research&rdquo;, um Keyword-Vorschläge abzurufen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter-Leiste */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Keyword oder Seed-Keyword suchen..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Alle Kategorien</option>
          {categories.map((cat) => (
            <option key={cat.name} value={cat.name}>
              {cat.name} ({cat.count})
            </option>
          ))}
        </select>

        <select
          value={selectedSeed}
          onChange={(e) => setSelectedSeed(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Alle Seed-Keywords</option>
          {seedKeywords.map((sk) => (
            <option key={sk.name} value={sk.name}>
              {sk.name} ({sk.count})
            </option>
          ))}
        </select>

        {intents.length > 0 && (
          <select
            value={selectedIntent}
            onChange={(e) => setSelectedIntent(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Alle Intents</option>
            {intents.map((i) => (
              <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
            ))}
          </select>
        )}

        {(searchQuery || selectedCategory || selectedSeed || selectedIntent || selectedBrands.length > 0 || gscFilterMode !== "all") && (
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("");
              setSelectedSeed("");
              setSelectedIntent("");
              setSelectedBrands([]);
              setGscFilterMode("all");
            }}
            className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {/* Wettbewerber-Brand-Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">Wettbewerber:</span>
        {COMPETITOR_BRANDS.map((brand) => {
          const isActive = selectedBrands.includes(brand.label);
          return (
            <button
              key={brand.label}
              onClick={() => {
                setSelectedBrands((prev) =>
                  prev.includes(brand.label)
                    ? prev.filter((b) => b !== brand.label)
                    : [...prev, brand.label]
                );
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                isActive
                  ? "bg-red-600 border-red-600 text-white"
                  : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-red-400 hover:text-red-600 dark:hover:text-red-400"
              }`}
            >
              {brand.label}
            </button>
          );
        })}
        {selectedBrands.length > 0 && (
          <>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              ({filteredKeywords.length.toLocaleString("de-CH")} Treffer)
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setComparisonMode(!comparisonMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  comparisonMode
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                vs. UBS vergleichen
              </button>
            </div>
          </>
        )}
      </div>

      {/* Statistik + GSC-Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700/50 text-xs font-medium text-slate-600 dark:text-slate-300">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
            {filteredKeywords.length.toLocaleString("de-CH")} von {allKeywords.length.toLocaleString("de-CH")} Keywords
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-xs font-medium text-amber-700 dark:text-amber-300">
            {categories.length} Kategorien
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-medium text-blue-700 dark:text-blue-300">
            {seedKeywords.length} Seed-Keywords
          </span>
        </div>

        {gscLoaded && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">GSC:</span>
            <button
              onClick={() => setGscFilterMode("all")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                gscFilterMode === "all"
                  ? "bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900"
                  : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
              }`}
            >
              Alle
            </button>
            <button
              onClick={() => setGscFilterMode("gaps")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                gscFilterMode === "gaps"
                  ? "bg-orange-600 text-white"
                  : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50"
              }`}
            >
              Gaps ({gapCount.toLocaleString("de-CH")})
            </button>
            <button
              onClick={() => setGscFilterMode("in_gsc")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                gscFilterMode === "in_gsc"
                  ? "bg-green-600 text-white"
                  : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50"
              }`}
            >
              In GSC ({inGscCount.toLocaleString("de-CH")})
            </button>
          </div>
        )}
        {gscLoading && (
          <div className="flex items-center gap-2 ml-auto">
            <svg className="w-3.5 h-3.5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs text-slate-500 dark:text-slate-400">GSC-Daten laden...</span>
          </div>
        )}
      </div>

      {/* Kategorie-Pills */}
      {!selectedCategory && categories.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
            >
              {cat.name} <span className="opacity-60">({cat.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Vergleichstabelle ODER normale Tabelle */}
      {comparisonMode && selectedBrands.length > 0 ? (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Brand-Vergleich: {OWN_BRAND.label} vs. {selectedBrands.join(", ")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {sortedComparisonRows.length} Suchbegriffe verglichen
                  {ubsVolumesLoading && " · UBS-Volumen werden geladen..."}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const rows = sortedComparisonRows.map((row) => {
                  const obj: Record<string, unknown> = {
                    Suchbegriff: row.baseTerm,
                    Kategorie: row.category,
                  };
                  for (const brand of compBrandColumns) {
                    const entry = row.brands[brand];
                    obj[`${brand} Keyword`] = entry?.keyword ?? "";
                    obj[`${brand} Suchvolumen`] = entry?.volume ?? "";
                  }
                  const vols = compBrandColumns.map((b) => row.brands[b]?.volume).filter((v): v is number => v != null);
                  obj["Gewinner"] = vols.length > 0
                    ? compBrandColumns.find((b) => row.brands[b]?.volume === Math.max(...vols)) ?? ""
                    : "";
                  return obj;
                });
                const date = new Date().toISOString().slice(0, 10);
                downloadExcel(`brand-vergleich-${date}.xlsx`, [{ name: "Brand-Vergleich", rows }]);
              }}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Excel Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none"
                    onClick={() => handleCompSort("baseTerm")}
                  >
                    Suchbegriff <CompSortIcon field="baseTerm" />
                  </th>
                  {compBrandColumns.map((brand) => (
                    <th
                      key={brand}
                      className={`px-4 py-3 text-right text-xs font-semibold uppercase cursor-pointer select-none transition-colors ${
                        brand === OWN_BRAND.label
                          ? "text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                          : "text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      }`}
                      onClick={() => handleCompSort(brand)}
                    >
                      {brand} <CompSortIcon field={brand} />
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                    Kat.
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {pagedComparisonRows.length === 0 ? (
                  <tr>
                    <td colSpan={compBrandColumns.length + 2} className="px-4 py-12 text-center">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Keine Suchbegriffe zum Vergleich gefunden.
                      </p>
                    </td>
                  </tr>
                ) : (
                  pagedComparisonRows.map((row, idx) => {
                    const max = row.maxVolume;
                    return (
                      <tr key={`${row.baseTerm}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                          {row.baseTerm}
                        </td>
                        {compBrandColumns.map((brand) => {
                          const entry = row.brands[brand];
                          const vol = entry?.volume;
                          const isWinner = vol != null && vol > 0 && vol === max;
                          return (
                            <td key={brand} className="px-4 py-2.5 text-right tabular-nums">
                              {vol != null ? (
                                <span
                                  className={`font-medium ${isWinner ? "text-green-600 dark:text-green-400" : "text-slate-600 dark:text-slate-300"}`}
                                  title={entry?.keyword}
                                >
                                  {vol.toLocaleString("de-CH")}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs" title={entry?.keyword}>k.A.</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2.5">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            {row.category}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {compTotalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Seite {page + 1} von {compTotalPages} ({sortedComparisonRows.length} Begriffe)
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(0)} disabled={page === 0} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">&laquo;</button>
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">&lsaquo;</button>
                <button onClick={() => setPage((p) => Math.min(compTotalPages - 1, p + 1))} disabled={page >= compTotalPages - 1} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">&rsaquo;</button>
                <button onClick={() => setPage(compTotalPages - 1)} disabled={page >= compTotalPages - 1} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">&raquo;</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Normale Tabelle */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none"
                      onClick={() => handleSort("keyword")}
                    >
                      Keyword <SortIcon field="keyword" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none"
                      onClick={() => handleSort("seedKeyword")}
                    >
                      Seed-Keyword <SortIcon field="seedKeyword" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none"
                      onClick={() => handleSort("category")}
                    >
                      Kategorie <SortIcon field="category" />
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none"
                      onClick={() => handleSort("searchVolume")}
                    >
                      Suchvol. <SortIcon field="searchVolume" />
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none"
                      onClick={() => handleSort("difficulty")}
                    >
                      Difficulty <SortIcon field="difficulty" />
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none"
                      onClick={() => handleSort("cpc")}
                    >
                      CPC <SortIcon field="cpc" />
                    </th>
                    <th
                      className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none"
                      onClick={() => handleSort("competition")}
                    >
                      Comp. <SortIcon field="competition" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                      Intent
                    </th>
                    {gscLoaded && (
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                        GSC
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {pagedKeywords.length === 0 ? (
                    <tr>
                      <td colSpan={gscLoaded ? 9 : 8} className="px-4 py-12 text-center">
                        <svg className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                          Keine Keywords gefunden, die den Filtern entsprechen.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    pagedKeywords.map((kw, idx) => (
                      <tr key={`${kw.seedKeyword}-${kw.keyword}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">
                          {kw.keyword}
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300 text-xs">
                          {kw.seedKeyword}
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            {kw.category}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-300 tabular-nums">
                          {kw.searchVolume != null ? kw.searchVolume.toLocaleString("de-CH") : "–"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {kw.difficulty != null ? <DifficultyBar value={kw.difficulty} /> : <span className="text-slate-400">–</span>}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-300 tabular-nums">
                          {kw.cpc != null ? `$${kw.cpc.toFixed(2)}` : "–"}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-300 tabular-nums">
                          {kw.competition != null ? (kw.competition * 100).toFixed(0) + "%" : "–"}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-0.5">
                            {kw.searchIntents?.map((intent, i) => (
                              <IntentBadge key={i} intent={intent} />
                            )) || <span className="text-slate-400">–</span>}
                          </div>
                        </td>
                        {gscLoaded && (
                          <td className="px-4 py-2 text-center">
                            {kw.inGsc ? (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                title={`Pos. ${kw.gscPosition?.toFixed(1)} | ${kw.gscClicks} Clicks | ${kw.gscImpressions} Imp.`}
                              >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                GSC
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                                Gap
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Seite {page + 1} von {totalPages} ({filteredKeywords.length.toLocaleString("de-CH")} Keywords)
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(0)} disabled={page === 0} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">&laquo;</button>
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">&lsaquo;</button>
                  <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">&rsaquo;</button>
                  <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">&raquo;</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
