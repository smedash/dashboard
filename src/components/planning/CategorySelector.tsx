"use client";

import { useState, useEffect, useCallback } from "react";

interface SeedKeyword {
  id: string;
  keyword: string;
  fullName: string | null;
  category: string;
  type: string | null;
  url: string | null;
}

interface Category {
  name: string;
  count: number;
}

interface CategorySelectorProps {
  onSelectKeyword: (keyword: string, category: string) => void;
  actionLabel?: string;
}

export default function CategorySelector({
  onSelectKeyword,
  actionLabel = "Starten",
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [seedKeywords, setSeedKeywords] = useState<SeedKeyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      const res = await fetch("/api/seed-keywords/categories");
      if (res.ok) {
        const data: Category[] = await res.json();
        setCategories(data);
      }
    } catch {
      // silently fail
    }
  }

  const fetchKeywords = useCallback(async (category: string) => {
    if (!category) {
      setSeedKeywords([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/seed-keywords?category=${encodeURIComponent(category)}`
      );
      if (res.ok) {
        const data: SeedKeyword[] = await res.json();
        setSeedKeywords(data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  function handleCategoryChange(category: string) {
    setSelectedCategory(category);
    fetchKeywords(category);
  }

  if (categories.length === 0) return null;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg
            className="w-5 h-5 text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <span className="text-sm font-semibold text-white">
            Seed-Keywords nach Kategorie
          </span>
          {selectedCategory && (
            <span className="text-xs text-slate-400">
              — {selectedCategory} ({seedKeywords.length})
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {expanded && (
        <div className="px-6 pb-5 border-t border-slate-700 pt-4">
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => handleCategoryChange(cat.name)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  selectedCategory === cat.name
                    ? "bg-amber-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white"
                }`}
              >
                {cat.name}{" "}
                <span className="opacity-60">({cat.count})</span>
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Lade Keywords...
            </div>
          )}

          {!loading && selectedCategory && seedKeywords.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-1">
              {seedKeywords.map((sk) => (
                <button
                  key={sk.id}
                  onClick={() => onSelectKeyword(sk.keyword, sk.category)}
                  className="group flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all text-left"
                >
                  <span className="flex-1 text-sm text-slate-300 group-hover:text-white truncate">
                    {sk.keyword}
                  </span>
                  {sk.type && (
                    <span
                      className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        sk.type === "Produkt/Angebot"
                          ? "bg-blue-900/40 text-blue-300"
                          : sk.type === "Service"
                            ? "bg-emerald-900/40 text-emerald-300"
                            : "bg-purple-900/40 text-purple-300"
                      }`}
                    >
                      {sk.type}
                    </span>
                  )}
                  <svg
                    className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 flex-shrink-0 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </button>
              ))}
            </div>
          )}

          {!loading && selectedCategory && seedKeywords.length === 0 && (
            <p className="text-sm text-slate-500 py-2">
              Keine Seed-Keywords in dieser Kategorie gefunden.
            </p>
          )}

          {!selectedCategory && (
            <p className="text-sm text-slate-500 py-2">
              Waehle eine Kategorie, um die zugehoerigen Seed-Keywords zu sehen.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
