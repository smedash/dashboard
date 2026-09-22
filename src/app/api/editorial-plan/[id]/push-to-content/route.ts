import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { hasFullAdminRights } from "@/lib/rbac";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }
  if (!hasFullAdminRights(session.user.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;

  const entry = await prisma.editorialPlanArticle.findUnique({
    where: { id },
  });

  if (!entry) {
    return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
  }

  const nextStatus =
    entry.status === "idea" || entry.status === "planned"
      ? "in_progress"
      : entry.status;

  await prisma.editorialPlanArticle.update({
    where: { id },
    data: {
      contentPushed: true,
      contentPushedAt: new Date(),
      status: nextStatus,
    },
  });

  return NextResponse.json({
    success: true,
    entry: {
      id: entry.id,
      title: entry.title,
      category: entry.category,
      location: entry.location,
      language: entry.language,
      journeyPhase: entry.journeyPhase,
      description: entry.description,
    },
  });
}
