import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// PATCH - Einzelnes Item aktualisieren
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, itemId } = await params;
    const body = await request.json();

    // Prüfe ob die Analyse dem User gehört
    const maturity = await prisma.sEOMaturity.findUnique({
      where: { id },
    });

    if (!maturity) {
      return NextResponse.json({ error: "SEO maturity not found" }, { status: 404 });
    }

    if (maturity.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { score, title, description, category, order } = body;

    const item = await prisma.sEOMaturityItem.update({
      where: { id: itemId },
      data: {
        ...(score !== undefined && { score: Math.max(1, Math.min(10, score)) }),
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(category && { category }),
        ...(order !== undefined && { order }),
      },
    });

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Error updating SEO maturity item:", error);
    return NextResponse.json(
      { error: "Failed to update SEO maturity item" },
      { status: 500 }
    );
  }
}
