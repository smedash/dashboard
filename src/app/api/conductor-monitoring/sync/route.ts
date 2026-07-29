import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasFullAdminRights } from "@/lib/rbac";
import { syncConductorData, syncAllConductorWebsites } from "@/lib/conductor-sync";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!hasFullAdminRights(session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const websiteId = body.websiteId as string | undefined;

    if (websiteId) {
      const result = await syncConductorData("manual", websiteId);
      return NextResponse.json({ success: true, results: [result] });
    }

    const results = await syncAllConductorWebsites("manual");
    const totalPages = results.reduce((s, r) => s + r.pagesProcessed, 0);
    const totalIssues = results.reduce((s, r) => s + r.issuesProcessed, 0);
    const totalDuration = results.reduce((s, r) => s + r.durationMs, 0);
    return NextResponse.json({
      success: true,
      results,
      pagesProcessed: totalPages,
      issuesProcessed: totalIssues,
      durationMs: totalDuration,
    });
  } catch (error) {
    console.error("[Conductor Sync]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync fehlgeschlagen" },
      { status: 500 }
    );
  }
}
