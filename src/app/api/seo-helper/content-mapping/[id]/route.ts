import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/keyword-map/server";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser();
  if (error) return error;

  const { id } = await ctx.params;
  const content = await prisma.urlContent.findUnique({
    where: { inventoryId: id },
    select: {
      status: true,
      httpStatus: true,
      finalUrl: true,
      fetchedVia: true,
      error: true,
      title: true,
      metaDescription: true,
      h1: true,
      canonical: true,
      robots: true,
      lang: true,
      headings: true,
      wordCount: true,
      sectionCount: true,
      crawledAt: true,
      sections: {
        orderBy: { position: "asc" },
        select: { id: true, position: true, level: true, heading: true, headingPath: true, text: true, wordCount: true },
      },
    },
  });
  return NextResponse.json({ content });
}
