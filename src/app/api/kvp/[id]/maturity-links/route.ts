import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { canEdit } from "@/lib/rbac";

// GET - Alle Maturity-Verknüpfungen für eine KVP URL abrufen
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Prüfe ob KVP existiert
    const kvpUrl = await prisma.kVPUrl.findUnique({
      where: { id },
    });

    if (!kvpUrl) {
      return NextResponse.json({ error: "KVP URL not found" }, { status: 404 });
    }

    // Hole alle Verknüpfungen mit Maturity Item Details
    const links = await prisma.$queryRaw<any[]>`
      SELECT 
        kml.id,
        kml."kvpUrlId",
        kml."maturityItemId",
        kml."createdAt",
        smi.id as "itemId",
        smi.category as "itemCategory",
        smi.title as "itemTitle",
        smi.score as "itemScore",
        sm.id as "maturityId",
        sm.name as "maturityName"
      FROM "KVPMaturityItemLink" kml
      JOIN "SEOMaturityItem" smi ON kml."maturityItemId" = smi.id
      JOIN "SEOMaturity" sm ON smi."maturityId" = sm.id
      WHERE kml."kvpUrlId" = ${id}
      ORDER BY smi.category, smi.title
    `;

    // Transformiere die Ergebnisse in ein übersichtlicheres Format
    const formattedLinks = links.map((link) => ({
      id: link.id,
      kvpUrlId: link.kvpUrlId,
      maturityItemId: link.maturityItemId,
      createdAt: link.createdAt,
      maturityItem: {
        id: link.itemId,
        category: link.itemCategory,
        title: link.itemTitle,
        score: link.itemScore,
        maturity: {
          id: link.maturityId,
          name: link.maturityName,
        },
      },
    }));

    return NextResponse.json({ links: formattedLinks });
  } catch (error) {
    console.error("Error fetching maturity links:", error);
    return NextResponse.json(
      { error: "Failed to fetch maturity links" },
      { status: 500 }
    );
  }
}

// POST - Neue Maturity-Verknüpfung erstellen
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rollenprüfung
    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung zum Bearbeiten" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { maturityItemId } = body;

    if (!maturityItemId) {
      return NextResponse.json(
        { error: "maturityItemId ist erforderlich" },
        { status: 400 }
      );
    }

    // Prüfe ob KVP existiert
    const kvpUrl = await prisma.kVPUrl.findUnique({
      where: { id },
    });

    if (!kvpUrl) {
      return NextResponse.json({ error: "KVP URL not found" }, { status: 404 });
    }

    // Prüfe ob Maturity Item existiert
    const maturityItem = await prisma.sEOMaturityItem.findUnique({
      where: { id: maturityItemId },
      include: {
        maturity: true,
      },
    });

    if (!maturityItem) {
      return NextResponse.json({ error: "Maturity Item not found" }, { status: 404 });
    }

    // Prüfe ob Verknüpfung bereits existiert
    const existingLink = await prisma.$queryRaw<any[]>`
      SELECT id FROM "KVPMaturityItemLink" 
      WHERE "kvpUrlId" = ${id} AND "maturityItemId" = ${maturityItemId}
    `;

    if (existingLink.length > 0) {
      return NextResponse.json(
        { error: "Verknüpfung existiert bereits" },
        { status: 400 }
      );
    }

    // Erstelle Verknüpfung
    const linkId = `kml${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    await prisma.$executeRaw`
      INSERT INTO "KVPMaturityItemLink" ("id", "kvpUrlId", "maturityItemId", "createdAt")
      VALUES (${linkId}, ${id}, ${maturityItemId}, ${now})
    `;

    const link = {
      id: linkId,
      kvpUrlId: id,
      maturityItemId: maturityItemId,
      createdAt: now,
      maturityItem: {
        id: maturityItem.id,
        category: maturityItem.category,
        title: maturityItem.title,
        score: maturityItem.score,
        maturity: {
          id: maturityItem.maturity.id,
          name: maturityItem.maturity.name,
        },
      },
    };

    return NextResponse.json({ link });
  } catch (error) {
    console.error("Error creating maturity link:", error);
    return NextResponse.json(
      { error: "Failed to create maturity link" },
      { status: 500 }
    );
  }
}

// DELETE - Alle Verknüpfungen für ein KVP löschen und neue setzen (Bulk-Update)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rollenprüfung
    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung zum Bearbeiten" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { maturityItemIds } = body;

    if (!Array.isArray(maturityItemIds)) {
      return NextResponse.json(
        { error: "maturityItemIds muss ein Array sein" },
        { status: 400 }
      );
    }

    // Prüfe ob KVP existiert
    const kvpUrl = await prisma.kVPUrl.findUnique({
      where: { id },
    });

    if (!kvpUrl) {
      return NextResponse.json({ error: "KVP URL not found" }, { status: 404 });
    }

    // Lösche alle bestehenden Verknüpfungen
    await prisma.$executeRaw`
      DELETE FROM "KVPMaturityItemLink" WHERE "kvpUrlId" = ${id}
    `;

    // Erstelle neue Verknüpfungen
    const now = new Date();
    for (const maturityItemId of maturityItemIds) {
      const linkId = `kml${Date.now()}${Math.random().toString(36).substr(2, 9)}`;
      await prisma.$executeRaw`
        INSERT INTO "KVPMaturityItemLink" ("id", "kvpUrlId", "maturityItemId", "createdAt")
        VALUES (${linkId}, ${id}, ${maturityItemId}, ${now})
      `;
    }

    // Hole die aktualisierten Verknüpfungen
    const links = await prisma.$queryRaw<any[]>`
      SELECT 
        kml.id,
        kml."kvpUrlId",
        kml."maturityItemId",
        kml."createdAt",
        smi.id as "itemId",
        smi.category as "itemCategory",
        smi.title as "itemTitle",
        smi.score as "itemScore",
        sm.id as "maturityId",
        sm.name as "maturityName"
      FROM "KVPMaturityItemLink" kml
      JOIN "SEOMaturityItem" smi ON kml."maturityItemId" = smi.id
      JOIN "SEOMaturity" sm ON smi."maturityId" = sm.id
      WHERE kml."kvpUrlId" = ${id}
      ORDER BY smi.category, smi.title
    `;

    const formattedLinks = links.map((link) => ({
      id: link.id,
      kvpUrlId: link.kvpUrlId,
      maturityItemId: link.maturityItemId,
      createdAt: link.createdAt,
      maturityItem: {
        id: link.itemId,
        category: link.itemCategory,
        title: link.itemTitle,
        score: link.itemScore,
        maturity: {
          id: link.maturityId,
          name: link.maturityName,
        },
      },
    }));

    return NextResponse.json({ links: formattedLinks });
  } catch (error) {
    console.error("Error updating maturity links:", error);
    return NextResponse.json(
      { error: "Failed to update maturity links" },
      { status: 500 }
    );
  }
}
