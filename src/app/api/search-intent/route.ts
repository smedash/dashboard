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
    const language = body.language || "de";

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ data: {}, count: 0 });
    }

    const normalizedKeywords = keywords.map((k) => k.toLowerCase().trim());

    const intents = await prisma.searchIntent.findMany({
      where: {
        keyword: { in: normalizedKeywords },
        language,
      },
    });

    if (intents.length === 0) {
      return NextResponse.json({ data: {}, count: 0 });
    }

    const intentMap: Record<string, {
      keyword: string;
      intentLabel: string;
      intentProbability: number;
      secondaryIntents: Array<{ label: string; probability: number }> | null;
      updatedAt: string;
    }> = {};

    for (const item of intents) {
      intentMap[item.keyword] = {
        keyword: item.keyword,
        intentLabel: item.intentLabel,
        intentProbability: item.intentProbability,
        secondaryIntents: item.secondaryIntents
          ? JSON.parse(item.secondaryIntents)
          : null,
        updatedAt: item.updatedAt.toISOString(),
      };
    }

    return NextResponse.json({ data: intentMap, count: intents.length });
  } catch (error) {
    console.error("Error fetching cached Search Intent:", error);
    return NextResponse.json({ error: "Failed to fetch search intent" }, { status: 500 });
  }
}
