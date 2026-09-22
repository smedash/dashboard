import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canEdit } from "@/lib/rbac";
import { getKillSettings, saveKillSettings } from "@/lib/url-cleanup/settings";
import { recomputeKillScores } from "@/lib/url-cleanup/recompute";
import type { KillScoreSettings } from "@/lib/url-cleanup/kill-score";

export const maxDuration = 120;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await getKillSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = (await request.json()) as { settings?: Partial<KillScoreSettings>; recompute?: boolean };
    const settings = await saveKillSettings(body.settings ?? {});
    let recompute: { updated: number } | undefined;
    if (body.recompute === true) {
      recompute = await recomputeKillScores();
    }
    return NextResponse.json({ settings, recompute });
  } catch (e) {
    console.error("[url-cleanup/settings]", e);
    return NextResponse.json({ error: "Settings fehlgeschlagen" }, { status: 500 });
  }
}
