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
    const { title, description, url, category, status, plannedDate, metaDescription, h1, schemaMarkup, location } = body;

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
    const { id, title, description, url, category, status, plannedDate, metaDescription, h1, schemaMarkup, location } = body;

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const article = await prisma.editorialPlanArticle.update({
      where: { id },
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
      },
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
