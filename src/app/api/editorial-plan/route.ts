import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const articles = await prisma.editorialPlanArticle.findMany({
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: [
        { plannedDate: "asc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ articles });
  } catch (error) {
    console.error("Error fetching editorial plan articles:", error);
    return NextResponse.json({ error: "Failed to fetch articles" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, url, category, status, plannedDate, metaDescription, h1, schemaMarkup, location, journeyPhase } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const article = await prisma.editorialPlanArticle.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        url: url?.trim() || null,
        category: category || null,
        status: status || "idea",
        plannedDate: plannedDate ? new Date(plannedDate) : null,
        metaDescription: metaDescription?.trim() || null,
        h1: h1?.trim() || null,
        schemaMarkup: schemaMarkup?.trim() || null,
        location: location || null,
        journeyPhase: journeyPhase || null,
        creatorId: session.user.id,
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ article });
  } catch (error) {
    console.error("Error creating editorial plan article:", error);
    return NextResponse.json({ error: "Failed to create article" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, title, description, url, category, status, plannedDate, metaDescription, h1, schemaMarkup, location, journeyPhase } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    if (title !== undefined && !title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (url !== undefined) updateData.url = url?.trim() || null;
    if (category !== undefined) updateData.category = category || null;
    if (status !== undefined) updateData.status = status || "idea";
    if (plannedDate !== undefined) updateData.plannedDate = plannedDate ? new Date(plannedDate) : null;
    if (metaDescription !== undefined) updateData.metaDescription = metaDescription?.trim() || null;
    if (h1 !== undefined) updateData.h1 = h1?.trim() || null;
    if (schemaMarkup !== undefined) updateData.schemaMarkup = schemaMarkup?.trim() || null;
    if (location !== undefined) updateData.location = location || null;
    if (journeyPhase !== undefined) updateData.journeyPhase = journeyPhase || null;

    const article = await prisma.editorialPlanArticle.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ article });
  } catch (error) {
    console.error("Error updating editorial plan article:", error);
    return NextResponse.json({ error: "Failed to update article" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.editorialPlanArticle.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting editorial plan article:", error);
    return NextResponse.json({ error: "Failed to delete article" }, { status: 500 });
  }
}
