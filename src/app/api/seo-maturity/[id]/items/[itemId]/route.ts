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

    // Alten Zustand für ChangeLog laden
    const oldItem = await prisma.sEOMaturityItem.findUnique({
      where: { id: itemId },
      include: { teams: { include: { team: true } } },
    });

    if (!oldItem) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

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

    // ChangeLog-Einträge für jedes geänderte Feld erstellen
    const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];

    if (score !== undefined && score !== oldItem.score) {
      changes.push({ field: "score", oldValue: String(oldItem.score), newValue: String(Math.max(1, Math.min(10, score))) });
    }
    if (title && title !== oldItem.title) {
      changes.push({ field: "title", oldValue: oldItem.title, newValue: title });
    }
    if (description !== undefined && description !== oldItem.description) {
      changes.push({ field: "description", oldValue: oldItem.description || null, newValue: description || null });
    }
    if (category && category !== oldItem.category) {
      changes.push({ field: "category", oldValue: oldItem.category, newValue: category });
    }
    if (priority !== undefined && priority !== oldItem.priority) {
      changes.push({ field: "priority", oldValue: oldItem.priority || null, newValue: priority || null });
    }
    if (teamIds !== undefined) {
      const oldTeamNames = oldItem.teams.map((t) => t.team.name).sort().join(", ");
      const newTeamNames = item.teams.map((t: any) => t.team.name).sort().join(", ");
      if (oldTeamNames !== newTeamNames) {
        changes.push({ field: "teams", oldValue: oldTeamNames || null, newValue: newTeamNames || null });
      }
    }

    if (changes.length > 0) {
      await prisma.sEOMaturityChangeLog.createMany({
        data: changes.map((c) => ({
          maturityId: id,
          itemId: itemId,
          action: "update",
          field: c.field,
          oldValue: c.oldValue,
          newValue: c.newValue,
          itemTitle: item.title,
          itemCategory: item.category,
          userId: session.user.id,
        })),
      });
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Error updating SEO maturity item:", error);
    return NextResponse.json(
      { error: "Failed to update SEO maturity item" },
      { status: 500 }
    );
  }
}

// DELETE - Einzelnes Item löschen
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, itemId } = await params;

    const maturity = await prisma.sEOMaturity.findUnique({
      where: { id },
    });

    if (!maturity) {
      return NextResponse.json({ error: "SEO maturity not found" }, { status: 404 });
    }

    if (maturity.userId !== session.user.id && !isSuperadmin(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Item-Daten vor dem Löschen laden für ChangeLog
    const itemToDelete = await prisma.sEOMaturityItem.findUnique({
      where: { id: itemId },
    });

    await prisma.sEOMaturityItem.delete({
      where: { id: itemId },
    });

    // ChangeLog für Löschung
    if (itemToDelete) {
      await prisma.sEOMaturityChangeLog.create({
        data: {
          maturityId: id,
          itemId: null,
          action: "delete",
          field: null,
          oldValue: JSON.stringify({ title: itemToDelete.title, category: itemToDelete.category, score: itemToDelete.score, priority: itemToDelete.priority }),
          newValue: null,
          itemTitle: itemToDelete.title,
          itemCategory: itemToDelete.category,
          userId: session.user.id,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting SEO maturity item:", error);
    return NextResponse.json(
      { error: "Failed to delete SEO maturity item" },
      { status: 500 }
    );
  }
}
