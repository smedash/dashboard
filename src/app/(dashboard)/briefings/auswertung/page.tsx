"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { hasFullAdminRights } from "@/lib/rbac";
import { StatCard } from "@/components/ui/StatCard";
import { BarChart } from "@/components/charts";

interface BriefingStats {
  timeBasedStats: {
    last30Days: number;
    last60Days: number;
    last90Days: number;
    last180Days: number;
  };
  userStats: {
    userId: string;
    name: string;
    email: string;
    total: number;
    ordered: number;
    inProgress: number;
    completed: number;
    last30Days: number;
  }[];
  processingTime: {
    avgDays: number;
    completedCount: number;
  };
  byType: {
    new_content: { total: number; completed: number; inProgress: number; ordered: number };
    edit_content: { total: number; completed: number; inProgress: number; ordered: number };
    lexicon: { total: number; completed: number; inProgress: number; ordered: number };
  };
  statusOverview: {
    total: number;
    ordered: number;
    inProgress: number;
    completed: number;
  };
  overdueBriefings: number;
  monthlyTrend: { month: string; count: number }[];
}

export default function BriefingAuswertungPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<BriefingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = hasFullAdminRights(session?.user?.role);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/briefings/stats");
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Fehler beim Laden");
      }
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error("Error fetching stats:", err);
      setError(err instanceof Error ? err.message : "Fehler beim Laden der Statistiken");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Briefing Auswertung</h1>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-500">Diese Seite ist nur für Administratoren zugänglich.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Briefing Auswertung</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Briefing Auswertung</h1>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-500">{error}</p>
          <button
            onClick={fetchStats}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const completionRate = stats.statusOverview.total > 0
    ? Math.round((stats.statusOverview.completed / stats.statusOverview.total) * 100)
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Briefing Auswertung</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Statistiken und Auswertungen zu Content-Briefings
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Aktualisieren
        </button>
      </div>

      {/* Zeitraum-basierte Statistiken */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Briefings nach Zeitraum
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Letzte 30 Tage"
            value={stats.timeBasedStats.last30Days}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />
          <StatCard
            title="Letzte 60 Tage"
            value={stats.timeBasedStats.last60Days}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />
          <StatCard
            title="Letzte 90 Tage"
            value={stats.timeBasedStats.last90Days}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />
          <StatCard
            title="Letzte 180 Tage"
            value={stats.timeBasedStats.last180Days}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
          />
        </div>
      </div>

      {/* KPI Übersicht */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Kennzahlen
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Gesamt Briefings"
            value={stats.statusOverview.total}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          />
          <StatCard
            title="Ø Bearbeitungszeit"
            value={`${stats.processingTime.avgDays} Tage`}
            subtitle={`Basierend auf ${stats.processingTime.completedCount} abgeschlossenen`}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            title="Abschlussrate"
            value={`${completionRate}%`}
            subtitle={`${stats.statusOverview.completed} von ${stats.statusOverview.total}`}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            title="Überfällig"
            value={stats.overdueBriefings}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
          />
        </div>
      </div>

      {/* Status Übersicht & Typ-Verteilung */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Übersicht */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Status Übersicht
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-slate-700 dark:text-slate-300">Bestellt</span>
              </div>
              <span className="font-semibold text-slate-900 dark:text-white">{stats.statusOverview.ordered}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-slate-700 dark:text-slate-300">In Bearbeitung</span>
              </div>
              <span className="font-semibold text-slate-900 dark:text-white">{stats.statusOverview.inProgress}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-slate-700 dark:text-slate-300">Fertig</span>
              </div>
              <span className="font-semibold text-slate-900 dark:text-white">{stats.statusOverview.completed}</span>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-6">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
              {stats.statusOverview.total > 0 && (
                <>
                  <div 
                    className="bg-green-500 transition-all duration-500"
                    style={{ width: `${(stats.statusOverview.completed / stats.statusOverview.total) * 100}%` }}
                  ></div>
                  <div 
                    className="bg-yellow-500 transition-all duration-500"
                    style={{ width: `${(stats.statusOverview.inProgress / stats.statusOverview.total) * 100}%` }}
                  ></div>
                  <div 
                    className="bg-blue-500 transition-all duration-500"
                    style={{ width: `${(stats.statusOverview.ordered / stats.statusOverview.total) * 100}%` }}
                  ></div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Typ Verteilung */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Briefing-Typen
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
              <div>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">Neuer Content</span>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {stats.byType.new_content.completed} fertig / {stats.byType.new_content.inProgress} in Bearbeitung / {stats.byType.new_content.ordered} bestellt
                </div>
              </div>
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.byType.new_content.total}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg border border-orange-500/30">
              <div>
                <span className="font-medium text-orange-600 dark:text-orange-400">Content überarbeiten</span>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {stats.byType.edit_content.completed} fertig / {stats.byType.edit_content.inProgress} in Bearbeitung / {stats.byType.edit_content.ordered} bestellt
                </div>
              </div>
              <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.byType.edit_content.total}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/30">
              <div>
                <span className="font-medium text-purple-600 dark:text-purple-400">Lexikon</span>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {stats.byType.lexicon.completed} fertig / {stats.byType.lexicon.inProgress} in Bearbeitung / {stats.byType.lexicon.ordered} bestellt
                </div>
              </div>
              <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.byType.lexicon.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Monatliche Entwicklung */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Monatliche Entwicklung (letzte 6 Monate)
        </h3>
        <div className="h-64">
          <BarChart
            data={stats.monthlyTrend.map(item => ({
              month: item.month,
              count: item.count,
            }))}
            xKey="month"
            yKey="count"
            color="#3b82f6"
          />
        </div>
      </div>

      {/* Briefings pro User */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Briefings pro Besteller
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Besteller</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Gesamt</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Bestellt</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">In Bearbeitung</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Fertig</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-400">Letzte 30 Tage</th>
              </tr>
            </thead>
            <tbody>
              {stats.userStats.map((user) => (
                <tr key={user.userId} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="py-3 px-4">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{user.name || "Kein Name"}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                    </div>
                  </td>
                  <td className="text-right py-3 px-4 font-semibold text-slate-900 dark:text-white">{user.total}</td>
                  <td className="text-right py-3 px-4">
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400">
                      {user.ordered}
                    </span>
                  </td>
                  <td className="text-right py-3 px-4">
                    <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                      {user.inProgress}
                    </span>
                  </td>
                  <td className="text-right py-3 px-4">
                    <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-600 dark:text-green-400">
                      {user.completed}
                    </span>
                  </td>
                  <td className="text-right py-3 px-4 text-slate-600 dark:text-slate-400">{user.last30Days}</td>
                </tr>
              ))}
              {stats.userStats.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Noch keine Briefings vorhanden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
