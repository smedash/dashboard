import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/tickets - Alle Tickets abrufen
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const tickets = await prisma.ticket.findMany({
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
      orderBy: [
        { status: "asc" },
        { priority: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    return NextResponse.json(
      { error: "Fehler beim Laden der Tickets" },
      { status: 500 }
    );
  }
}

// POST /api/tickets - Neues Ticket erstellen
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, type, priority } = body;

    if (!title || !description || !type) {
      return NextResponse.json(
        { error: "Titel, Beschreibung und Typ sind erforderlich" },
        { status: 400 }
      );
    }

    if (!["bug", "feature"].includes(type)) {
      return NextResponse.json(
        { error: "Typ muss 'bug' oder 'feature' sein" },
        { status: 400 }
      );
    }

    const ticket = await prisma.ticket.create({
      data: {
        userId: session.user.id,
        title,
        description,
        type,
        priority: priority || "medium",
        status: "open",
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error("Error creating ticket:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Tickets" },
      { status: 500 }
    );
  }
}
