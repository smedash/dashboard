import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [countResult, latestResult] = await Promise.all([
      prisma.rankedKeywordsCache.count(),
      prisma.rankedKeywordsCache.findFirst({
        orderBy: { fetchedAt: "desc" },
        select: { fetchedAt: true, location: true, language: true },
      }),
    ]);

    return NextResponse.json({
      cachedUrlCount: countResult,
      latestFetchedAt: latestResult?.fetchedAt?.toISOString() ?? null,
      location: latestResult?.location ?? null,
      language: latestResult?.language ?? null,
    });
  } catch (e) {
    console.error("[ranked-keywords/cache-info]", e);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
