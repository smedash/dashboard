import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Einzelnen Snapshot mit Daten abrufen
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
    const searchParams = request.nextUrl.searchParams;
    const dimension = searchParams.get("dimension");

    const snapshot = await prisma.snapshot.findUnique({
      where: { id },
      include: {
        property: true,
        user: {
          select: { name: true, email: true },
        },
        data: dimension
          ? {
              where: { dimension },
              orderBy: { clicks: "desc" },
            }
          : {
              orderBy: { clicks: "desc" },
            },
      },
    });

    if (!snapshot) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    return NextResponse.json({ snapshot });
  } catch (error) {
    console.error("Error fetching snapshot:", error);
    return NextResponse.json(
      { error: "Failed to fetch snapshot" },
      { status: 500 }
    );
  }
}

// PATCH - Snapshot aktualisieren
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
    const { name, description } = body;

    // Validierung
    if (name !== undefined && (!name || typeof name !== "string" || name.trim().length === 0)) {
      return NextResponse.json(
        { error: "Name darf nicht leer sein" },
        { status: 400 }
      );
    }

    // Prüfe ob der Snapshot dem User gehört
    const snapshot = await prisma.snapshot.findUnique({
      where: { id },
    });

    if (!snapshot) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    // Prüfe ob User Admin ist (über Umgebungsvariable)
    const adminEmails = process.env.ADMIN_EMAILS?.split(",").map(email => email.trim().toLowerCase()) || [];
    const isAdmin = session.user.email && adminEmails.includes(session.user.email.toLowerCase());
    
    // String-Vergleich mit expliziter Konvertierung
    const snapshotUserId = String(snapshot.userId);
    const sessionUserId = String(session.user.id);
    const isOwner = snapshotUserId === sessionUserId;
    
    // Erlaube Bearbeitung nur wenn User Besitzer ODER Admin ist
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { 
          error: "Forbidden: Du hast keine Berechtigung, diesen Snapshot zu bearbeiten",
        },
        { status: 403 }
      );
    }

    // Aktualisiere nur die übergebenen Felder
    const updateData: { name?: string; description?: string | null } = {};
    if (name !== undefined) {
      updateData.name = name.trim();
    }
    if (description !== undefined) {
      updateData.description = description ? description.trim() : null;
    }

    // Prüfe ob es etwas zu aktualisieren gibt
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "Keine Daten zum Aktualisieren" },
        { status: 400 }
      );
    }

    const updatedSnapshot = await prisma.snapshot.update({
      where: { id },
      data: updateData,
      include: {
        property: true,
        user: {
          select: { name: true, email: true },
        },
      },
    });

    return NextResponse.json({ snapshot: updatedSnapshot });
  } catch (error) {
    console.error("Error updating snapshot:", error);
    return NextResponse.json(
      { error: "Failed to update snapshot" },
      { status: 500 }
    );
  }
}

// DELETE - Snapshot löschen
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

    // Prüfe ob der Snapshot dem User gehört
    const snapshot = await prisma.snapshot.findUnique({
      where: { id },
    });

    if (!snapshot) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    // Prüfe ob User Admin ist (über Umgebungsvariable)
    const adminEmails = process.env.ADMIN_EMAILS?.split(",").map(email => email.trim().toLowerCase()) || [];
    const isAdmin = session.user.email && adminEmails.includes(session.user.email.toLowerCase());
    
    // String-Vergleich mit expliziter Konvertierung
    const snapshotUserId = String(snapshot.userId);
    const sessionUserId = String(session.user.id);
    const isOwner = snapshotUserId === sessionUserId;
    
    // Erlaube Löschung nur wenn User Besitzer ODER Admin ist
    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Du hast keine Berechtigung, diesen Snapshot zu löschen" },
        { status: 403 }
      );
    }

    await prisma.snapshot.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting snapshot:", error);
    return NextResponse.json(
      { error: "Failed to delete snapshot" },
      { status: 500 }
    );
  }
}


