import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fetchRankedKeywordsForPageTargets } from "@/lib/dataforseo";
import { normalizeUbsPageUrl } from "@/lib/url-cleanup/normalize";
import { getBrandMatcher } from "@/lib/keyword-map/brands";
import { getProjectMaxTotalSv, mapUrlInclude, requireUser, serializeUrls, setFocusKeyword } from "@/lib/keyword-map/server";
import { type DfsKeywordRow, dedupeDfsKeywords, pickTopKeyword } from "@/lib/keyword-map/shared";

export const maxDuration = 120;

const MAX_BATCH = 50;
const KEYWORD_LIMIT = 30;
const FRESH_MS = 7 * 24 * 60 * 60 * 1000;
/** Der bestehende Keyword-Mapping-Cache (Redaktionsplan) arbeitet mit den Top 5 */
const SHARED_CACHE_LIMIT = 5;

type ApplyMode = "never" | "ifEmpty" | "always";

/**
 * Body: `{ ids, force?, fetch?, applyAsFocus? }`
 * - `fetch: false` übernimmt nur das gespeicherte Top-Keyword (ohne API-Call)
 * - `applyAsFocus`: Top-Keyword als Fokus setzen – nie, nur wenn leer, oder immer
 */
export async function POST(request: NextRequest) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const body = (await request.json()) as {
      ids?: string[];
      force?: boolean;
      fetch?: boolean;
      applyAsFocus?: ApplyMode;
    };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === "string") : [];
    if (ids.length === 0) return NextResponse.json({ results: {}, urls: [] });
    if (ids.length > MAX_BATCH) {
      return NextResponse.json({ error: `Maximal ${MAX_BATCH} URLs pro Anfrage` }, { status: 400 });
    }
    const shouldFetch = body.fetch !== false;
    const applyMode: ApplyMode = body.applyAsFocus ?? "never";

    const rows = await prisma.keywordMapUrl.findMany({ where: { id: { in: ids } }, include: mapUrlInclude });
    const results: Record<string, { fetched: boolean; error?: string; topKeyword?: string | null }> = {};

    if (shouldFetch) {
      if (!process.env.DATAFORSEO_USERNAME?.trim() || !process.env.DATAFORSEO_PASSWORD?.trim()) {
        return NextResponse.json({ error: "DataForSEO API-Zugangsdaten fehlen", needsCredentials: true }, { status: 503 });
      }

      const now = Date.now();
      const toFetch = rows.filter((r) => body.force || !r.dfsFetchedAt || now - r.dfsFetchedAt.getTime() > FRESH_MS);
      const map = await fetchRankedKeywordsForPageTargets(
        toFetch.map((r) => ({ tag: r.id, target: r.url })),
        { limit: KEYWORD_LIMIT, concurrency: 4 }
      );

      const locationName = process.env.DATAFORSEO_LABS_LOCATION_NAME?.trim() || null;
      const languageName = process.env.DATAFORSEO_LABS_LANGUAGE_NAME?.trim() || null;
      const fetchedAt = new Date();
      const isBrand = await getBrandMatcher();

      await Promise.all(
        toFetch.map(async (row) => {
          const res = map.get(row.id) ?? { keywords: [], error: "Keine API-Antwort" };
          const keywords: DfsKeywordRow[] = dedupeDfsKeywords(res.keywords);
          const top = pickTopKeyword(keywords, isBrand);
          results[row.id] = { fetched: true, topKeyword: top?.keyword ?? null, ...(res.error ? { error: res.error } : {}) };
          if (res.error && keywords.length === 0) return;

          const data = {
            dfsKeywords: keywords as unknown as Prisma.InputJsonValue,
            dfsTopKeyword: top?.keyword ?? null,
            dfsSearchVolume: top?.searchVolume ?? null,
            dfsRank: top?.rankGroup || null,
            dfsFetchedAt: fetchedAt,
          };
          await prisma.keywordMapUrl.update({ where: { id: row.id }, data });
          Object.assign(row, data);

          const sharedUrl = normalizeUbsPageUrl(row.url);
          if (sharedUrl) {
            const shared = {
              keywords: JSON.stringify(keywords.slice(0, SHARED_CACHE_LIMIT)),
              error: res.error ?? null,
              location: locationName,
              language: languageName,
              fetchedAt,
            };
            await prisma.rankedKeywordsCache.upsert({
              where: { url: sharedUrl },
              update: shared,
              create: { url: sharedUrl, ...shared },
            });
          }
        })
      );
      for (const row of rows) {
        if (!results[row.id]) results[row.id] = { fetched: false, topKeyword: row.dfsTopKeyword };
      }
    }

    if (applyMode !== "never") {
      for (const row of rows) {
        const hasFocus = row.keywords.some((k) => k.type === "focus");
        if (!row.dfsTopKeyword || (applyMode === "ifEmpty" && hasFocus)) continue;
        await setFocusKeyword(row.id, row.dfsTopKeyword, row.dfsSearchVolume, "dataforseo");
        results[row.id] = { ...(results[row.id] ?? { fetched: false }), topKeyword: row.dfsTopKeyword };
      }
    }

    const fresh = await prisma.keywordMapUrl.findMany({ where: { id: { in: ids } }, include: mapUrlInclude });
    const max = fresh[0] ? await getProjectMaxTotalSv(fresh[0].projectId) : 0;
    return NextResponse.json({ results, urls: serializeUrls(fresh, max) });
  } catch (e) {
    console.error("[keyword-mapping/ranked-keywords]", e);
    const message = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
