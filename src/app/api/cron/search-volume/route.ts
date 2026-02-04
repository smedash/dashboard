import { prisma } from "@/lib/prisma";
import { fetchSearchVolume } from "@/lib/dataforseo";
import { NextRequest, NextResponse } from "next/server";

// Cron-Job Route zum automatischen Abrufen des Suchvolumens
// Wird monatlich am 5. Tag um 01:00 Uhr aufgerufen (konfiguriert in vercel.json)
// Geschützt durch CRON_SECRET

export const maxDuration = 300; // 5 Minuten Timeout für den Cron-Job
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Authentifizierung über CRON_SECRET
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("[Cron Search Volume] CRON_SECRET nicht konfiguriert");
      return NextResponse.json(
        { error: "CRON_SECRET nicht konfiguriert" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error("[Cron Search Volume] Ungültiger Authorization Header");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Cron Search Volume] ====== Starte monatlichen Suchvolumen-Abruf ======");
    console.log("[Cron Search Volume] Zeitpunkt:", new Date().toISOString());

    // Hole alle Tracker mit ihren Keywords
    const trackers = await prisma.rankTracker.findMany({
      include: {
        keywords: true,
      },
    });

    if (trackers.length === 0) {
      console.log("[Cron Search Volume] Keine Tracker gefunden");
      return NextResponse.json({
        success: true,
        message: "Keine Tracker vorhanden",
        trackersProcessed: 0,
        totalKeywords: 0,
        updatedKeywords: 0,
      });
    }

    console.log(`[Cron Search Volume] ${trackers.length} Tracker gefunden`);

    let totalKeywords = 0;
    let updatedKeywords = 0;
    const errors: string[] = [];

    // Verarbeite jeden Tracker
    for (const tracker of trackers) {
      if (tracker.keywords.length === 0) {
        console.log(`[Cron Search Volume] Tracker "${tracker.name}" hat keine Keywords - übersprungen`);
        continue;
      }

      console.log(`[Cron Search Volume] Verarbeite Tracker "${tracker.name}" mit ${tracker.keywords.length} Keywords`);
      totalKeywords += tracker.keywords.length;

      try {
        // Rufe Suchvolumen über DataForSEO ab
        const keywordStrings = tracker.keywords.map((k) => k.keyword);
        const searchVolumeResults = await fetchSearchVolume(
          keywordStrings,
          tracker.location,
          tracker.language
        );

        // Erstelle eine Map für schnellen Zugriff
        const volumeMap = new Map<string, number | null>();
        searchVolumeResults.forEach((result) => {
          volumeMap.set(result.keyword.toLowerCase(), result.search_volume);
        });

        // Aktualisiere die Keywords in der Datenbank
        const now = new Date();

        for (const keyword of tracker.keywords) {
          const searchVolume = volumeMap.get(keyword.keyword.toLowerCase());

          // Aktualisiere nur wenn wir einen Wert haben (auch 0 ist valide)
          if (searchVolume !== undefined) {
            await prisma.rankTrackerKeyword.update({
              where: { id: keyword.id },
              data: {
                searchVolume: searchVolume,
                searchVolumeUpdatedAt: now,
              },
            });
            updatedKeywords++;
            console.log(`[Cron Search Volume] "${keyword.keyword}": ${searchVolume ?? 0} monatliche Suchen`);
          }
        }

        console.log(`[Cron Search Volume] Tracker "${tracker.name}" erfolgreich verarbeitet`);
      } catch (trackerError) {
        const errorMessage = trackerError instanceof Error ? trackerError.message : "Unbekannter Fehler";
        console.error(`[Cron Search Volume] Fehler bei Tracker "${tracker.name}":`, errorMessage);
        errors.push(`Tracker "${tracker.name}": ${errorMessage}`);
      }
    }

    console.log("[Cron Search Volume] ====== Suchvolumen-Abruf abgeschlossen ======");
    console.log(`[Cron Search Volume] Tracker: ${trackers.length}, Keywords: ${totalKeywords}, Aktualisiert: ${updatedKeywords}`);

    if (errors.length > 0) {
      console.log(`[Cron Search Volume] ${errors.length} Fehler aufgetreten:`, errors);
    }

    return NextResponse.json({
      success: true,
      message: `Suchvolumen für ${updatedKeywords} von ${totalKeywords} Keywords aktualisiert`,
      trackersProcessed: trackers.length,
      totalKeywords,
      updatedKeywords,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron Search Volume] Kritischer Fehler:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Cron-Job fehlgeschlagen",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
