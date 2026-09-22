"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { FilterBar } from "@/components/url-cleanup/FilterBar";
import {
  EMPTY_FILTERS,
  filtersToParams,
  type InventoryFilters,
} from "@/components/url-cleanup/filter-state";
import type { CloudPoint } from "@/components/url-cleanup/Cloud3D";

const Cloud3D = dynamic(
  () => import("@/components/url-cleanup/Cloud3D").then((m) => m.Cloud3D),
  { ssr: false, loading: () => <p className="text-sm text-slate-500">Wolke lädt…</p> }
);

export default function WolkePage() {
  const [filters, setFilters] = useState<InventoryFilters>(EMPTY_FILTERS);
  const [debounced, setDebounced] = useState(filters);
  const [points, setPoints] = useState<CloudPoint[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [facets, setFacets] = useState<{ countries: string[]; languages: string[] }>({
    countries: [],
    languages: [],
  });
  const [sitemaps, setSitemaps] = useState<Array<{ id: string; sitemapUrl: string; countryPath: string | null }>>(
    []
  );

  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters), 400);
    return () => clearTimeout(t);
  }, [filters]);

  useEffect(() => {
    fetch("/api/url-cleanup/dimensions")
      .then((r) => r.json())
      .then((d) => setSitemaps(d.sitemaps ?? []))
      .catch(() => undefined);
    fetch("/api/url-cleanup/inventory?pageSize=1")
      .then((r) => r.json())
      .then((d) => d.facets && setFacets(d.facets))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    const p = filtersToParams(debounced, 0, 25);
    p.delete("page");
    p.delete("pageSize");
    fetch(`/api/url-cleanup/cloud?${p.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setPoints(d.points ?? []);
        setTruncated(Boolean(d.truncated));
      })
      .finally(() => setLoading(false));
  }, [debounced]);

  return (
    <div className="space-y-4">
      <FilterBar filters={filters} onChange={setFilters} facets={facets} sitemaps={sitemaps} />
      {truncated && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Anzeige auf 70.000 Punkte begrenzt — Filter enger setzen für die volle Menge.
        </p>
      )}
      {loading ? (
        <p className="text-sm text-slate-500">Punkte laden…</p>
      ) : (
        <Cloud3D
          points={points}
          country={filters.country}
          onCountryFilter={(code) =>
            setFilters((prev) => ({
              ...prev,
              country: prev.country === code ? "" : code,
            }))
          }
        />
      )}
    </div>
  );
}
