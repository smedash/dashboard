import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTicketUpdateNotification } from "@/lib/resend";

// POST /api/tickets/[id]/comments - Kommentar hinzufügen
export async function POST(
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
    const { text } = body;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "Kommentartext ist erforderlich" },
        { status: 400 }
      );
    }

    // Ticket mit Assignees laden
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 });
    }

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: id,
        userId: session.user.id,
        text: text.trim(),
      },
    });

    // E-Mail-Benachrichtigung an Assignees und Ticket-Ersteller
    const dashboardUrl = `${process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || ""}/tickets`;
    const authorName = session.user.name || session.user.email || "Jemand";
    const truncatedComment = text.trim().length > 300 
      ? text.trim().substring(0, 300) + "..." 
      : text.trim();

    // Alle zu benachrichtigenden Emails sammeln (Assignees + Ersteller), ohne den Kommentator
    const notifyEmails = new Set<string>();

    for (const assignee of ticket.assignees) {
      if (assignee.user.id !== session.user!.id) {
        notifyEmails.add(assignee.user.email);
      }
    }

    // Ticket-Ersteller auch benachrichtigen
    if (ticket.userId !== session.user!.id) {
      const creator = await prisma.user.findUnique({
        where: { id: ticket.userId },
        select: { email: true },
      });
      if (creator) {
        notifyEmails.add(creator.email);
      }
    }

    for (const email of notifyEmails) {
      try {
        await sendTicketUpdateNotification({
          to: email,
          ticketTitle: ticket.title,
          updateType: "comment",
          updateDetails: truncatedComment,
          updaterName: authorName,
          dashboardUrl,
        });
      } catch (emailError) {
        console.error(`Failed to send ticket comment email to ${email}:`, emailError);
      }
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Fehler beim Erstellen des Kommentars" },
      { status: 500 }
    );
  }
}
