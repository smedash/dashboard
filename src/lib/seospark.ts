import { prisma } from "@/lib/prisma";

const SEOSPARK_API_URL = "https://api.seospark.io/v2";

interface SeosparkKeywordItem {
  keyword: string;
  search_volume: number | null;
  cpc: number | null;
  competition: number | null;
  difficulty: number | null;
  search_intents: { label: string; probability: number | null }[] | null;
  serp_features: string[] | null;
  monthly_searches: { month: string; volume: number | null }[] | null;
  metrics_updated_at: string | null;
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

async function seosparkRequest(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.status !== "success") {
    throw new SeosparkError(
      data?.message || `SEOspark API Fehler: ${res.status}`,
      res.ok ? 502 : res.status
    );
  }
  return data;
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

  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Accept-Encoding": "gzip",
  };

  const research = await seosparkRequest(`${SEOSPARK_API_URL}/keyword-research`, {
    method: "POST",
    headers,
    body: JSON.stringify({ keyword: normalizedKeyword, country_code: cc, language_code: lc }),
  });
  const runId: string | undefined = research.data?.run?.id;
  if (!runId) {
    throw new SeosparkError("SEOspark API Fehler: keine Run-ID erhalten", 502);
  }

  const params = new URLSearchParams({ page_index: "0", page_size: "100", sort: "searchVolume,desc" });
  const suggestionsData = await seosparkRequest(
    `${SEOSPARK_API_URL}/keyword-research/${runId}/suggestions?${params}`,
    { headers }
  );

  const items: SeosparkKeywordItem[] = suggestionsData.data?.keywords?.items || [];
  const totalCount = suggestionsData.data?.keywords?.total_count || 0;

  const suggestions: KeywordSuggestionItem[] = items.map((item) => ({
    keyword: item.keyword,
    searchVolume: item.search_volume ?? null,
    cpc: item.cpc ?? null,
    competition: item.competition ?? null,
    difficulty: item.difficulty ?? null,
    searchIntents: item.search_intents?.map((i) => i.label) ?? null,
    serpItemTypes: item.serp_features ?? [],
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
