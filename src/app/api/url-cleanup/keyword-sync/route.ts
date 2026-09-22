import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canEdit } from "@/lib/rbac";
import { syncFocusKeywordsFromMapping, syncLabsFromCache } from "@/lib/url-cleanup/keyword-join";
import { prisma } from "@/lib/prisma";

export const maxDuration = 120;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [labsCache, focusCount, labsCount] = await Promise.all([
    prisma.rankedKeywordsCache.count(),
    prisma.urlInventory.count({ where: { hasFocusKeywords: true } }),
    prisma.urlInventory.count({ where: { labsHasData: true } }),
  ]);
  return NextResponse.json({ labsCache, focusCount, labsCount });
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const focus = await syncFocusKeywordsFromMapping();
    const labs = await syncLabsFromCache();
    return NextResponse.json({ focus, labs });
  } catch (e) {
    console.error("[url-cleanup/keyword-sync]", e);
    return NextResponse.json({ error: "Keyword-Sync fehlgeschlagen" }, { status: 500 });
  }
}
