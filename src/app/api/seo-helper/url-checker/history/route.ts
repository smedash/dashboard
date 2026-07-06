import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url, keyword, overallScore, categories, fullResult } = await request.json();

    if (!url || overallScore === undefined) {
      return NextResponse.json({ error: "url und overallScore sind erforderlich" }, { status: 400 });
    }

    const categoryScores: Record<string, number> = {};
    for (const cat of categories || []) {
      categoryScores[cat.name] = cat.score;
    }

    try {
      const entry = await db.urlCheckHistory.create({
        data: {
          userId: session.user.id,
          url,
          keyword: keyword || null,
          overallScore: Math.round(overallScore),
          categoryScores: JSON.stringify(categoryScores),
          fullResult: JSON.stringify(fullResult),
        },
      });
      return NextResponse.json({ id: entry.id, saved: true });
    } catch {
      // Table might not exist yet (migration pending)
      return NextResponse.json({ saved: false, reason: "migration_pending" });
    }
  } catch (error) {
    console.error("[url-checker/history] Save error:", error);
    return NextResponse.json({ error: "Fehler beim Speichern." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: Record<string, string> = { userId: session.user.id };
    if (url) where.url = url;

    try {
      const entries = await db.urlCheckHistory.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 100),
        select: {
          id: true,
          url: true,
          keyword: true,
          overallScore: true,
          categoryScores: true,
          createdAt: true,
        },
      });

      const results = entries.map((e: { categoryScores: string; [key: string]: unknown }) => ({
        ...e,
        categoryScores: JSON.parse(e.categoryScores),
      }));

      return NextResponse.json({ entries: results });
    } catch {
      // Table might not exist yet
      return NextResponse.json({ entries: [] });
    }
  } catch (error) {
    console.error("[url-checker/history] Load error:", error);
    return NextResponse.json({ error: "Fehler beim Laden." }, { status: 500 });
  }
}
