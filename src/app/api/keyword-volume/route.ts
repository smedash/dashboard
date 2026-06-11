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

    const volumes = await prisma.keywordVolume.findMany({
      where: {
        keyword: { in: normalizedKeywords },
        location,
        language,
      },
    });

    if (volumes.length === 0) {
      return NextResponse.json({ data: {}, count: 0 });
    }

    const volumeMap: Record<string, {
      keyword: string;
      searchVolume: number | null;
      cpc: number | null;
      competition: string | null;
      competitionIndex: number | null;
      updatedAt: string;
    }> = {};

    for (const v of volumes) {
      volumeMap[v.keyword] = {
        keyword: v.keyword,
        searchVolume: v.searchVolume,
        cpc: v.cpc,
        competition: v.competition,
        competitionIndex: v.competitionIndex,
        updatedAt: v.updatedAt.toISOString(),
      };
    }

    return NextResponse.json({ data: volumeMap, count: volumes.length });
  } catch (error) {
    console.error("Error fetching cached keyword volumes:", error);
    return NextResponse.json({ error: "Failed to fetch volumes" }, { status: 500 });
  }
}
