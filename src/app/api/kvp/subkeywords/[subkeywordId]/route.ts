import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// PATCH - Subkeyword aktualisieren
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ subkeywordId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { subkeywordId } = await params;
    const body = await request.json();
    const { keyword } = body;

    if (!keyword || !keyword.trim()) {
      return NextResponse.json(
        { error: "Keyword ist erforderlich" },
        { status: 400 }
      );
    }

    // Prüfen ob das Subkeyword zu einer URL des Users gehört
    const existingSubkeyword = await prisma.kVPSubkeyword.findFirst({
      where: {
        id: subkeywordId,
        url: {
          userId: session.user.id,
        },
      },
    });

    if (!existingSubkeyword) {
      return NextResponse.json(
        { error: "Subkeyword not found" },
        { status: 404 }
      );
    }

    const subkeyword = await prisma.kVPSubkeyword.update({
      where: { id: subkeywordId },
      data: {
        keyword: keyword.trim(),
      },
    });

    return NextResponse.json({ subkeyword });
  } catch (error) {
    console.error("Error updating subkeyword:", error);
    return NextResponse.json(
      { error: "Failed to update subkeyword" },
      { status: 500 }
    );
  }
}

// DELETE - Subkeyword löschen
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ subkeywordId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { subkeywordId } = await params;

    // Prüfen ob das Subkeyword zu einer URL des Users gehört
    const existingSubkeyword = await prisma.kVPSubkeyword.findFirst({
      where: {
        id: subkeywordId,
        url: {
          userId: session.user.id,
        },
      },
    });

    if (!existingSubkeyword) {
      return NextResponse.json(
        { error: "Subkeyword not found" },
        { status: 404 }
      );
    }

    await prisma.kVPSubkeyword.delete({
      where: { id: subkeywordId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting subkeyword:", error);
    return NextResponse.json(
      { error: "Failed to delete subkeyword" },
      { status: 500 }
    );
  }
}
