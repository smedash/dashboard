import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSuperadmin } from "@/lib/rbac";

// PATCH /api/admin/users/[id] - User aktualisieren (nur Superadmin)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    if (!isSuperadmin(session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, role } = body;

    // Prüfen ob User existiert
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "Nutzer nicht gefunden" }, { status: 404 });
    }

    // Verhindere, dass sich der letzte Superadmin selbst degradiert
    if (existingUser.role === "superadmin" && role !== "superadmin") {
      const superadminCount = await prisma.user.count({
        where: { role: "superadmin" },
      });
      
      if (superadminCount <= 1) {
        return NextResponse.json(
          { error: "Es muss mindestens ein Superadmin existieren" },
          { status: 400 }
        );
      }
    }

    // Validiere Rolle
    const validRoles = ["superadmin", "member", "viewer"];
    const updateData: { name?: string; role?: string } = {};
    
    if (name !== undefined) updateData.name = name;
    if (role && validRoles.includes(role)) updateData.role = role;

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Nutzers" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users/[id] - User löschen (nur Superadmin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    if (!isSuperadmin(session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    const { id } = await params;

    // Verhindere Selbstlöschung
    if (id === session.user.id) {
      return NextResponse.json(
        { error: "Sie können sich nicht selbst löschen" },
        { status: 400 }
      );
    }

    // Prüfen ob User existiert
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "Nutzer nicht gefunden" }, { status: 404 });
    }

    // Verhindere Löschen des letzten Superadmins
    if (existingUser.role === "superadmin") {
      const superadminCount = await prisma.user.count({
        where: { role: "superadmin" },
      });
      
      if (superadminCount <= 1) {
        return NextResponse.json(
          { error: "Der letzte Superadmin kann nicht gelöscht werden" },
          { status: 400 }
        );
      }
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Nutzers" },
      { status: 500 }
    );
  }
}
