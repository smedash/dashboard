import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

// DELETE - Keyword löschen
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Prüfe Bearbeitungsberechtigung (teamweiter Zugriff)
    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    // Prüfe ob Keyword existiert
    const keyword = await prisma.rankTrackerKeyword.findUnique({
      where: { id },
    });

    if (!keyword) {
      return NextResponse.json(
        { error: "Keyword nicht gefunden" },
        { status: 404 }
      );
    }

    // Lösche Keyword (Rankings werden durch Cascade gelöscht)
    await prisma.rankTrackerKeyword.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting keyword:", error);
    return NextResponse.json(
      { error: "Failed to delete keyword" },
      { status: 500 }
    );
  }
}
