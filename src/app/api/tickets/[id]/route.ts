import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/tickets/[id] - Einzelnes Ticket abrufen
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { id } = await params;
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        comments: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("Error fetching ticket:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden des Tickets" },
      { status: 500 }
    );
  }
}

// PATCH /api/tickets/[id] - Ticket aktualisieren
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, description, type, status, priority } = body;

    // Prüfen ob Ticket existiert
    const existingTicket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!existingTicket) {
      return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 });
    }

    // Validierung
    if (type && !["bug", "feature"].includes(type)) {
      return NextResponse.json(
        { error: "Typ muss 'bug' oder 'feature' sein" },
        { status: 400 }
      );
    }

    if (status && !["open", "in_progress", "closed"].includes(status)) {
      return NextResponse.json(
        { error: "Status muss 'open', 'in_progress' oder 'closed' sein" },
        { status: 400 }
      );
    }

    if (priority && !["low", "medium", "high"].includes(priority)) {
      return NextResponse.json(
        { error: "Priorität muss 'low', 'medium' oder 'high' sein" },
        { status: 400 }
      );
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(type && { type }),
        ...(status && { status }),
        ...(priority && { priority }),
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        comments: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("Error updating ticket:", error);
    return NextResponse.json(
      { error: "Fehler beim Aktualisieren des Tickets" },
      { status: 500 }
    );
  }
}

// DELETE /api/tickets/[id] - Ticket löschen
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { id } = await params;

    // Prüfen ob Ticket existiert und dem User gehört
    const existingTicket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!existingTicket) {
      return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 });
    }

    // Nur eigene Tickets löschen (oder Admin)
    if (existingTicket.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Keine Berechtigung zum Löschen dieses Tickets" },
        { status: 403 }
      );
    }

    await prisma.ticket.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting ticket:", error);
    return NextResponse.json(
      { error: "Fehler beim Löschen des Tickets" },
      { status: 500 }
    );
  }
}
