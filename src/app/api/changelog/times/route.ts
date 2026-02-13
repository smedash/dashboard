import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET - Alle gespeicherten Zeiten abrufen
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  try {
    const times = await prisma.changelogTime.findMany();
    
    // Als Map zurückgeben: commitHash → minutes
    const timeMap: Record<string, number> = {};
    times.forEach((t) => {
      timeMap[t.commitHash] = t.minutes;
    });

    return NextResponse.json(timeMap);
  } catch (error) {
    console.error("Fehler beim Laden der Changelog-Zeiten:", error);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

// POST - Zeit für einen Commit speichern/aktualisieren
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  // Nur superadmin und agentur dürfen Zeiten ändern
  const user = session.user as { role?: string };
  if (!user.role || !["superadmin", "agentur"].includes(user.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { commitHash, minutes } = body;

    if (!commitHash || typeof minutes !== "number" || minutes < 0) {
      return NextResponse.json(
        { error: "commitHash und minutes (>= 0) erforderlich" },
        { status: 400 }
      );
    }

    const result = await prisma.changelogTime.upsert({
      where: { commitHash },
      update: { minutes },
      create: { commitHash, minutes },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Fehler beim Speichern der Changelog-Zeit:", error);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}

// PUT - Mehrere Zeiten auf einmal speichern (Bulk)
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const user = session.user as { role?: string };
  if (!user.role || !["superadmin", "agentur"].includes(user.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { times } = body as { times: { commitHash: string; minutes: number }[] };

    if (!Array.isArray(times)) {
      return NextResponse.json({ error: "times Array erforderlich" }, { status: 400 });
    }

    // Alle Upserts parallel ausführen
    const results = await Promise.all(
      times.map((t) =>
        prisma.changelogTime.upsert({
          where: { commitHash: t.commitHash },
          update: { minutes: t.minutes },
          create: { commitHash: t.commitHash, minutes: t.minutes },
        })
      )
    );

    return NextResponse.json({ updated: results.length });
  } catch (error) {
    console.error("Fehler beim Bulk-Speichern:", error);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}
