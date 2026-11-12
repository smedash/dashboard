import { prisma } from "@/lib/prisma";

const SEOSPARK_API_URL = "https://api.seospark.io/v1/keywords/suggest";

interface SeosparkKeywordItem {
  keyword: string;
  metrics: {
    updated_at: string;
    average_search_volume: number | null;
    competition: number | null;
    cpc: number | null;
    keyword_difficulty: number | null;
    search_intents: string[] | null;
    serp_item_types: string[];
    serp_results_count: number | null;
    daily_impressions_average: number | null;
    search_volume_history: { period_start: string; value: number }[];
  } | null;
}

export interface KeywordSuggestionItem {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
  difficulty: number | null;
  searchIntents: string[] | null;
  serpItemTypes: string[];
}

export interface KeywordSuggestionResult {
  id: string;
  keyword: string;
  countryCode: string;
  languageCode: string;
  totalCount: number;
  suggestions: KeywordSuggestionItem[];
  category: string | null;
  createdAt: string;
  cached: boolean;
}

export class SeosparkError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** SEOSpark-Vorschläge zu einem Keyword, gecacht in `KeywordSuggestion` (pro Keyword/Land/Sprache). */
export async function getKeywordSuggestions(
  keyword: string,
  options?: { countryCode?: string; languageCode?: string; category?: string | null }
): Promise<KeywordSuggestionResult> {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const cc = options?.countryCode ?? "ch";
  const lc = options?.languageCode ?? "de";
  const category = options?.category ?? null;

  const existing = await prisma.keywordSuggestion.findUnique({
    where: {
      keyword_countryCode_languageCode: { keyword: normalizedKeyword, countryCode: cc, languageCode: lc },
    },
  });

  if (existing) {
    if (category && !existing.category) {
      await prisma.keywordSuggestion.update({ where: { id: existing.id }, data: { category } });
    }
    return {
      id: existing.id,
      keyword: existing.keyword,
      countryCode: existing.countryCode,
      languageCode: existing.languageCode,
      totalCount: existing.totalCount,
      suggestions: JSON.parse(existing.suggestions),
      category: category || existing.category,
      createdAt: existing.createdAt.toISOString(),
      cached: true,
    };
  }

  const apiKey = process.env.SEOSPARK_API_KEY;
  if (!apiKey) {
    throw new SeosparkError("SEOSPARK_API_KEY nicht konfiguriert", 500);
  }

  const seosparkRes = await fetch(SEOSPARK_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip",
    },
    body: JSON.stringify({
      country_code: cc,
      language_code: lc,
      keyword: normalizedKeyword,
      page_size: 100,
      sort: "searchVolume,desc",
    }),
  });

  if (!seosparkRes.ok) {
    const errData = await seosparkRes.json().catch(() => null);
    throw new SeosparkError(errData?.message || `SEOspark API Fehler: ${seosparkRes.status}`, seosparkRes.status);
  }

  const seosparkData = await seosparkRes.json();
  if (seosparkData.status !== "success") {
    throw new SeosparkError(seosparkData.message || "SEOspark API Fehler", 500);
  }

  const items: SeosparkKeywordItem[] = seosparkData.data?.keywords?.items || [];
  const totalCount = seosparkData.data?.keywords?.meta?.total_count || 0;

  const suggestions: KeywordSuggestionItem[] = items.map((item) => ({
    keyword: item.keyword,
    searchVolume: item.metrics?.average_search_volume ?? null,
    cpc: item.metrics?.cpc ?? null,
    competition: item.metrics?.competition ?? null,
    difficulty: item.metrics?.keyword_difficulty ?? null,
    searchIntents: item.metrics?.search_intents ?? null,
    serpItemTypes: item.metrics?.serp_item_types ?? [],
  }));

  const saved = await prisma.keywordSuggestion.create({
    data: {
      keyword: normalizedKeyword,
      countryCode: cc,
      languageCode: lc,
      totalCount,
      suggestions: JSON.stringify(suggestions),
      category: category || null,
    },
  });

  return {
    id: saved.id,
    keyword: saved.keyword,
    countryCode: saved.countryCode,
    languageCode: saved.languageCode,
    totalCount: saved.totalCount,
    suggestions,
    category: saved.category,
    createdAt: saved.createdAt.toISOString(),
    cached: false,
  };
}
