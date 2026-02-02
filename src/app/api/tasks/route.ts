import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/rbac";

// GET - Alle Tasks abrufen
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tasks = await prisma.task.findMany({
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        comments: {
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [
        { status: "asc" },
        { order: "asc" },
        { createdAt: "desc" },
      ],
    });

    // Transform assignees for frontend
    const transformedTasks = tasks.map((task) => ({
      ...task,
      assignees: task.assignees.map((a) => a.user),
    }));

    return NextResponse.json({ tasks: transformedTasks });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

// POST - Neuen Task erstellen
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
    const { title, description, status, priority, dueDate, category, labels, assigneeIds } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Höchste Order in der Spalte finden
    const maxOrderTask = await prisma.task.findFirst({
      where: { status: status || "backlog" },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        status: status || "backlog",
        priority: priority || "medium",
        order: (maxOrderTask?.order ?? -1) + 1,
        dueDate: dueDate ? new Date(dueDate) : null,
        category: category || null,
        labels: labels || [],
        creatorId: session.user.id,
        assignees: assigneeIds?.length
          ? {
              create: assigneeIds.map((userId: string) => ({
                userId,
              })),
            }
          : undefined,
      },
      include: {
        creator: {
          select: { id: true, name: true, email: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        comments: true,
      },
    });

    // Transform for frontend
    const transformedTask = {
      ...task,
      assignees: task.assignees.map((a) => a.user),
    };

    return NextResponse.json({ task: transformedTask });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

// PATCH - Tasks neu ordnen (für Drag & Drop)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canEdit(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { taskId, newStatus, newOrder } = body;

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    // Hole den aktuellen Task
    const currentTask = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!currentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const oldStatus = currentTask.status;
    const oldOrder = currentTask.order;
    const targetStatus = newStatus || oldStatus;

    // Wenn Status sich ändert oder Task innerhalb derselben Spalte bewegt wird
    if (oldStatus !== targetStatus) {
      // Task wechselt die Spalte
      // 1. Lücke in alter Spalte schließen
      await prisma.task.updateMany({
        where: {
          status: oldStatus,
          order: { gt: oldOrder },
        },
        data: {
          order: { decrement: 1 },
        },
      });

      // 2. Platz in neuer Spalte machen
      await prisma.task.updateMany({
        where: {
          status: targetStatus,
          order: { gte: newOrder },
        },
        data: {
          order: { increment: 1 },
        },
      });

      // 3. Task updaten
      const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: {
          status: targetStatus,
          order: newOrder,
        },
        include: {
          creator: {
            select: { id: true, name: true, email: true },
          },
          assignees: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          comments: true,
        },
      });

      const transformedTask = {
        ...updatedTask,
        assignees: updatedTask.assignees.map((a) => a.user),
      };

      return NextResponse.json({ task: transformedTask });
    } else {
      // Task bleibt in derselben Spalte, nur Reihenfolge ändert sich
      if (newOrder > oldOrder) {
        // Nach unten bewegen
        await prisma.task.updateMany({
          where: {
            status: targetStatus,
            order: { gt: oldOrder, lte: newOrder },
          },
          data: {
            order: { decrement: 1 },
          },
        });
      } else if (newOrder < oldOrder) {
        // Nach oben bewegen
        await prisma.task.updateMany({
          where: {
            status: targetStatus,
            order: { gte: newOrder, lt: oldOrder },
          },
          data: {
            order: { increment: 1 },
          },
        });
      }

      const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: { order: newOrder },
        include: {
          creator: {
            select: { id: true, name: true, email: true },
          },
          assignees: {
            include: {
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          comments: true,
        },
      });

      const transformedTask = {
        ...updatedTask,
        assignees: updatedTask.assignees.map((a) => a.user),
      };

      return NextResponse.json({ task: transformedTask });
    }
  } catch (error) {
    console.error("Error reordering task:", error);
    return NextResponse.json({ error: "Failed to reorder task" }, { status: 500 });
  }
}
