import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildInventoryOrderBy,
  buildInventoryWhere,
  parseInventoryQuery,
} from "@/lib/url-cleanup/filters";
import ExcelJS from "exceljs";
import { displayCleanupStatus } from "@/lib/url-cleanup/cleanup-status";
import { syncCleanupStatusFromKillBand } from "@/lib/url-cleanup/recompute";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncCleanupStatusFromKillBand();

  const q = parseInventoryQuery(request.nextUrl.searchParams);
  const where = buildInventoryWhere(q);
  const orderBy = buildInventoryOrderBy(q.sort, q.sortDir);

  const rows = await prisma.urlInventory.findMany({
    where,
    orderBy,
    take: 50000,
    include: {
      sitemaps: { include: { sitemap: { select: { sitemapUrl: true } } } },
    },
  });

  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Kill-Liste");
  ws.addRow([
    "URL",
    "Land",
    "Sprache",
    "Section",
    "Sitemaps",
    "GSC Klicks",
    "GSC Impressions",
    "GSC CTR",
    "GSC Position",
    "GSC Zeitraum",
    "Adobe Visits",
    "Adobe Pageviews",
    "Adobe UV",
    "Adobe Form Start",
    "Adobe Leads",
    "Adobe Segmente",
    "Time Spent Visits",
    "Time Spent <15s %",
    "Time Spent ≥1 min %",
    "Gated",
    "Gating-Rollen",
    "Gating-Status",
    "Page Title",
    "Fokuskeywords",
    "Top-Rank Keywords",
    "Labs Pos.",
    "Labs Volume",
    "Konfidenz",
    "Band",
    "Begründung",
    "Status",
    "Notiz",
  ]);
  ws.getRow(1).font = { bold: true };

  for (const r of rows) {
    ws.addRow([
      r.url,
      r.country,
      r.language,
      r.section,
      r.sitemaps.map((s) => s.sitemap.sitemapUrl).join("; "),
      r.gscClicks,
      r.gscImpressions,
      r.gscCtr,
      r.gscPosition,
      r.gscPeriod,
      r.aaVisits,
      r.aaPageViews,
      r.aaUniqueVisitors,
      r.aaFormStart,
      r.aaFormSuccess,
      r.aaSegments.join(", "),
      r.aaTimeSpentVisits,
      r.aaTimeSpentHasData ? Math.round(r.aaTimeSpentShortPct * 10) / 10 : "",
      r.aaTimeSpentHasData ? Math.round(r.aaTimeSpentEngagedPct * 10) / 10 : "",
      r.gatingHasData ? (r.gatingIsGated ? "ja" : "nein") : "",
      r.gatingRoles.join(", "),
      r.gatingStatus,
      r.gatingPageTitle,
      r.focusKeywords.join("; "),
      r.labsKeywords.join("; "),
      r.labsBestRank,
      r.labsMaxSearchVolume,
      r.killConfidence,
      r.killBand,
      r.killReason,
      displayCleanupStatus(r.killBand).label,
      r.cleanupNote,
    ]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="url-cleanup-export.xlsx"`,
    },
  });
}
