import { prisma } from "@/lib/prisma";
import { runRankingFetch } from "@/lib/rank-tracker";
import { NextRequest, NextResponse } from "next/server";

// Cron-Job Route zum automatischen Abrufen aller Rankings
// Wird täglich um 00:30 Uhr aufgerufen (konfiguriert in vercel.json)
// Geschützt durch CRON_SECRET

export const maxDuration = 800; // Maximum mit Fluid Compute (ohne Fluid Compute: 300)
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Authentifizierung über CRON_SECRET
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Vercel Cron-Jobs senden den Secret automatisch im Authorization Header
    // Format: "Bearer <CRON_SECRET>"
    if (!cronSecret) {
      console.error("[Cron Rank Tracker] CRON_SECRET nicht konfiguriert");
      return NextResponse.json(
        { error: "CRON_SECRET nicht konfiguriert" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error("[Cron Rank Tracker] Ungültiger Authorization Header");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Cron Rank Tracker] ====== Starte täglichen Ranking-Abruf ======");
    console.log("[Cron Rank Tracker] Zeitpunkt:", new Date().toISOString());

    // Hole alle Tracker mit ihren Keywords
    const trackers = await prisma.rankTracker.findMany({
      include: {
        keywords: true,
      },
    });

    if (trackers.length === 0) {
      console.log("[Cron Rank Tracker] Keine Tracker gefunden");
      return NextResponse.json({
        success: true,
        message: "Keine Tracker vorhanden",
        trackersProcessed: 0,
        totalKeywords: 0,
        totalRankings: 0,
      });
    }

    console.log(`[Cron Rank Tracker] ${trackers.length} Tracker gefunden`);

    let totalKeywords = 0;
    let totalRankings = 0;
    const errors: string[] = [];

    // Verarbeite jeden Tracker
    for (const tracker of trackers) {
      if (tracker.keywords.length === 0) {
        console.log(`[Cron Rank Tracker] Tracker "${tracker.name}" hat keine Keywords - übersprungen`);
        continue;
      }

      console.log(`[Cron Rank Tracker] Verarbeite Tracker "${tracker.name}" mit ${tracker.keywords.length} Keywords`);
      totalKeywords += tracker.keywords.length;

      try {
        const { savedRankings, errors: keywordErrors } = await runRankingFetch(
          tracker.keywords,
          { location: tracker.location, language: tracker.language }
        );

        totalRankings += savedRankings.length;

        for (const keywordError of keywordErrors) {
          errors.push(`Tracker "${tracker.name}" – ${keywordError}`);
        }

        console.log(
          `[Cron Rank Tracker] Tracker "${tracker.name}": ${savedRankings.length}/${tracker.keywords.length} Rankings gespeichert`
        );
      } catch (trackerError) {
        const errorMessage = trackerError instanceof Error ? trackerError.message : "Unbekannter Fehler";
        console.error(`[Cron Rank Tracker] Fehler bei Tracker "${tracker.name}":`, errorMessage);
        errors.push(`Tracker "${tracker.name}": ${errorMessage}`);
      }
    }

    console.log("[Cron Rank Tracker] ====== Ranking-Abruf abgeschlossen ======");
    console.log(`[Cron Rank Tracker] Tracker: ${trackers.length}, Keywords: ${totalKeywords}, Rankings: ${totalRankings}`);

    if (errors.length > 0) {
      console.log(`[Cron Rank Tracker] ${errors.length} Fehler aufgetreten:`, errors);
    }

    return NextResponse.json({
      success: true,
      message: `${totalRankings} Rankings für ${totalKeywords} Keywords abgerufen`,
      trackersProcessed: trackers.length,
      totalKeywords,
      totalRankings,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron Rank Tracker] Kritischer Fehler:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Cron-Job fehlgeschlagen",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
