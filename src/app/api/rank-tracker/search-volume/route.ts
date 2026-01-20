import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchSearchVolume } from "@/lib/dataforseo";
import { NextResponse } from "next/server";

// POST - Suchvolumen für alle Keywords abrufen und speichern
export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Prüfe Berechtigung (nur member und superadmin)
    if (session.user.role === "viewer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Optional: Einzelnes Keyword aktualisieren
    const url = new URL(request.url);
    const keywordId = url.searchParams.get("keywordId");

    // Hole den Tracker
    const tracker = await prisma.rankTracker.findFirst({
      include: {
        keywords: true,
      },
    });

    if (!tracker) {
      return NextResponse.json(
        { error: "Kein Rank Tracker gefunden" },
        { status: 404 }
      );
    }

    // Bestimme welche Keywords aktualisiert werden sollen
    let keywordsToUpdate = tracker.keywords;
    
    if (keywordId) {
      // Nur ein bestimmtes Keyword
      keywordsToUpdate = tracker.keywords.filter((k) => k.id === keywordId);
      if (keywordsToUpdate.length === 0) {
        return NextResponse.json(
          { error: "Keyword nicht gefunden" },
          { status: 404 }
        );
      }
    }

    if (keywordsToUpdate.length === 0) {
      return NextResponse.json(
        { error: "Keine Keywords vorhanden" },
        { status: 400 }
      );
    }

    console.log(`[SearchVolume API] Starte Abruf für ${keywordsToUpdate.length} Keywords`);

    // Rufe Suchvolumen über DataForSEO ab
    const keywordStrings = keywordsToUpdate.map((k) => k.keyword);
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
    let updatedCount = 0;
    const now = new Date();

    for (const keyword of keywordsToUpdate) {
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
        updatedCount++;
        console.log(`[SearchVolume API] Updated "${keyword.keyword}": ${searchVolume}`);
      }
    }

    console.log(`[SearchVolume API] ✓ ${updatedCount} von ${keywordsToUpdate.length} Keywords aktualisiert`);

    return NextResponse.json({
      message: `Suchvolumen für ${updatedCount} Keywords aktualisiert`,
      updatedCount,
      totalKeywords: keywordsToUpdate.length,
    });
  } catch (error) {
    console.error("Error fetching search volume:", error);
    return NextResponse.json(
      { error: "Failed to fetch search volume" },
      { status: 500 }
    );
  }
}
