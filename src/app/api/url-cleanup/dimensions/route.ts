import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dimensions = await prisma.urlDimension.findMany({
    orderBy: { importedAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      sourceType: true,
      segment: true,
      periodStart: true,
      periodEnd: true,
      columns: true,
      matchedCount: true,
      unmatchedCount: true,
      unmatchedSample: true,
      importedAt: true,
    },
  });
  const sitemaps = await prisma.urlSitemap.findMany({
    orderBy: { number: "asc" },
    select: { id: true, sitemapUrl: true, countryPath: true, language: true },
  });
  return NextResponse.json({ dimensions, sitemaps });
}
