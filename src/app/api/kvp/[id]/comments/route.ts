import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET - Alle Kommentare für eine KVP URL abrufen
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

    // Prüfen ob die URL dem User gehört
    const existingUrl = await prisma.kVPUrl.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingUrl) {
      return NextResponse.json({ error: "KVP URL not found" }, { status: 404 });
    }

    const comments = await prisma.kVPComment.findMany({
      where: { urlId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Error fetching KVP comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

// POST - Neuen Kommentar hinzufügen
export async function POST(
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
    const { text } = body;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "Kommentartext ist erforderlich" },
        { status: 400 }
      );
    }

    // Prüfen ob die URL dem User gehört
    const existingUrl = await prisma.kVPUrl.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingUrl) {
      return NextResponse.json({ error: "KVP URL not found" }, { status: 404 });
    }

    const comment = await prisma.kVPComment.create({
      data: {
        urlId: id,
        text: text.trim(),
      },
    });

    return NextResponse.json({ comment });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
