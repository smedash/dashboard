"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { BarChart, PieChart } from "@/components/charts";

const STATUS_COLORS: Record<string, string> = {
  backlog: "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200",
  todo: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  in_progress: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  review: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
  done: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200",
  medium: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  high: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300",
  urgent: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
};

interface SimpleUser {
  id: string;
  name: string | null;
  email: string;
}

interface TaskData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  statusLabel: string;
  priority: string;
  priorityLabel: string;
  category: string | null;
  labels: string[];
  dueDate: string | null;
  isOverdue: boolean;
  daysUntilDue: number | null;
  assignees: SimpleUser[];
  creator: SimpleUser;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface StatusDistribution {
  status: string;
  label: string;
  count: number;
}

interface PriorityDistribution {
  priority: string;
  label: string;
  count: number;
}

interface CategoryDistribution {
  category: string;
  count: number;
}

interface WorkloadStat {
  id: string;
  name: string | null;
  email: string;
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  overdue: number;
  upcoming: number;
}

interface ReportStats {
  totalTasks: number;
  activeTasks: number;
  doneTasks: number;
  overdueCount: number;
  unassignedCount: number;
  upcomingCount: number;
  tasksWithDueDate: number;
  recentlyCompletedCount: number;
  avgCompletionDays: number | null;
}

