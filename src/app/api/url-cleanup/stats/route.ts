import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    total,
    inGsc,
    inAdobe,
    withFocus,
    labsCached,
    highKill,
    keepBand,
    lastGsc,
    sitemaps,
    dimensions,
  ] = await Promise.all([
    prisma.urlInventory.count(),
    prisma.urlInventory.count({ where: { gscHasData: true } }),
    prisma.urlInventory.count({ where: { aaHasData: true } }),
    prisma.urlInventory.count({ where: { hasFocusKeywords: true } }),
    prisma.urlInventory.count({ where: { labsHasData: true } }),
    prisma.urlInventory.count({ where: { killBand: "high" } }),
    prisma.urlInventory.count({ where: { killBand: "keep" } }),
    prisma.urlInventory.findFirst({
      where: { gscSyncedAt: { not: null } },
      orderBy: { gscSyncedAt: "desc" },
      select: { gscSyncedAt: true, gscPeriod: true },
    }),
    prisma.urlSitemap.count(),
    prisma.urlDimension.findMany({
      orderBy: { importedAt: "desc" },
      select: {
        slug: true,
        name: true,
        sourceType: true,
        segment: true,
        matchedCount: true,
        unmatchedCount: true,
        periodStart: true,
        periodEnd: true,
        importedAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    total,
    inGsc,
    inAdobe,
    withFocus,
    labsCached,
    highKill,
    keepBand,
    gscMatchRate: total > 0 ? inGsc / total : 0,
    adobeMatchRate: total > 0 ? inAdobe / total : 0,
    lastGsc,
    sitemaps,
    dimensions,
  });
}
