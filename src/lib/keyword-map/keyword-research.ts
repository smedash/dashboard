import { prisma } from "@/lib/prisma";
import { type KeywordSuggestionItem, getKeywordSuggestions } from "@/lib/seospark";
import { getBrandMatcher } from "./brands";

/**
 * Summe der Suchvolumen aller Keywords aus den gecachten SEOSpark-Recherchen (ohne Marken aus der Ausschlussliste).
 * Keywords ohne Recherche fehlen in der Map; es wird nie die API aufgerufen.
 */
export async function loadClusterVolumes(keywords: string[], countryCode: string, languageCode: string): Promise<Map<string, number>> {
  const normalized = [...new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) return new Map();
  const [rows, isBrand] = await Promise.all([
    prisma.keywordSuggestion.findMany({
      where: { keyword: { in: normalized }, countryCode, languageCode },
      select: { keyword: true, suggestions: true },
    }),
    getBrandMatcher(),
  ]);
  const out = new Map<string, number>();
  for (const row of rows) {
    let items: KeywordSuggestionItem[] = [];
    try {
      items = JSON.parse(row.suggestions) as KeywordSuggestionItem[];
    } catch {
      // Defekter Cache-Eintrag zählt wie eine leere Recherche
    }
    out.set(row.keyword, items.reduce((sum, i) => sum + (isBrand(i.keyword) ? 0 : i.searchVolume ?? 0), 0));
  }
  return out;
}

/** Holt die SEOSpark-Recherche zum Fokus-Keyword (Cache, sonst API) im Land/in der Sprache des Projekts. */
export async function researchKeyword(keyword: string, project: { countryCode: string; languageCode: string; category: string | null }) {
  await getKeywordSuggestions(keyword, {
    countryCode: project.countryCode,
    languageCode: project.languageCode,
    category: project.category,
  });
}
