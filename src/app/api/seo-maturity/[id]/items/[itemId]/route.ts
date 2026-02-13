import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperadmin } from "@/lib/rbac";
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

    if (maturity.userId !== session.user.id && !isSuperadmin(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { score, title, description, category, order, priority, teamIds } = body;

    // Aktualisiere Teams falls teamIds übergeben wurde
    if (teamIds !== undefined) {
      // Lösche alle bestehenden Team-Zuordnungen
      await prisma.sEOMaturityItemTeam.deleteMany({
        where: { itemId: itemId },
      });

      // Erstelle neue Team-Zuordnungen
      if (Array.isArray(teamIds) && teamIds.length > 0) {
        await prisma.sEOMaturityItemTeam.createMany({
          data: teamIds.map((teamId: string) => ({
            itemId: itemId,
            teamId: teamId,
          })),
          skipDuplicates: true,
        });
      }
    }

    const item = await prisma.sEOMaturityItem.update({
      where: { id: itemId },
      data: {
        ...(score !== undefined && { score: Math.max(1, Math.min(10, score)) }),
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(category && { category }),
        ...(order !== undefined && { order }),
        ...(priority !== undefined && { priority: priority || null }),
      },
      include: {
        teams: {
          include: {
            team: true,
          },
        },
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
