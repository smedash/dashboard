import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || undefined;
    const location = searchParams.get("location") || undefined;
    const search = searchParams.get("search") || undefined;

    const where: Prisma.EditorialPlanArticleWhereInput = {};
    if (category) where.category = category;
    if (location) where.location = location;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { metaDescription: { contains: search, mode: "insensitive" } },
      ];
    }

    const [grouped, totalCount] = await Promise.all([
      prisma.editorialPlanArticle.groupBy({
        by: ["journeyPhase", "category"],
        where,
        _count: { id: true },
      }),
      prisma.editorialPlanArticle.count({ where }),
    ]);

    const stats: Record<string, Record<string, number>> = {};
    let totalAssigned = 0;
    let totalUnassigned = 0;

    for (const row of grouped) {
      const phase = row.journeyPhase || "__unassigned";
      const cat = row.category || "__none";
      if (!stats[phase]) stats[phase] = {};
      stats[phase][cat] = row._count.id;

      if (row.journeyPhase) {
        totalAssigned += row._count.id;
      } else {
        totalUnassigned += row._count.id;
      }
    }

    return NextResponse.json({
      stats,
      totalCount,
      totalAssigned,
      totalUnassigned,
    });
  } catch (error) {
    console.error("Error fetching journey stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch journey stats" },
      { status: 500 }
    );
  }
}
