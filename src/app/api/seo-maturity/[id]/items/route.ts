import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// POST - Neues Item zur Analyse hinzufügen
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Prüfe ob die Analyse dem User gehört
    const maturity = await prisma.sEOMaturity.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: [{ category: "asc" }, { order: "desc" }],
        },
      },
    });

    if (!maturity) {
      return NextResponse.json({ error: "SEO maturity not found" }, { status: 404 });
    }

    if (maturity.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { category, title, description, score, priority, teamIds } = body;

    if (!category || !title) {
      return NextResponse.json(
        { error: "Category and title are required" },
        { status: 400 }
      );
    }

    // Bestimme die nächste Order-Nummer für diese Kategorie
    const categoryItems = maturity.items.filter((item) => item.category === category);
    const maxOrder = categoryItems.length > 0 
      ? Math.max(...categoryItems.map((item) => item.order))
      : -1;

    const newItem = await prisma.sEOMaturityItem.create({
      data: {
        maturityId: id,
        category: category,
        title: title,
        description: description || null,
        score: score || 1,
        priority: priority || null,
        order: maxOrder + 1,
        teams: {
          create: Array.isArray(teamIds) && teamIds.length > 0
            ? teamIds.map((teamId: string) => ({
                teamId: teamId,
              }))
            : [],
        },
      },
      include: {
        teams: {
          include: {
            team: true,
          },
        },
      },
    });

    return NextResponse.json({ item: newItem });
  } catch (error) {
    console.error("Error creating SEO maturity item:", error);
    return NextResponse.json(
      { error: "Failed to create SEO maturity item" },
      { status: 500 }
    );
  }
}
