import { prisma } from "@/lib/prisma";
import { fetchSearchVolume } from "@/lib/dataforseo";

/** DataForSEO-Location-Codes und die Namen, unter denen `KeywordVolume` cached */
const LOCATIONS: Record<string, { name: string; code: number }> = {
  ch: { name: "Switzerland", code: 2756 },
  de: { name: "Germany", code: 2276 },
  at: { name: "Austria", code: 2040 },
  fr: { name: "France", code: 2250 },
  it: { name: "Italy", code: 2380 },
  li: { name: "Liechtenstein", code: 2438 },
  gb: { name: "United Kingdom", code: 2826 },
  us: { name: "United States", code: 2840 },
};
const LANGUAGES: Record<string, string> = { de: "German", fr: "French", it: "Italian", en: "English" };
const DFS_BATCH = 100;
/** Abstand zwischen DataForSEO-Requests wie in `fetchSearchVolume` (Rate-Limit des Live-Endpunkts) */
const DFS_PAUSE_MS = 6000;

export interface VolumeLocale {
  location: string;
  language: string;
  locationCode: number;
  languageCode: string;
}

export function volumeLocale(countryCode: string, languageCode: string): VolumeLocale | null {
  const location = LOCATIONS[countryCode.toLowerCase()];
  const language = LANGUAGES[languageCode.toLowerCase()];
  if (!location || !language) return null;
  return { location: location.name, language, locationCode: location.code, languageCode: languageCode.toLowerCase() };
}

/** Gecachte Google-Ads-Suchvolumen; Keywords ohne Cache-Eintrag fehlen, abgefragte ohne Volumen haben 0. */
export async function loadKeywordVolumes(keywords: string[], locale: VolumeLocale): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < keywords.length; i += 5000) {
    const rows = await prisma.keywordVolume.findMany({
      where: { keyword: { in: keywords.slice(i, i + 5000) }, location: locale.location, language: locale.language },
      select: { keyword: true, searchVolume: true },
    });
    for (const r of rows) out.set(r.keyword, r.searchVolume ?? 0);
  }
  return out;
}

/**
 * Fragt bis zu `limit` Keywords ohne Cache-Eintrag bei DataForSEO ab und cached sie in `KeywordVolume`
 * (auch ohne Ergebnis, damit sie nicht erneut abgefragt werden).
 */
export async function fetchMissingKeywordVolumes(keywords: string[], locale: VolumeLocale, limit: number) {
  const cached = await loadKeywordVolumes(keywords, locale);
  const missing = keywords.filter((k) => !cached.has(k));
  const todo = missing.slice(0, limit);
  let fetched = 0;
  let failed = 0;

  for (let i = 0; i < todo.length; i += DFS_BATCH) {
    if (i > 0) await new Promise((r) => setTimeout(r, DFS_PAUSE_MS));
    const batch = todo.slice(i, i + DFS_BATCH);
    const results = await fetchSearchVolume(batch, undefined, undefined, {
      locationCode: locale.locationCode,
      languageCode: locale.languageCode,
    });
    // fetchSearchVolume protokolliert Fehler nur; ohne Antwort wird nichts gecacht, sonst gälten die Keywords als volumenlos
    if (results.length === 0) {
      failed += batch.length;
      continue;
    }
    const byKeyword = new Map(results.map((r) => [r.keyword.toLowerCase(), r]));
    await prisma.keywordVolume.createMany({
      data: batch.map((keyword) => {
        const r = byKeyword.get(keyword);
        return {
          keyword,
          location: locale.location,
          language: locale.language,
          searchVolume: typeof r?.search_volume === "number" ? r.search_volume : null,
          cpc: typeof r?.cpc === "number" ? r.cpc : null,
          competition: typeof r?.competition === "string" ? r.competition : null,
        };
      }),
      skipDuplicates: true,
    });
    fetched += batch.length;
  }
  return { fetched, failed, remaining: missing.length - fetched };
}
