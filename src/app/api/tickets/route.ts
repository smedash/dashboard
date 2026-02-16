import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTicketAssignmentNotification } from "@/lib/resend";

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
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
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
    const { title, description, type, priority, assigneeIds } = body;

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
        ...(assigneeIds && assigneeIds.length > 0 && {
          assignees: {
            create: assigneeIds.map((userId: string) => ({
              userId,
            })),
          },
        }),
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        comments: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // E-Mail-Benachrichtigungen an Assignees senden (async, nicht blockierend)
    if (assigneeIds && assigneeIds.length > 0) {
      const dashboardUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ""}/tickets`;
      const creatorName = session.user.name || session.user.email || "Jemand";

      // Nur an andere User senden, nicht an den Ersteller selbst
      const assigneesToNotify = ticket.assignees.filter(
        (a) => a.user.id !== session.user!.id
      );

      for (const assignee of assigneesToNotify) {
        try {
          await sendTicketAssignmentNotification({
            to: assignee.user.email,
            ticketTitle: title,
            ticketType: type,
            priority: priority || "medium",
            creatorName,
            dashboardUrl,
          });
        } catch (emailError) {
          console.error(`Failed to send ticket assignment email to ${assignee.user.email}:`, emailError);
        }
      }
    }

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error("Error creating ticket:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Tickets" },
      { status: 500 }
    );
  }
}
