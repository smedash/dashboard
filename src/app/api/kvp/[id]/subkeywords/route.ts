import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// POST - Neues Subkeyword hinzufügen
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
    const { keyword } = body;

    if (!keyword || !keyword.trim()) {
      return NextResponse.json(
        { error: "Keyword ist erforderlich" },
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

    const subkeyword = await prisma.kVPSubkeyword.create({
      data: {
        urlId: id,
        keyword: keyword.trim(),
      },
    });

    return NextResponse.json({ subkeyword });
  } catch (error) {
    console.error("Error creating subkeyword:", error);
    return NextResponse.json(
      { error: "Failed to create subkeyword" },
      { status: 500 }
    );
  }
}
