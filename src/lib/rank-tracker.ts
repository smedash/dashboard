import type { RankTrackerRanking } from "@prisma/client";
import { mapWithConcurrency } from "@/lib/concurrency";
import { prisma } from "@/lib/prisma";
import {
  RANKING_FETCH_CONCURRENCY,
  fetchRankingForKeyword,
  findRankingPosition,
  resolveRankingLocale,
} from "@/lib/dataforseo";

/** Domain, gegen die gerankt wird, wenn am Keyword keine targetUrl hinterlegt ist. */
export const DEFAULT_TARGET_DOMAIN = "ubs.com";

export interface RankTrackerKeywordInput {
  id: string;
  keyword: string;
  targetUrl: string | null;
}

export interface RankingRunResult {
  savedRankings: Array<{ keyword: string; ranking: RankTrackerRanking }>;
  errors: string[];
}

/**
 * Ruft Rankings für die übergebenen Keywords ab und speichert jedes Ergebnis
 * sofort nach seinem Abruf. Dadurch überleben Teilergebnisse einen Abbruch der
 * Serverless Function. Fehler einzelner Keywords brechen den Lauf nicht ab.
 */
export async function runRankingFetch(
  keywords: RankTrackerKeywordInput[],
  options?: { location?: string; language?: string }
): Promise<RankingRunResult> {
  const { locationCode, languageCode } = resolveRankingLocale(
    options?.location,
    options?.language
  );

  const savedRankings: RankingRunResult["savedRankings"] = [];
  const errors: string[] = [];

  console.log(
    `[runRankingFetch] Starte Abruf für ${keywords.length} Keywords (Concurrency ${RANKING_FETCH_CONCURRENCY}, Location ${locationCode}, Language ${languageCode})`
  );

  await mapWithConcurrency(keywords, RANKING_FETCH_CONCURRENCY, async (keyword) => {
    try {
      const result = await fetchRankingForKeyword(
        keyword.keyword,
        locationCode,
        languageCode
      );

      const targetUrl = keyword.targetUrl || DEFAULT_TARGET_DOMAIN;

      // Kein Result bedeutet "geprüft, nicht gefunden" -> als position null speichern
      const rankingData = result
        ? findRankingPosition([result], keyword.keyword, targetUrl)
        : { position: null, url: null };

      const ranking = await prisma.rankTrackerRanking.create({
        data: {
          keywordId: keyword.id,
          position: rankingData.position,
          url: rankingData.url,
          date: new Date(),
        },
      });

      savedRankings.push({ keyword: keyword.keyword, ranking });

      if (rankingData.position === null) {
        console.log(`[runRankingFetch] "${keyword.keyword}" nicht in Top 50`);
      } else {
        console.log(`[runRankingFetch] "${keyword.keyword}" auf Position ${rankingData.position}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler";
      console.error(`[runRankingFetch] Fehler bei "${keyword.keyword}": ${message}`);
      errors.push(`${keyword.keyword}: ${message}`);
    }
  });

  console.log(
    `[runRankingFetch] Fertig: ${savedRankings.length}/${keywords.length} gespeichert, ${errors.length} Fehler`
  );

  return { savedRankings, errors };
}
