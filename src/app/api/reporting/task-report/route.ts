import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const STATUS_ORDER = ["backlog", "todo", "in_progress", "review", "done"];
const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Arbeit",
  review: "Review",
  done: "Erledigt",
};
const PRIORITY_LABELS: Record<string, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
  urgent: "Dringend",
};

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Alle Tasks mit Relationen laden
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
          select: { id: true, createdAt: true },
        },
      },
      orderBy: [{ status: "asc" }, { order: "asc" }, { createdAt: "desc" }],
    });

    const now = new Date();

    // Tasks transformieren
    const transformedTasks = tasks.map((task) => {
      const isOverdue =
        task.dueDate && new Date(task.dueDate) < now && task.status !== "done";
      const daysUntilDue = task.dueDate
        ? Math.ceil(
            (new Date(task.dueDate).getTime() - now.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null;

      return {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        statusLabel: STATUS_LABELS[task.status] || task.status,
        priority: task.priority,
        priorityLabel: PRIORITY_LABELS[task.priority] || task.priority,
        category: task.category,
        labels: task.labels,
        dueDate: task.dueDate?.toISOString() || null,
        isOverdue,
        daysUntilDue,
        assignees: task.assignees.map((a) => ({
          id: a.user.id,
          name: a.user.name,
          email: a.user.email,
        })),
        creator: task.creator,
        commentCount: task.comments.length,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      };
    });

    // --- Statistiken ---

    const totalTasks = transformedTasks.length;
    const activeTasks = transformedTasks.filter(
      (t) => t.status !== "done"
    ).length;
    const doneTasks = transformedTasks.filter(
      (t) => t.status === "done"
    ).length;
    const overdueTasks = transformedTasks.filter((t) => t.isOverdue);
    const tasksWithDueDate = transformedTasks.filter(
      (t) => t.dueDate !== null
    ).length;
    const unassignedTasks = transformedTasks.filter(
      (t) => t.assignees.length === 0 && t.status !== "done"
    );

    // Tasks die in den nächsten 7 Tagen fällig sind
    const upcomingTasks = transformedTasks.filter(
      (t) =>
        t.daysUntilDue !== null &&
        t.daysUntilDue >= 0 &&
        t.daysUntilDue <= 7 &&
        t.status !== "done"
    );

    // Status-Verteilung
    const statusDistribution = STATUS_ORDER.map((status) => ({
      status,
      label: STATUS_LABELS[status],
      count: transformedTasks.filter((t) => t.status === status).length,
    }));

    // Prioritäts-Verteilung (nur aktive Tasks)
    const priorityDistribution = ["urgent", "high", "medium", "low"].map(
      (priority) => ({
        priority,
        label: PRIORITY_LABELS[priority],
        count: transformedTasks.filter(
          (t) => t.priority === priority && t.status !== "done"
        ).length,
      })
    );

    // Kategorie-Verteilung (nur aktive Tasks)
    const categoryMap = transformedTasks
      .filter((t) => t.status !== "done")
      .reduce(
        (acc, t) => {
          const cat = t.category || "Keine Kategorie";
          acc[cat] = (acc[cat] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

    const categoryDistribution = Object.entries(categoryMap)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    // Workload pro Benutzer
    const userWorkload: Record<
      string,
      {
        id: string;
        name: string | null;
        email: string;
        total: number;
        byStatus: Record<string, number>;
        byPriority: Record<string, number>;
        overdue: number;
        upcoming: number;
      }
    > = {};

    transformedTasks
      .filter((t) => t.status !== "done")
      .forEach((task) => {
        task.assignees.forEach((assignee) => {
          if (!userWorkload[assignee.id]) {
            userWorkload[assignee.id] = {
              id: assignee.id,
              name: assignee.name,
              email: assignee.email,
              total: 0,
              byStatus: {},
              byPriority: {},
              overdue: 0,
              upcoming: 0,
            };
          }
          const user = userWorkload[assignee.id];
          user.total++;
          user.byStatus[task.status] =
            (user.byStatus[task.status] || 0) + 1;
          user.byPriority[task.priority] =
            (user.byPriority[task.priority] || 0) + 1;
          if (task.isOverdue) user.overdue++;
          if (
            task.daysUntilDue !== null &&
            task.daysUntilDue >= 0 &&
            task.daysUntilDue <= 7
          ) {
            user.upcoming++;
          }
        });
      });

    const workloadStats = Object.values(userWorkload).sort(
      (a, b) => b.total - a.total
    );

    // Erledigte Tasks in den letzten 30 Tagen
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentlyCompleted = transformedTasks.filter(
      (t) =>
        t.status === "done" && new Date(t.updatedAt) >= thirtyDaysAgo
    );

    // Durchschnittliche Bearbeitungszeit (nur erledigte Tasks mit dueDate)
    const completedWithDates = transformedTasks.filter(
      (t) => t.status === "done" && t.createdAt
    );
    let avgCompletionDays: number | null = null;
    if (completedWithDates.length > 0) {
      const totalDays = completedWithDates.reduce((sum, t) => {
        const created = new Date(t.createdAt);
        const updated = new Date(t.updatedAt);
        return sum + (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      }, 0);
      avgCompletionDays = Math.round((totalDays / completedWithDates.length) * 10) / 10;
    }

    return NextResponse.json({
      tasks: transformedTasks,
      stats: {
        totalTasks,
        activeTasks,
        doneTasks,
        overdueCount: overdueTasks.length,
        unassignedCount: unassignedTasks.length,
        upcomingCount: upcomingTasks.length,
        tasksWithDueDate,
        recentlyCompletedCount: recentlyCompleted.length,
        avgCompletionDays,
      },
      statusDistribution,
      priorityDistribution,
      categoryDistribution,
      workloadStats,
      overdueTasks: overdueTasks.sort(
        (a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0)
      ),
      upcomingTasks: upcomingTasks.sort(
        (a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0)
      ),
      unassignedTasks,
    });
  } catch (error) {
    console.error("Error fetching task report:", error);
    return NextResponse.json(
      { error: "Failed to fetch task report data" },
      { status: 500 }
    );
  }
}
