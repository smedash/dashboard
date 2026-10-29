import { NextRequest, NextResponse } from "next/server";
import { syncDueConductorWebsites } from "@/lib/conductor-sync";

export const maxDuration = 800;
export const dynamic = "force-dynamic";

/** Leaves headroom below maxDuration for the final cleanup of the last website. */
const SYNC_BUDGET_MS = 600_000;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("[Cron Conductor] CRON_SECRET nicht konfiguriert");
      return NextResponse.json(
        { error: "CRON_SECRET nicht konfiguriert" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error("[Cron Conductor] Ungültiger Authorization Header");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Cron Conductor] Starte Conductor Sync für fällige Websites:", new Date().toISOString());

    const results = await syncDueConductorWebsites(SYNC_BUDGET_MS);
    const totalPages = results.reduce((s, r) => s + r.pagesProcessed, 0);
    const totalIssues = results.reduce((s, r) => s + r.issuesProcessed, 0);

    console.log(
      `[Cron Conductor] ${results.length} Websites bearbeitet (${results
        .map((r) => `${r.domain}: ${r.status}`)
        .join(", ") || "keine fällig"}), Pages: ${totalPages}, Issues: ${totalIssues}`
    );

    return NextResponse.json({
      success: true,
      results,
      totalPages,
      totalIssues,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron Conductor] Kritischer Fehler:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Cron-Job fehlgeschlagen",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
