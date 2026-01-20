import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Alle KVP-Verknüpfungen für ein Maturity Item abrufen
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, itemId } = await params;

    // Prüfe ob das Maturity Item existiert und zur Analyse gehört
    const maturityItem = await prisma.sEOMaturityItem.findFirst({
      where: {
        id: itemId,
        maturityId: id,
      },
    });

    if (!maturityItem) {
      return NextResponse.json({ error: "Maturity Item not found" }, { status: 404 });
    }

    // Hole alle verknüpften KVPs
    const links = await prisma.$queryRaw<any[]>`
      SELECT 
        kml.id as "linkId",
        kml."createdAt" as "linkCreatedAt",
        kv.id as "kvpId",
        kv.url as "kvpUrl",
        kv."focusKeyword" as "kvpFocusKeyword",
        kv.category as "kvpCategory",
        kv."createdAt" as "kvpCreatedAt",
        kv."updatedAt" as "kvpUpdatedAt"
      FROM "KVPMaturityItemLink" kml
      JOIN "KVPUrl" kv ON kml."kvpUrlId" = kv.id
      WHERE kml."maturityItemId" = ${itemId}
      ORDER BY kv."updatedAt" DESC
    `;

    // Transformiere die Ergebnisse
    const formattedLinks = links.map((link) => ({
      linkId: link.linkId,
      linkCreatedAt: link.linkCreatedAt,
      kvp: {
        id: link.kvpId,
        url: link.kvpUrl,
        focusKeyword: link.kvpFocusKeyword,
        category: link.kvpCategory,
        createdAt: link.kvpCreatedAt,
        updatedAt: link.kvpUpdatedAt,
      },
    }));

    return NextResponse.json({ links: formattedLinks });
  } catch (error) {
    console.error("Error fetching KVP links:", error);
    return NextResponse.json(
      { error: "Failed to fetch KVP links" },
      { status: 500 }
    );
  }
}
