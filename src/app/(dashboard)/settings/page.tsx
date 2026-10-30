"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useProperty } from "@/contexts/PropertyContext";
import { useLocale, useMessages } from "@/i18n/I18nProvider";
import { settingsMessages } from "@/i18n/messages/settings";
import type { SyncLogEntry } from "@/lib/technical-seo";
import Link from "next/link";

interface Property {
  siteUrl: string;
  permissionLevel?: string;
}

function extractDomain(property: string): string {
  if (property.startsWith("sc-domain:")) {
    return property.replace("sc-domain:", "").replace(/^www\./, "");
  }
  try {
    return new URL(property).hostname.replace(/^www\./, "");
  } catch {
    return property.replace(/^www\./, "");
  }
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const { selectedProperty } = useProperty();
  const t = useMessages(settingsMessages);
  const { intlLocale } = useLocale();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasGoogleConnection, setHasGoogleConnection] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text?: string; code?: string } | null>(null);

  // Conductor Monitoring State
  const [cmSyncing, setCmSyncing] = useState(false);
  const [cmLastSync, setCmLastSync] = useState<string | null>(null);
  const [cmSyncResult, setCmSyncResult] = useState<{ pages: number; issues: number; durationMs: number } | null>(null);
  const [cmSyncLogs, setCmSyncLogs] = useState<SyncLogEntry[]>([]);
  const [cmProgress, setCmProgress] = useState<number | null>(null);
  const [piRunning, setPiRunning] = useState(false);
  const [piProgress, setPiProgress] = useState<{ done: number; pending: number | null }>({ done: 0, pending: null });
  const [piResult, setPiResult] = useState<string | null>(null);
  const piStopRequested = useRef(false);

  const currentDomain = selectedProperty ? extractDomain(selectedProperty) : null;

  const fetchCmSyncLogs = useCallback(async () => {
    if (!currentDomain) return;
    try {
      const res = await fetch(`/api/conductor-monitoring/sync-logs?domain=${encodeURIComponent(currentDomain)}`);
      const data = await res.json();
      setCmSyncLogs(data.logs || []);
      setCmLastSync(data.lastSyncAt || null);
    } catch { /* ignore */ }
  }, [currentDomain]);

  useEffect(() => {
    fetchCmSyncLogs();
  }, [fetchCmSyncLogs]);

  const handleCmSync = useCallback(async () => {
    if (!currentDomain) return;
    setCmSyncing(true);
    setCmSyncResult(null);
    setCmProgress(null);
    try {
      // Each request syncs a time slice; large websites need several slices.
      for (;;) {
        const res = await fetch("/api/conductor-monitoring/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: currentDomain }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t.conductor.syncFailed);
        if (data.status === "locked") throw new Error(t.conductor.syncLocked);
        if (data.status === "paused") {
          setCmProgress(data.pagesProcessed);
          fetchCmSyncLogs();
          continue;
        }
        setCmSyncResult({ pages: data.pagesProcessed, issues: data.issuesProcessed, durationMs: data.durationMs });
        break;
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : t.conductor.conductorSyncFailed });
    } finally {
      setCmSyncing(false);
      setCmProgress(null);
      fetchCmSyncLogs();
    }
  }, [currentDomain, t, fetchCmSyncLogs]);

  const handlePageIssues = useCallback(async () => {
    if (!currentDomain) return;
    piStopRequested.current = false;
    setPiRunning(true);
    setPiResult(null);
    setPiProgress({ done: 0, pending: null });
    let done = 0;
    try {
      // Each request works through a time slice; the server keeps the progress.
      for (;;) {
        const res = await fetch("/api/conductor-monitoring/page-issues", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: currentDomain }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t.conductor.pageIssues.failed);
        done += data.processed;
        setPiProgress({ done, pending: data.pending });
        if (data.pending === 0) {
          setPiResult(t.conductor.pageIssues.done(done));
          break;
        }
        if (piStopRequested.current) {
          setPiResult(t.conductor.pageIssues.stopped(data.pending));
          break;
        }
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : t.conductor.pageIssues.failed });
    } finally {
      setPiRunning(false);
    }
  }, [currentDomain, t]);

  // Check for success/error messages from OAuth callback
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "google_linked") {
      setMessage({ type: "success", code: "googleLinked" });
      // Reload to show updated connection status
      window.history.replaceState({}, "", "/settings");
    } else if (error) {
      setMessage({ type: "error", code: error });
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams]);

  useEffect(() => {
    async function checkConnection() {
      try {
        const response = await fetch("/api/gsc/properties");
        const data = await response.json();

        if (data.needsConnection) {
          setHasGoogleConnection(false);
        } else {
          setHasGoogleConnection(true);
          setProperties(data.properties || []);
        }
      } catch {
        setHasGoogleConnection(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkConnection();
  }, [message]); // Reload when message changes (after linking)

  const handleLinkGoogle = () => {
    window.location.href = "/api/auth/link-google";
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-white">{t.title}</h1>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border border-red-500/30 text-red-400"
          }`}
        >
          {message.text ?? t.feedback[message.code ?? ""] ?? t.feedback.unknownError}
        </div>
      )}

      {/* Account Section */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">{t.account.title}</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-slate-700">
            <div>
              <p className="text-sm text-slate-400">{t.account.email}</p>
              <p className="text-white">{session?.user?.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-slate-400">{t.account.name}</p>
              <p className="text-white">{session?.user?.name || t.account.notSpecified}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Google Connection Section */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Google Search Console</h2>
        
        {isLoading ? (
          <div className="animate-pulse h-20 bg-slate-700 rounded-lg"></div>
        ) : hasGoogleConnection ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-emerald-400">{t.google.connected}</span>
            </div>

            <div>
              <p className="text-sm text-slate-400 mb-2">{t.google.availableProperties(properties.length)}</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {properties.map((property) => (
                  <div
                    key={property.siteUrl}
                    className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg"
                  >
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <span className="text-white text-sm">
                      {property.siteUrl.replace(/^(sc-domain:|https?:\/\/)/, "")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleLinkGoogle}
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              {t.google.connectOther}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-slate-400">
              {t.google.connectHint}
            </p>
            <button
              onClick={handleLinkGoogle}
              className="inline-flex items-center gap-3 px-6 py-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold rounded-lg transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {t.google.connect}
            </button>
          </div>
        )}
      </div>

      {/* Conductor Monitoring Section */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">Conductor Monitoring</h2>
        <p className="text-sm text-slate-400 mb-4">
          {t.conductor.description}
        </p>

        {currentDomain && (
          <div className="flex items-center gap-2 text-sm text-blue-400 mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            {t.conductor.activeProperty(currentDomain)}
          </div>
        )}

        <div className="space-y-4">
          {cmLastSync && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t.conductor.lastSync(new Date(cmLastSync).toLocaleString(intlLocale))}
            </div>
          )}

          {cmSyncResult && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm text-emerald-400">
              {t.conductor.syncDone(cmSyncResult.pages, cmSyncResult.issues, (cmSyncResult.durationMs / 1000).toFixed(1))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleCmSync}
            disabled={cmSyncing || !currentDomain}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium rounded-lg transition-colors"
          >
            {cmSyncing ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {cmProgress !== null ? t.conductor.syncProgress(cmProgress) : t.conductor.syncing}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t.conductor.syncNow}
              </>
            )}
          </button>
          {cmLastSync && (
            <Link
              href="/technical-seo"
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
            >
              {t.conductor.viewData}
            </Link>
          )}
          </div>

          {cmLastSync && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={
                    piRunning
                      ? () => {
                          piStopRequested.current = true;
                        }
                      : handlePageIssues
                  }
                  disabled={!currentDomain || cmSyncing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
                >
                  {piRunning && (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {piRunning ? t.conductor.pageIssues.stop : t.conductor.pageIssues.start}
                </button>
                {piRunning && (
                  <span className="text-sm text-slate-400">
                    {t.conductor.pageIssues.running(piProgress.done, piProgress.pending)}
                  </span>
                )}
              </div>
              {piResult && !piRunning && <p className="text-sm text-emerald-400">{piResult}</p>}
              <p className="text-xs text-slate-500">{t.conductor.pageIssues.hint}</p>
            </div>
          )}

          <div className="pt-4 border-t border-slate-700">
            <h3 className="text-sm font-semibold text-white mb-3">{t.conductor.history}</h3>
            {cmSyncLogs.length === 0 ? (
              <p className="text-sm text-slate-400">{t.conductor.noHistory}</p>
            ) : (
              <ul className="divide-y divide-slate-700">
                {cmSyncLogs.map((log) => {
                  const statusStyle = {
                    completed: "bg-emerald-500/15 text-emerald-400",
                    running: "bg-blue-500/15 text-blue-400",
                    paused: "bg-amber-500/15 text-amber-400",
                    failed: "bg-red-500/15 text-red-400",
                    aborted: "bg-slate-500/15 text-slate-400",
                  }[log.status];
                  const statusHint =
                    log.status === "paused"
                      ? t.conductor.pausedHint
                      : log.status === "aborted"
                        ? t.conductor.abortedHint
                        : undefined;
                  return (
                    <li key={log.id} className="py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-slate-300 tabular-nums">
                          {new Date(log.createdAt).toLocaleString(intlLocale)}
                        </span>
                        <span className="text-slate-500">
                          {t.conductor.syncTypes[log.type] ?? log.type}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle}`}
                          title={statusHint}
                        >
                          {t.conductor.statuses[log.status]}
                        </span>
                        {log.status === "completed" && (
                          <span className="text-slate-400">
                            {t.conductor.historyResult(log.pagesProcessed, log.issuesProcessed)}
                            {log.durationMs !== null && ` · ${(log.durationMs / 1000).toFixed(1)}s`}
                          </span>
                        )}
                        {(log.status === "running" || log.status === "paused") && log.pagesProcessed > 0 && (
                          <span className="text-slate-400">{t.conductor.historyProgress(log.pagesProcessed)}</span>
                        )}
                      </div>
                      {log.error && (
                        <p className="mt-1 text-xs text-red-400 break-words">{log.error}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Logout Section */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">{t.session.title}</h2>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-lg transition-colors"
        >
          {t.session.signOut}
        </button>
      </div>
    </div>
  );
}

