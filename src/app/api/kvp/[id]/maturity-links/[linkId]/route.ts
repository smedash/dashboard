import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { canEdit } from "@/lib/rbac";

// DELETE - Einzelne Maturity-Verknüpfung löschen
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rollenprüfung
    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Keine Berechtigung zum Bearbeiten" }, { status: 403 });
    }

    const { id, linkId } = await params;

    // Prüfe ob Verknüpfung existiert und zum KVP gehört
    const existingLink = await prisma.$queryRaw<any[]>`
      SELECT id FROM "KVPMaturityItemLink" 
      WHERE id = ${linkId} AND "kvpUrlId" = ${id}
    `;

    if (existingLink.length === 0) {
      return NextResponse.json({ error: "Verknüpfung nicht gefunden" }, { status: 404 });
    }

    // Lösche die Verknüpfung
    await prisma.$executeRaw`
      DELETE FROM "KVPMaturityItemLink" WHERE id = ${linkId}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting maturity link:", error);
    return NextResponse.json(
      { error: "Failed to delete maturity link" },
      { status: 500 }
    );
  }
}
