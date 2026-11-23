import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDateRange, getGSCClient } from "@/lib/gsc";
import { KEYWORD_MAPPING_GSC_SITE_URL } from "@/lib/keyword-mapping-gsc";
import { normalizeUbsPageUrl, toUrlKey } from "@/lib/url-cleanup/normalize";
import { getProjectMaxTotalSv, mapUrlInclude, requireUser, serializeUrls } from "@/lib/keyword-map/server";

export const maxDuration = 300;

const MAX_BATCH = 50;
const CONCURRENCY = 5;
/** Entspricht der Spalte „GSC Klicks (last 6 months)“ im Excel-Import/-Export */
const PERIOD = "6m";

type Result = { clicks?: number; error?: string };

/** Body: `{ ids }` – holt die GSC-Klicks der letzten 6 Monate pro URL (Varianten mit/ohne `.html` zusammengezählt). */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser({ write: true });
  if (error) return error;

  try {
    const body = (await request.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === "string") : [];
    if (ids.length === 0) return NextResponse.json({ results: {}, urls: [] });
    if (ids.length > MAX_BATCH) {
      return NextResponse.json({ error: `Maximal ${MAX_BATCH} URLs pro Anfrage` }, { status: 400 });
    }

    let gsc: Awaited<ReturnType<typeof getGSCClient>>;
    try {
      gsc = await getGSCClient(user.id);
    } catch {
      return NextResponse.json({ error: "Kein Google-Konto verbunden – bitte mit Google anmelden, um GSC-Daten abzurufen" }, { status: 400 });
    }

    const rows = await prisma.keywordMapUrl.findMany({ where: { id: { in: ids } }, select: { id: true, url: true, projectId: true } });
    const { startDate, endDate } = getDateRange(PERIOD);
    const results: Record<string, Result> = {};

    const fetchOne = async (row: (typeof rows)[number]) => {
      const keys = normalizeUbsPageUrl(row.url) ? toUrlKey(row.url) : null;
      if (!keys) {
        results[row.id] = { error: "Keine www.ubs.com-URL" };
        return;
      }
      const escapedPath = keys.urlKeyNoHtml.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const res = await gsc.searchanalytics.query({
        siteUrl: KEYWORD_MAPPING_GSC_SITE_URL,
        requestBody: {
          startDate,
          endDate,
          dimensions: ["page"],
          rowLimit: 100,
          dimensionFilterGroups: [
            { filters: [{ dimension: "page", operator: "includingRegex", expression: `(?i)^https?://(www\\.)?ubs\\.com${escapedPath}(\\.html)?/?([?#].*)?$` }] },
          ],
        },
      });
      const clicks = (res.data.rows ?? [])
        .filter((r) => r.keys?.[0] && toUrlKey(r.keys[0])?.urlKeyNoHtml === keys.urlKeyNoHtml)
        .reduce((sum, r) => sum + (r.clicks ?? 0), 0);
      await prisma.keywordMapUrl.update({ where: { id: row.id }, data: { gscClicks: clicks } });
      results[row.id] = { clicks };
    };

    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      await Promise.all(
        rows.slice(i, i + CONCURRENCY).map((row) =>
          fetchOne(row).catch((e) => {
            results[row.id] = { error: e instanceof Error ? e.message : "GSC-Abfrage fehlgeschlagen" };
          })
        )
      );
    }

    const fresh = await prisma.keywordMapUrl.findMany({ where: { id: { in: ids } }, include: mapUrlInclude });
    const max = fresh[0] ? await getProjectMaxTotalSv(fresh[0].projectId) : 0;
    return NextResponse.json({ results, urls: serializeUrls(fresh, max) });
  } catch (e) {
    console.error("[keyword-mapping/gsc-clicks]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "GSC-Klicks konnten nicht geladen werden" }, { status: 500 });
  }
}
