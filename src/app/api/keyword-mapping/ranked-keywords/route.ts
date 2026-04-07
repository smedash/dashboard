import { auth } from "@/lib/auth";
import { fetchRankedKeywordsForPageTargets } from "@/lib/dataforseo";
import { NextRequest, NextResponse } from "next/server";

/** Bis zu MAX_BATCH einzelne DataForSEO-Calls (je URL), Parallelität im Client-Lib. */
export const maxDuration = 60;

const MAX_BATCH = 25;

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

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const body = (await request.json()) as { items?: Array<{ id?: string; url?: string }> };
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (rawItems.length === 0) {
      return NextResponse.json({ byId: {} as Record<string, unknown> });
    }

    if (rawItems.length > MAX_BATCH) {
      return NextResponse.json(
        { error: `Maximal ${MAX_BATCH} URLs pro Anfrage` },
        { status: 400 }
      );
    }

    const tasks: Array<{ tag: string; target: string }> = [];
    type RowPayload = {
      keywords: Array<{
        keyword: string;
        rankGroup: number;
        rankAbsolute: number | null;
        searchVolume: number | null;
      }>;
      error?: string;
    };
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
      tasks.push({ tag: id, target });
    }

    if (tasks.length === 0) {
      return NextResponse.json({ byId: skipped });
    }

    const map = await fetchRankedKeywordsForPageTargets(tasks, { limit: 5 });

    const byId: Record<string, RowPayload> = { ...skipped };

    for (const { tag } of tasks) {
      const r = map.get(tag);
      if (r) {
        byId[tag] = { keywords: r.keywords, ...(r.error ? { error: r.error } : {}) };
      } else {
        byId[tag] = { keywords: [], error: "Keine API-Antwort für diesen Task" };
      }
    }

    return NextResponse.json({
      byId,
      labsLocation: process.env.DATAFORSEO_LABS_LOCATION_NAME?.trim() || null,
      labsLanguage: process.env.DATAFORSEO_LABS_LANGUAGE_NAME?.trim() || null,
    });
  } catch (e) {
    console.error("[keyword-mapping/ranked-keywords]", e);
    const message = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
