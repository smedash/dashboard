import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Alle Maturity Items abrufen (für Dropdown-Auswahl in KVP)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Hole alle SEO-Reifegradanalysen mit ihren Items
    const maturities = await prisma.sEOMaturity.findMany({
      include: {
        items: {
          orderBy: [{ category: "asc" }, { order: "asc" }],
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transformiere die Ergebnisse in ein flaches Format für die Auswahl
    const allItems = maturities.flatMap((maturity) =>
      maturity.items.map((item) => ({
        id: item.id,
        category: item.category,
        title: item.title,
        score: item.score,
        maturityId: maturity.id,
        maturityName: maturity.name,
      }))
    );

    return NextResponse.json({ 
      maturities: maturities.map((m) => ({
        id: m.id,
        name: m.name,
        itemCount: m.items.length,
      })),
      items: allItems,
    });
  } catch (error) {
    console.error("Error fetching maturity items:", error);
    return NextResponse.json(
      { error: "Failed to fetch maturity items" },
      { status: 500 }
    );
  }
}
