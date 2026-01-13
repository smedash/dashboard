import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Einzelne SEO Reifegrad Analyse abrufen
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

    const maturity = await prisma.sEOMaturity.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: [{ category: "asc" }, { order: "asc" }],
        },
      },
    });

    if (!maturity) {
      return NextResponse.json({ error: "SEO maturity not found" }, { status: 404 });
    }

    if (maturity.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ maturity });
  } catch (error) {
    console.error("Error fetching SEO maturity:", error);
    return NextResponse.json(
      { error: "Failed to fetch SEO maturity" },
      { status: 500 }
    );
  }
}

// PATCH - SEO Reifegrad Analyse aktualisieren
export async function PATCH(
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
    const existing = await prisma.sEOMaturity.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "SEO maturity not found" }, { status: 404 });
    }

    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, description, items } = body;

    // Aktualisiere die Analyse
    const maturity = await prisma.sEOMaturity.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(items && {
          items: {
            deleteMany: {},
            create: items.map((item: any, index: number) => ({
              category: item.category || "Allgemein",
              title: item.title,
              description: item.description || null,
              score: item.score || 1,
              order: item.order !== undefined ? item.order : index,
            })),
          },
        }),
      },
      include: {
        items: {
          orderBy: [{ category: "asc" }, { order: "asc" }],
        },
      },
    });

    return NextResponse.json({ maturity });
  } catch (error) {
    console.error("Error updating SEO maturity:", error);
    return NextResponse.json(
      { error: "Failed to update SEO maturity" },
      { status: 500 }
    );
  }
}

// DELETE - SEO Reifegrad Analyse löschen
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const maturity = await prisma.sEOMaturity.findUnique({
      where: { id },
    });

    if (!maturity) {
      return NextResponse.json({ error: "SEO maturity not found" }, { status: 404 });
    }

    if (maturity.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.sEOMaturity.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting SEO maturity:", error);
    return NextResponse.json(
      { error: "Failed to delete SEO maturity" },
      { status: 500 }
    );
  }
}
