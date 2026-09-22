import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canEdit } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import {
  ADOBE_FILES,
  denormalizeAdobeOnInventory,
  listAdobeSeedStatus,
  seedAdobeFile,
  seedSitemaps,
  seedUrls,
} from "@/lib/url-cleanup/seed";
import { syncFocusKeywordsFromMapping, syncLabsFromCache } from "@/lib/url-cleanup/keyword-join";
import { recomputeKillScores } from "@/lib/url-cleanup/recompute";

export const maxDuration = 300;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [inventoryCount, sitemapCount, dimensions, latestJob] = await Promise.all([
    prisma.urlInventory.count(),
    prisma.urlSitemap.count(),
    prisma.urlDimension.findMany({
      select: {
        slug: true,
        name: true,
        sourceType: true,
        segment: true,
        matchedCount: true,
        unmatchedCount: true,
        importedAt: true,
      },
      orderBy: { importedAt: "desc" },
    }),
    prisma.urlCleanupJob.findFirst({ orderBy: { createdAt: "desc" } }),
  ]);

  return NextResponse.json({
    inventoryCount,
    sitemapCount,
    dimensions,
    latestJob,
    adobeFiles: listAdobeSeedStatus(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { step?: string; file?: string };
    const step = body.step || "status";

    if (step === "sitemaps") {
      const result = await seedSitemaps();
      return NextResponse.json({ step, result });
    }
    if (step === "urls") {
      const result = await seedUrls();
      return NextResponse.json({ step, result });
    }
    if (step === "adobe") {
      const file = body.file;
      if (!file) {
        return NextResponse.json({
          step,
          files: ADOBE_FILES.map((f) => f.file),
        });
      }
      const result = await seedAdobeFile(file);
      return NextResponse.json({ step, result });
    }
    if (step === "denorm") {
      const result = await denormalizeAdobeOnInventory();
      return NextResponse.json({ step, result });
    }
    if (step === "keywords") {
      const focus = await syncFocusKeywordsFromMapping();
      const labs = await syncLabsFromCache();
      return NextResponse.json({ step, result: { focus, labs } });
    }
    if (step === "scores") {
      const result = await recomputeKillScores();
      return NextResponse.json({ step, result });
    }

    return NextResponse.json({ error: "Unbekannter Step" }, { status: 400 });
  } catch (e) {
    console.error("[url-cleanup/seed]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Seed fehlgeschlagen" },
      { status: 500 }
    );
  }
}
