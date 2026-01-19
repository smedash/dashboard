import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET - Rank Tracker und Keywords abrufen (teamweiter Zugriff)
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Teamweiter Zugriff - Hole den ersten/einzigen Tracker (alle User teilen sich einen Tracker)
    let tracker = await prisma.rankTracker.findFirst({
      include: {
        keywords: {
          include: {
            rankings: {
              orderBy: { date: "desc" },
              take: 1, // Neuestes Ranking pro Keyword
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Erstelle Tracker falls nicht vorhanden
    if (!tracker) {
      tracker = await prisma.rankTracker.create({
        data: {
          userId: session.user.id,
          name: "Standard Tracker",
          location: "Switzerland",
          language: "German",
        },
        include: {
          keywords: {
            include: {
              rankings: {
                orderBy: { date: "desc" },
                take: 1,
              },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });
    }

    return NextResponse.json({ tracker });
  } catch (error) {
    console.error("Error fetching rank tracker:", error);
    return NextResponse.json(
      { error: "Failed to fetch rank tracker" },
      { status: 500 }
    );
  }
}
