import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canEdit } from "@/lib/rbac";
import {
  listGscPrefixes,
  resetGscOnInventory,
  syncGscChunk,
} from "@/lib/url-cleanup/gsc-sync";
import { recomputeKillScores } from "@/lib/url-cleanup/recompute";
import { getKillSettings, saveKillSettings } from "@/lib/url-cleanup/settings";
import { KEYWORD_MAPPING_GSC_SITE_URL } from "@/lib/keyword-mapping-gsc";

export const maxDuration = 120;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const prefixes = await listGscPrefixes();
  return NextResponse.json({ prefixes });
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

    const body = (await request.json()) as {
      phase?: "reset" | "page" | "prefix" | "finalize";
      period?: string;
      siteUrl?: string;
      startRow?: number;
      prefix?: string;
    };

    const period = body.period || (await getKillSettings()).gscPeriod;
    const siteUrl = body.siteUrl || KEYWORD_MAPPING_GSC_SITE_URL;
    const phase = body.phase || "page";

    if (phase === "reset") {
      await saveKillSettings({ gscPeriod: period });
      const result = await resetGscOnInventory(period);
      return NextResponse.json({ phase, period, result });
    }

    if (phase === "page" || phase === "prefix") {
      const result = await syncGscChunk({
        userId: session.user.id,
        siteUrl,
        period,
        mode: phase,
        startRow: body.startRow,
        prefix: body.prefix,
      });
      return NextResponse.json({ phase, period, result });
    }

    if (phase === "finalize") {
      const result = await recomputeKillScores();
      return NextResponse.json({ phase, result });
    }

    return NextResponse.json({ error: "Unbekannte Phase" }, { status: 400 });
  } catch (e) {
    console.error("[url-cleanup/gsc-sync]", e);
    const message = e instanceof Error ? e.message : "GSC-Sync fehlgeschlagen";
    const needsConnection = message === "No Google account connected";
    return NextResponse.json(
      { error: message, needsConnection },
      { status: needsConnection ? 403 : 500 }
    );
  }
}
