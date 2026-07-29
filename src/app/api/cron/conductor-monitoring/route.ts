import { NextRequest, NextResponse } from "next/server";
import { syncAllConductorWebsites } from "@/lib/conductor-sync";

export const maxDuration = 800;
export const dynamic = "force-dynamic";

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

    console.log("[Cron Conductor] ====== Starte taeglichen Conductor Sync (alle Websites) ======");
    console.log("[Cron Conductor] Zeitpunkt:", new Date().toISOString());

    const results = await syncAllConductorWebsites("cron");
    const totalPages = results.reduce((s, r) => s + r.pagesProcessed, 0);
    const totalIssues = results.reduce((s, r) => s + r.issuesProcessed, 0);

    console.log("[Cron Conductor] ====== Sync abgeschlossen ======");
    console.log(
      `[Cron Conductor] ${results.length} Websites, Pages: ${totalPages}, Issues: ${totalIssues}`
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
