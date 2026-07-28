import { NextRequest, NextResponse } from "next/server";
import { syncConductorData } from "@/lib/conductor-sync";

export const maxDuration = 600;
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

    console.log("[Cron Conductor] ====== Starte täglichen Conductor Sync ======");
    console.log("[Cron Conductor] Zeitpunkt:", new Date().toISOString());

    const result = await syncConductorData("cron");

    console.log("[Cron Conductor] ====== Sync abgeschlossen ======");
    console.log(
      `[Cron Conductor] Pages: ${result.pagesProcessed}, Issues: ${result.issuesProcessed}, Dauer: ${result.durationMs}ms`
    );

    return NextResponse.json({
      success: true,
      ...result,
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
