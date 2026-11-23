import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSearchVolume } from "@/lib/dataforseo";
import { getProjectMaxTotalSv, mapUrlInclude, requireUser, serializeUrls } from "@/lib/keyword-map/server";
import { normalizeKeyword } from "@/lib/keyword-map/shared";

export const maxDuration = 300;

const MAX_BATCH = 50;

/** DataForSEO-Location-Codes für die Länder, in denen Keyword-Mapping-Projekte angelegt werden */
const LOCATION_CODES: Record<string, number> = {
  ch: 2756,
  de: 2276,
  at: 2040,
  fr: 2250,
  it: 2380,
  li: 2438,
  gb: 2826,
  us: 2840,
};

/**
 * Body: `{ ids, force? }` – holt das Google-Ads-Suchvolumen für Fokus- und Nebenkeywords der URLs.
 * Ohne `force` werden nur Keywords ohne Suchvolumen abgefragt.
 */
export async function POST(request: NextRequest) {
  const { error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const body = (await request.json()) as { ids?: string[]; force?: boolean };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === "string") : [];
    if (ids.length === 0) return NextResponse.json({ requested: 0, found: 0, urls: [] });
    if (ids.length > MAX_BATCH) {
      return NextResponse.json({ error: `Maximal ${MAX_BATCH} URLs pro Anfrage` }, { status: 400 });
    }
    if (!process.env.DATAFORSEO_USERNAME?.trim() || !process.env.DATAFORSEO_PASSWORD?.trim()) {
      return NextResponse.json({ error: "DataForSEO API-Zugangsdaten fehlen", needsCredentials: true }, { status: 503 });
    }

    const rows = await prisma.keywordMapUrl.findMany({ where: { id: { in: ids } }, include: { ...mapUrlInclude, project: true } });
    if (rows.length === 0) return NextResponse.json({ requested: 0, found: 0, urls: [] });

    const projectIds = new Set(rows.map((r) => r.projectId));
    if (projectIds.size > 1) return NextResponse.json({ error: "URLs müssen zum selben Projekt gehören" }, { status: 400 });
    const project = rows[0].project;
    const locationCode = LOCATION_CODES[project.countryCode.toLowerCase()];
    if (!locationCode) {
      return NextResponse.json({ error: `Land „${project.countryCode}“ wird für den Suchvolumen-Abruf nicht unterstützt` }, { status: 400 });
    }

    const targets = rows.flatMap((r) => r.keywords).filter((k) => body.force || k.searchVolume === null);
    const keywords = [...new Set(targets.map((k) => k.keyword))];

    let found = 0;
    if (keywords.length > 0) {
      const results = await fetchSearchVolume(keywords, undefined, undefined, {
        locationCode,
        languageCode: project.languageCode.toLowerCase(),
      });
      const volumeByKeyword = new Map<string, number>();
      for (const r of results) {
        if (typeof r.search_volume === "number") volumeByKeyword.set(normalizeKeyword(r.keyword), r.search_volume);
      }

      for (const kw of keywords) {
        const sv = volumeByKeyword.get(normalizeKeyword(kw));
        if (sv === undefined) continue;
        found++;
        await prisma.keywordMapKeyword.updateMany({
          where: { keyword: kw, urlId: { in: rows.map((r) => r.id) } },
          data: { searchVolume: sv },
        });
      }
    }

    const fresh = await prisma.keywordMapUrl.findMany({ where: { id: { in: ids } }, include: mapUrlInclude });
    const max = await getProjectMaxTotalSv(project.id);
    return NextResponse.json({ requested: keywords.length, found, urls: serializeUrls(fresh, max) });
  } catch (e) {
    console.error("[keyword-mapping/search-volume]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Suchvolumen konnte nicht geladen werden" }, { status: 500 });
  }
}
