import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canEdit } from "@/lib/rbac";
import {
  rankedKeywordsSyncChunk,
  rankedKeywordsSyncStatus,
} from "@/lib/url-cleanup/ranked-keywords-sync";

export const maxDuration = 120;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const status = await rankedKeywordsSyncStatus();
    return NextResponse.json(status);
  } catch (e) {
    console.error("[url-cleanup/ranked-keywords-sync]", e);
    return NextResponse.json({ error: "Status fehlgeschlagen" }, { status: 500 });
  }
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

    const body = (await request.json().catch(() => ({}))) as { cursor?: string };
    const chunk = await rankedKeywordsSyncChunk(body.cursor || undefined);
    return NextResponse.json(chunk);
  } catch (e) {
    console.error("[url-cleanup/ranked-keywords-sync]", e);
    const message = e instanceof Error ? e.message : "Ranked-Keywords-Sync fehlgeschlagen";
    const needsCredentials =
      (e as Error & { code?: string }).code === "needsCredentials" ||
      message.includes("Zugangsdaten");
    return NextResponse.json(
      { error: message, needsCredentials },
      { status: needsCredentials ? 503 : 500 }
    );
  }
}
