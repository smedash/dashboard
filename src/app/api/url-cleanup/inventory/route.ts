import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildInventoryOrderBy,
  buildInventoryWhere,
  parseInventoryQuery,
} from "@/lib/url-cleanup/filters";
import { markZeroConfidenceAsKeep } from "@/lib/url-cleanup/recompute";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await markZeroConfidenceAsKeep();

  const q = parseInventoryQuery(request.nextUrl.searchParams);
  const where = buildInventoryWhere(q);
  const orderBy = buildInventoryOrderBy(q.sort, q.sortDir);
  const page = q.page ?? 0;
  const pageSize = q.pageSize ?? 25;

  const [total, rows, countries, languages] = await Promise.all([
    prisma.urlInventory.count({ where }),
    prisma.urlInventory.findMany({
      where,
      orderBy,
      skip: page * pageSize,
      take: pageSize,
      include: {
        sitemaps: {
          include: { sitemap: { select: { id: true, sitemapUrl: true, countryPath: true } } },
        },
      },
    }),
    prisma.urlInventory.findMany({
      where: { country: { not: null } },
      distinct: ["country"],
      select: { country: true },
      take: 200,
    }),
    prisma.urlInventory.findMany({
      where: { language: { not: null } },
      distinct: ["language"],
      select: { language: true },
      take: 80,
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    pageSize,
    rows,
    facets: {
      countries: countries.map((c) => c.country).filter(Boolean).sort(),
      languages: languages.map((c) => c.language).filter(Boolean).sort(),
    },
  });
}
