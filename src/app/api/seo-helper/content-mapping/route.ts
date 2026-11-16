import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/keyword-map/server";
import { contentStats } from "@/lib/content-mapping/crawl";

const SORTS: Record<string, (dir: Prisma.SortOrder) => Prisma.UrlInventoryOrderByWithRelationInput> = {
  url: (dir) => ({ url: dir }),
  gscImpressions: (dir) => ({ gscImpressions: dir }),
  wordCount: (dir) => ({ content: { wordCount: dir } }),
  sectionCount: (dir) => ({ content: { sectionCount: dir } }),
  crawledAt: (dir) => ({ content: { crawledAt: dir } }),
};

function buildWhere(sp: URLSearchParams): Prisma.UrlInventoryWhereInput {
  const and: Prisma.UrlInventoryWhereInput[] = [];
  const q = sp.get("q")?.trim();
  if (q) {
    and.push({
      OR: [
        { url: { contains: q, mode: "insensitive" } },
        { content: { is: { title: { contains: q, mode: "insensitive" } } } },
        { content: { is: { h1: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  for (const field of ["country", "language", "section"] as const) {
    const value = sp.get(field)?.trim();
    if (value) and.push({ [field]: value });
  }
  const status = sp.get("status")?.trim();
  if (status === "open") {
    and.push({ OR: [{ content: { is: null } }, { content: { is: { status: "pending" } } }] });
  } else if (status) {
    and.push({ content: { is: { status } } });
  }
  if (sp.get("noindex") === "true") and.push({ content: { is: { robots: { contains: "noindex" } } } });
  const minWords = Number(sp.get("minWords"));
  if (sp.get("minWords") && Number.isFinite(minWords)) and.push({ content: { is: { wordCount: { gte: minWords } } } });
  const maxWords = Number(sp.get("maxWords"));
  if (sp.get("maxWords") && Number.isFinite(maxWords)) and.push({ content: { is: { wordCount: { lte: maxWords } } } });
  return and.length ? { AND: and } : {};
}

async function facets() {
  const present = (values: Array<string | null>) => values.filter((v): v is string => Boolean(v));
  const [countries, languages, sections] = await Promise.all([
    prisma.urlInventory.findMany({ where: { country: { not: null } }, distinct: ["country"], select: { country: true }, orderBy: { country: "asc" } }),
    prisma.urlInventory.findMany({ where: { language: { not: null } }, distinct: ["language"], select: { language: true }, orderBy: { language: "asc" } }),
    prisma.urlInventory.findMany({ where: { section: { not: null } }, distinct: ["section"], select: { section: true }, orderBy: { section: "asc" } }),
  ]);
  return {
    countries: present(countries.map((r) => r.country)),
    languages: present(languages.map((r) => r.language)),
    sections: present(sections.map((r) => r.section)),
  };
}

export async function GET(request: NextRequest) {
  const { error } = await requireUser();
  if (error) return error;

  const sp = request.nextUrl.searchParams;
  const page = Math.max(0, Number(sp.get("page")) || 0);
  const pageSize = Math.min(Math.max(1, Number(sp.get("pageSize")) || 25), 200);
  const dir: Prisma.SortOrder = sp.get("sortDir") === "asc" ? "asc" : "desc";
  const sort = SORTS[sp.get("sort") ?? ""] ?? SORTS.gscImpressions;
  const where = buildWhere(sp);

  try {
    const [total, rows, stats, facetData] = await Promise.all([
      prisma.urlInventory.count({ where }),
      prisma.urlInventory.findMany({
        where,
        orderBy: [sort(dir), { id: "asc" }],
        skip: page * pageSize,
        take: pageSize,
        select: {
          id: true,
          url: true,
          country: true,
          language: true,
          section: true,
          gscImpressions: true,
          content: {
            select: {
              status: true,
              httpStatus: true,
              title: true,
              h1: true,
              robots: true,
              wordCount: true,
              sectionCount: true,
              fetchedVia: true,
              error: true,
              crawledAt: true,
            },
          },
        },
      }),
      contentStats(),
      sp.get("facets") === "1" ? facets() : Promise.resolve(null),
    ]);
    return NextResponse.json({ total, page, pageSize, rows, stats, facets: facetData });
  } catch (e) {
    console.error("[content-mapping] GET", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Laden fehlgeschlagen" }, { status: 500 });
  }
}
