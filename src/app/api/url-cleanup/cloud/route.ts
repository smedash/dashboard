import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildInventoryWhere,
  parseInventoryQuery,
} from "@/lib/url-cleanup/filters";

export const maxDuration = 120;

const POINT_LIMIT = 70_000;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = parseInventoryQuery(request.nextUrl.searchParams);
  const where = buildInventoryWhere(q);

  const rows = await prisma.urlInventory.findMany({
    where,
    take: POINT_LIMIT,
    select: {
      id: true,
      url: true,
      country: true,
      language: true,
      section: true,
      gscImpressions: true,
      gscClicks: true,
      aaVisits: true,
      aaFormSuccess: true,
      killConfidence: true,
      killBand: true,
    },
  });

  return NextResponse.json({
    truncated: rows.length >= POINT_LIMIT,
    points: rows.map((r) => ({
      id: r.id,
      url: r.url,
      c: r.country,
      l: r.language,
      s: r.section,
      gi: r.gscImpressions,
      gc: r.gscClicks,
      av: r.aaVisits,
      ld: r.aaFormSuccess,
      k: r.killConfidence,
      b: r.killBand,
    })),
  });
}
