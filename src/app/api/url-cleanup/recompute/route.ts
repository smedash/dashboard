import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canEdit } from "@/lib/rbac";
import { recomputeKillScoreChunk } from "@/lib/url-cleanup/recompute";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json().catch(() => ({}))) as { cursor?: string };
    const chunk = await recomputeKillScoreChunk(body.cursor || undefined);
    return NextResponse.json(chunk);
  } catch (e) {
    console.error("[url-cleanup/recompute]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Recompute fehlgeschlagen" },
      { status: 500 }
    );
  }
}
