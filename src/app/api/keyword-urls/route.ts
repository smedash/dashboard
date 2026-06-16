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
    const property: string = body.property;
    const period: string = body.period || "28d";

    if (!Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json({ error: "keywords array is required" }, { status: 400 });
    }
    if (!property) {
      return NextResponse.json({ error: "property is required" }, { status: 400 });
    }

    const normalizedKeywords = keywords.map((k) => k.toLowerCase().trim());

    const results = await prisma.keywordUrl.findMany({
      where: {
        keyword: { in: normalizedKeywords },
        property,
        period,
      },
      orderBy: { clicks: "desc" },
    });

    const data: Record<string, Array<{
      url: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>> = {};

    for (const row of results) {
      if (!data[row.keyword]) {
        data[row.keyword] = [];
      }
      data[row.keyword].push({
        url: row.url,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      });
    }

    return NextResponse.json({ data, count: results.length });
  } catch (error) {
    console.error("Error fetching cached keyword URLs:", error);
    return NextResponse.json({ error: "Failed to fetch keyword URLs" }, { status: 500 });
  }
}
