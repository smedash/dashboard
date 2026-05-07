import { auth } from "@/lib/auth";
import { fetchRankedKeywordsForPageTargets } from "@/lib/dataforseo";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/** Bis zu MAX_BATCH einzelne DataForSEO-Calls (je URL), Parallelität im Client-Lib. */
export const maxDuration = 120;

const MAX_BATCH = 100;

/** Nur öffentliche Redaktions-URLs unter www.ubs.com (kein SSRF). */
function normalizeUbsPageUrl(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://www.ubs.com${t.startsWith("/") ? t : `/${t}`}`);
    const host = u.hostname.toLowerCase();
    if (host !== "www.ubs.com" && host !== "ubs.com") return null;
    return `https://www.ubs.com${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

type RowPayload = {
  keywords: Array<{
    keyword: string;
    rankGroup: number;
    rankAbsolute: number | null;
    searchVolume: number | null;
  }>;
  error?: string;
};

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      items?: Array<{ id?: string; url?: string }>;
      useCache?: boolean;
    };
    const rawItems = Array.isArray(body.items) ? body.items : [];
    const useCache = body.useCache === true;

    if (rawItems.length === 0) {
      return NextResponse.json({ byId: {} as Record<string, unknown> });
    }

    if (rawItems.length > MAX_BATCH) {
      return NextResponse.json(
        { error: `Maximal ${MAX_BATCH} URLs pro Anfrage` },
        { status: 400 }
      );
    }

    const idToUrl = new Map<string, string>();
    const skipped: Record<string, RowPayload> = {};

    for (const row of rawItems) {
      const id = typeof row.id === "string" ? row.id.trim() : "";
      const urlRaw = typeof row.url === "string" ? row.url : "";
      if (!id) continue;
      const target = normalizeUbsPageUrl(urlRaw);
      if (!target) {
        skipped[id] = { keywords: [], error: "Ungültige oder nicht-UBS-URL" };
        continue;
      }
      idToUrl.set(id, target);
    }

    if (idToUrl.size === 0) {
      return NextResponse.json({ byId: skipped });
    }

    const byId: Record<string, RowPayload> = { ...skipped };

    if (useCache) {
      const urls = [...new Set(idToUrl.values())];
      const cached = await prisma.rankedKeywordsCache.findMany({
        where: { url: { in: urls } },
      });
      const cacheByUrl = new Map(cached.map((c) => [c.url, c]));

      let latestFetchedAt: Date | null = null;
      for (const [id, url] of idToUrl) {
        const hit = cacheByUrl.get(url);
        if (hit) {
          const keywords = JSON.parse(hit.keywords) as RowPayload["keywords"];
          byId[id] = { keywords, ...(hit.error ? { error: hit.error } : {}) };
          if (!latestFetchedAt || hit.fetchedAt > latestFetchedAt) {
            latestFetchedAt = hit.fetchedAt;
          }
        } else {
          byId[id] = { keywords: [] };
        }
      }

      return NextResponse.json({
        byId,
        labsLocation: cached[0]?.location ?? null,
        labsLanguage: cached[0]?.language ?? null,
        cachedAt: latestFetchedAt?.toISOString() ?? null,
        fromCache: true,
      });
    }

    if (!process.env.DATAFORSEO_USERNAME?.trim() || !process.env.DATAFORSEO_PASSWORD?.trim()) {
      return NextResponse.json(
        {
          error: "DataForSEO API-Zugangsdaten fehlen",
          needsCredentials: true,
        },
        { status: 503 }
      );
    }

    const tasks: Array<{ tag: string; target: string }> = [];
    for (const [id, url] of idToUrl) {
      tasks.push({ tag: id, target: url });
    }

    const map = await fetchRankedKeywordsForPageTargets(tasks, { limit: 5, concurrency: 4 });

    const locationName = process.env.DATAFORSEO_LABS_LOCATION_NAME?.trim() || null;
    const languageName = process.env.DATAFORSEO_LABS_LANGUAGE_NAME?.trim() || null;
    const now = new Date();

    const upserts: Array<Promise<unknown>> = [];

    for (const { tag, target } of tasks) {
      const r = map.get(tag);
      if (r) {
        byId[tag] = { keywords: r.keywords, ...(r.error ? { error: r.error } : {}) };
      } else {
        byId[tag] = { keywords: [], error: "Keine API-Antwort für diesen Task" };
      }

      const payload = byId[tag];
      upserts.push(
        prisma.rankedKeywordsCache.upsert({
          where: { url: target },
          update: {
            keywords: JSON.stringify(payload.keywords),
            error: payload.error ?? null,
            location: locationName,
            language: languageName,
            fetchedAt: now,
          },
          create: {
            url: target,
            keywords: JSON.stringify(payload.keywords),
            error: payload.error ?? null,
            location: locationName,
            language: languageName,
            fetchedAt: now,
          },
        })
      );
    }

    await Promise.all(upserts);

    return NextResponse.json({
      byId,
      labsLocation: locationName,
      labsLanguage: languageName,
    });
  } catch (e) {
    console.error("[keyword-mapping/ranked-keywords]", e);
    const message = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
