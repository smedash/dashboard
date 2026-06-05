import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const keywords: string[] = body.keywords;
    const location = body.location || "Switzerland";
    const language = body.language || "German";

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ data: {}, count: 0 });
    }

    const normalizedKeywords = keywords.map((k) => k.toLowerCase().trim());

    const trends = await prisma.googleTrend.findMany({
      where: {
        keyword: { in: normalizedKeywords },
        location,
        language,
      },
    });

    if (trends.length === 0) {
      return NextResponse.json({ data: {}, count: 0 });
    }

    const trendMap: Record<string, {
      keyword: string;
      trendAvg: number | null;
      trendRecent: number | null;
      trendDirection: string | null;
      updatedAt: string;
    }> = {};

    for (const t of trends) {
      trendMap[t.keyword] = {
        keyword: t.keyword,
        trendAvg: t.trendAvg,
        trendRecent: t.trendRecent,
        trendDirection: t.trendDirection,
        updatedAt: t.updatedAt.toISOString(),
      };
    }

    return NextResponse.json({ data: trendMap, count: trends.length });
  } catch (error) {
    console.error("Error fetching cached Google Trends:", error);
    return NextResponse.json({ error: "Failed to fetch trends" }, { status: 500 });
  }
}