interface TaskReportData {
  tasks: TaskData[];
  stats: ReportStats;
  statusDistribution: StatusDistribution[];
  priorityDistribution: PriorityDistribution[];
  categoryDistribution: CategoryDistribution[];
  workloadStats: WorkloadStat[];
  overdueTasks: TaskData[];
  upcomingTasks: TaskData[];
  unassignedTasks: TaskData[];
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatRelativeDays = (days: number): string => {
  if (days === 0) return "Heute fällig";
  if (days === 1) return "Morgen fällig";
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? "Tag" : "Tage"} überfällig`;
  return `In ${days} ${days === 1 ? "Tag" : "Tagen"} fällig`;
};

export default function TaskReportPage() {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<TaskReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) fetchData();
  }, [mounted]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/reporting/task-report");
      if (!res.ok) throw new Error("Fehler beim Laden der Daten");
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching task report:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Chart-Daten: Status-Verteilung (Pie)
  const statusPieData = useMemo(() => {
    if (!data) return [];
    return data.statusDistribution
      .filter((s) => s.count > 0)
      .map((s) => ({ name: s.label, value: s.count }));
  }, [data]);

  // Chart-Daten: Prioritäts-Verteilung (Pie)
  const priorityPieData = useMemo(() => {
    if (!data) return [];
    return data.priorityDistribution
      .filter((p) => p.count > 0)
      .map((p) => ({ name: p.label, value: p.count }));
  }, [data]);

  // Chart-Daten: Workload Bar
  const workloadBarData = useMemo(() => {
    if (!data) return [];
    return data.workloadStats.map((w) => ({
      name: w.name || w.email.split("@")[0],
      "In Arbeit": w.byStatus["in_progress"] || 0,
      "To Do": w.byStatus["todo"] || 0,
      Review: w.byStatus["review"] || 0,
      Backlog: w.byStatus["backlog"] || 0,
    }));
  }, [data]);

  // Chart-Daten: Kategorie
  const categoryBarData = useMemo(() => {
    if (!data) return [];
    return data.categoryDistribution.map((c) => ({
      category: c.category,
      Aufgaben: c.count,
    }));
  }, [data]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/reporting"
          className="inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 mb-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück zu Reporting
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Task Report</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Übersicht aller Aufgaben im Kanban Board mit Status, Workload und Timeline
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      ) : !data ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-slate-500 dark:text-slate-400">Fehler beim Laden der Daten.</p>
        </div>
      ) : data.stats.totalTasks === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Keine Tasks vorhanden</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            Erstelle zuerst Aufgaben im Kanban Board.
          </p>
          <Link href="/tasks" className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            Zum Kanban Board
          </Link>
        </div>
      ) : (
        <>
          {/* Übersicht Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard title="Gesamt Tasks" value={data.stats.totalTasks} />
            <StatCard title="Aktiv" value={data.stats.activeTasks} subtitle="Nicht erledigt" />
            <StatCard title="Erledigt" value={data.stats.doneTasks} trend="up" subtitle="Gesamt" />
            <StatCard
              title="Überfällig"
              value={data.stats.overdueCount}
              trend={data.stats.overdueCount > 0 ? "down" : undefined}
            />
            <StatCard title="Bald fällig" value={data.stats.upcomingCount} subtitle="Nächste 7 Tage" />
            <StatCard title="Ohne Zuweisung" value={data.stats.unassignedCount} />
          </div>

          {/* Zusätzliche KPIs */}
          {(data.stats.recentlyCompletedCount > 0 || data.stats.avgCompletionDays !== null) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">{data.stats.recentlyCompletedCount}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">Tasks in den letzten 30 Tagen erledigt</div>
                </div>
              </div>
              {data.stats.avgCompletionDays !== null && (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{data.stats.avgCompletionDays} Tage</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">Durchschnittliche Bearbeitungszeit</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Charts Row 1: Status & Priorität */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Status-Verteilung</h3>
              {statusPieData.length > 0 ? (
                <PieChart data={statusPieData} height={280} />
              ) : (
                <div className="h-[280px] flex items-center justify-center text-slate-500">Keine Daten</div>
              )}
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Prioritäts-Verteilung (aktive Tasks)</h3>
              {priorityPieData.length > 0 ? (
                <PieChart data={priorityPieData} height={280} />
              ) : (
                <div className="h-[280px] flex items-center justify-center text-slate-500">Keine Daten</div>
              )}
            </div>
          </div>

          {/* Workload pro Benutzer */}
          {data.workloadStats.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Workload pro Benutzer</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Aktive Tasks nach Status pro zugewiesenem Benutzer
              </p>

              {workloadBarData.length > 0 && (
                <div className="mb-6">
                  <BarChart
                    data={workloadBarData}
                    xKey="name"
                    yKey="In Arbeit"
                    height={280}
                    color="#f59e0b"
                  />
                </div>
              )}

              {/* Detail-Karten pro Benutzer */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.workloadStats.map((user) => (
                  <div
                    key={user.id}
                    className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {(user.name || user.email)[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {user.name || user.email.split("@")[0]}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-500 truncate">{user.email}</div>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-slate-900 dark:text-white shrink-0">{user.total}</span>
                    </div>

                    {/* Status-Badges */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {Object.entries(user.byStatus).map(([status, count]) => (
                        <span
                          key={status}
                          className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[status] || "bg-slate-200 text-slate-700"}`}
                        >
                          {count}x {
                            status === "backlog" ? "Backlog" :
                            status === "todo" ? "To Do" :
                            status === "in_progress" ? "In Arbeit" :
                            status === "review" ? "Review" : status
                          }
                        </span>
                      ))}
                    </div>

                    {/* Warnungen */}
                    <div className="flex items-center gap-3 text-xs">
                      {user.overdue > 0 && (
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          {user.overdue} überfällig
                        </span>
                      )}
                      {user.upcoming > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          {user.upcoming} bald fällig
                        </span>
                      )}
                      {user.overdue === 0 && user.upcoming === 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          Keine fälligen Tasks
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Kategorie-Verteilung */}
          {categoryBarData.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Aktive Tasks nach Kategorie</h3>
              <BarChart
                data={categoryBarData}
                xKey="category"
                yKey="Aufgaben"
                height={250}
                color="#6366f1"
              />
            </div>
          )}

          {/* Überfällige Tasks */}
          {data.overdueTasks.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-red-200 dark:border-red-900/50 overflow-hidden">
              <div className="p-6 border-b border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">
                    Überfällige Tasks ({data.overdueTasks.length})
                  </h3>
                </div>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {data.overdueTasks.map((task) => (
                  <TaskRow key={task.id} task={task} highlight="overdue" />
                ))}
              </div>
            </div>
          )}

          {/* Bald fällige Tasks */}
          {data.upcomingTasks.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-900/50 overflow-hidden">
              <div className="p-6 border-b border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-400">
                    Bald fällig - nächste 7 Tage ({data.upcomingTasks.length})
                  </h3>
                </div>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {data.upcomingTasks.map((task) => (
                  <TaskRow key={task.id} task={task} highlight="upcoming" />
                ))}
              </div>
            </div>
          )}

          {/* Nicht zugewiesene Tasks */}
          {data.unassignedTasks.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-orange-50 dark:bg-orange-900/20">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-orange-700 dark:text-orange-400">
                    Nicht zugewiesen ({data.unassignedTasks.length})
                  </h3>
                </div>
                <p className="text-sm text-orange-600 dark:text-orange-400/80 mt-1">
                  Aktive Tasks ohne zugewiesene Bearbeiter
                </p>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {data.unassignedTasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {/* Alle aktiven Tasks nach Status */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Alle aktiven Tasks ({data.stats.activeTasks})
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Nach Status gruppiert (ohne erledigte Tasks)
              </p>
            </div>

            {["in_progress", "review", "todo", "backlog"].map((status) => {
              const statusTasks = data.tasks.filter(
                (t) => t.status === status
              );
              if (statusTasks.length === 0) return null;
              const label =
                status === "in_progress" ? "In Arbeit" :
                status === "review" ? "Review" :
                status === "todo" ? "To Do" :
                "Backlog";

              return (
                <div key={status}>
                  <div className="px-6 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_COLORS[status]}`}>
                          {label}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {statusTasks.length} {statusTasks.length === 1 ? "Task" : "Tasks"}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {statusTasks.map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Task-Zeile Komponente
function TaskRow({
  task,
  highlight,
}: {
  task: TaskData;
  highlight?: "overdue" | "upcoming";
}) {
  return (
    <div className="px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/tasks"
              className="text-sm font-medium text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {task.title}
            </Link>
            <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded-full ${PRIORITY_COLORS[task.priority]}`}>
              {task.priorityLabel}
            </span>
            {task.category && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {task.category}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {task.dueDate && (
              <span
                className={`text-xs font-medium ${
                  highlight === "overdue" || task.isOverdue
                    ? "text-red-600 dark:text-red-400"
                    : highlight === "upcoming"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {formatDate(task.dueDate)}
                {task.daysUntilDue !== null && (
                  <> ({formatRelativeDays(task.daysUntilDue)})</>
                )}
              </span>
            )}
            {task.commentCount > 0 && (
              <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {task.commentCount}
              </span>
            )}
            {task.labels.length > 0 && (
              <div className="flex gap-1">
                {task.labels.slice(0, 2).map((label) => (
                  <span key={label} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                    {label}
                  </span>
                ))}
                {task.labels.length > 2 && (
                  <span className="text-xs text-slate-400">+{task.labels.length - 2}</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {task.assignees.length > 0 ? (
            <div className="flex -space-x-1.5">
              {task.assignees.slice(0, 3).map((a) => (
                <div
                  key={a.id}
                  className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold border-2 border-white dark:border-slate-800"
                  title={a.name || a.email}
                >
                  {(a.name || a.email)[0].toUpperCase()}
                </div>
              ))}
              {task.assignees.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-slate-400 flex items-center justify-center text-white text-xs font-bold border-2 border-white dark:border-slate-800">
                  +{task.assignees.length - 3}
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-orange-500 dark:text-orange-400 italic">
              Keine Zuweisung
            </span>
          )}
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[task.status]}`}>
            {task.statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
