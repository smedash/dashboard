"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { TopicSunburstChart } from "@/components/charts";

interface TopicGraphNode {
  label: string;
  children: TopicGraphNode[];
}

interface TopicGraphJob {
  id: string;
  created_at: string;
  parameters: {
    country_code: string;
    language_code: string;
    keyword: string;
  };
  status: "processing" | "failed" | "succeeded";
  topic_graph: TopicGraphNode | null;
}

function TopicNode({ node, depth = 0 }: { node: TopicGraphNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  const depthColors = [
    "bg-blue-500/20 border-blue-500/40 text-blue-300",
    "bg-emerald-500/20 border-emerald-500/40 text-emerald-300",
    "bg-amber-500/20 border-amber-500/40 text-amber-300",
    "bg-purple-500/20 border-purple-500/40 text-purple-300",
    "bg-rose-500/20 border-rose-500/40 text-rose-300",
    "bg-cyan-500/20 border-cyan-500/40 text-cyan-300",
  ];

  const colorClass = depthColors[depth % depthColors.length];

  return (
    <div className={depth > 0 ? "ml-6 mt-2" : "mt-2"}>
      <div className="flex items-center gap-2">
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-slate-400 hover:text-white transition-colors w-5 h-5 flex items-center justify-center flex-shrink-0"
          >
            <svg
              className={`w-4 h-4 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        {!hasChildren && <span className="w-5" />}
        <span
          className={`inline-block px-3 py-1.5 rounded-lg border text-sm font-medium ${colorClass}`}
        >
          {node.label}
          {hasChildren && (
            <span className="ml-2 text-xs opacity-60">({node.children.length})</span>
          )}
        </span>
      </div>
      {expanded && hasChildren && (
        <div className="border-l border-slate-700 ml-2.5">
          {node.children.map((child, i) => (
            <TopicNode key={`${child.label}-${i}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function flattenTopics(node: TopicGraphNode, depth = 0): { label: string; depth: number }[] {
  const result: { label: string; depth: number }[] = [{ label: node.label, depth }];
  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenTopics(child, depth + 1));
    }
  }
  return result;
}

function flattenForExport(
  node: TopicGraphNode,
  path: string[] = []
): { topic: string; ebene: number; pfad: string }[] {
  const currentPath = [...path, node.label];
  const rows: { topic: string; ebene: number; pfad: string }[] = [
    { topic: node.label, ebene: currentPath.length, pfad: currentPath.join(" > ") },
  ];
  if (node.children) {
    for (const child of node.children) {
      rows.push(...flattenForExport(child, currentPath));
    }
  }
  return rows;
}

function TopicContent({ job }: { job: TopicGraphJob }) {
  const [view, setView] = useState<"tree" | "sunburst">("sunburst");

  const exportToXlsx = () => {
    if (!job.topic_graph) return;
    const rows = flattenForExport(job.topic_graph);
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: ["topic", "ebene", "pfad"],
    });
    ws["!cols"] = [{ wch: 40 }, { wch: 8 }, { wch: 80 }];
    XLSX.utils.sheet_add_aoa(ws, [["Topic", "Ebene", "Pfad"]], { origin: "A1" });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Topics");
    XLSX.writeFile(wb, `topics-${job.parameters.keyword.replace(/\s+/g, "-")}.xlsx`);
  };

  return (
    <div className="border-t border-slate-700">
      <div className="px-6 pt-4 flex gap-2">
        <button
          onClick={() => setView("sunburst")}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            view === "sunburst"
              ? "bg-blue-600 text-white"
              : "bg-slate-700 text-slate-300 hover:bg-slate-600"
          }`}
        >
          Sunburst
        </button>
        <button
          onClick={() => setView("tree")}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            view === "tree"
              ? "bg-blue-600 text-white"
              : "bg-slate-700 text-slate-300 hover:bg-slate-600"
          }`}
        >
          Baumansicht
        </button>
        <button
          onClick={exportToXlsx}
          className="ml-auto px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Excel Export
        </button>
      </div>
      <div className="px-6 py-4">
        {view === "sunburst" && job.topic_graph && (
          <TopicSunburstChart data={job.topic_graph} width={1200} height={1200} />
        )}
        {view === "tree" && job.topic_graph && (
          <TopicNode node={job.topic_graph} />
        )}
      </div>
    </div>
  );
}

export default function TopicsPage() {
  const [keyword, setKeyword] = useState("");
  const [countryCode, setCountryCode] = useState("ch");
  const [languageCode, setLanguageCode] = useState("de");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(true);
  const [jobs, setJobs] = useState<TopicGraphJob[]>([]);
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const pollIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const toggleJob = useCallback((id: string) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const deleteJob = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/topicloops/topic-graphs?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== id));
        setExpandedJobs((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    } catch {
      // Fehler ignorieren
    }
  }, []);

  useEffect(() => {
    async function loadSaved() {
      try {
        const res = await fetch("/api/topicloops/topic-graphs?all=true");
        if (!res.ok) return;
        const data: TopicGraphJob[] = await res.json();
        setJobs(data);
      } catch {
        // Fehler beim Laden ignorieren
      } finally {
        setIsLoadingSaved(false);
      }
    }
    loadSaved();
  }, []);

  const pollJob = useCallback((dbId: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/topicloops/topic-graphs?id=${dbId}`);
        if (!res.ok) return;

        const data: TopicGraphJob = await res.json();

        setJobs((prev) =>
          prev.map((j) => (j.id === dbId ? { ...data, id: dbId } : j))
        );

        if (data.status === "succeeded" || data.status === "failed") {
          clearInterval(interval);
          pollIntervals.current.delete(dbId);
        }
      } catch {
        // Polling-Fehler ignorieren, naechster Versuch kommt automatisch
      }
    }, 2000);

    pollIntervals.current.set(dbId, interval);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = keyword.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/topicloops/topic-graphs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: trimmed,
          country_code: countryCode,
          language_code: languageCode,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Fehler: ${res.status}`);
      }

      const result = await res.json();

      if (result.cached) {
        setJobs((prev) => {
          const exists = prev.some((j) => j.id === result.id);
          if (exists) return prev;
          return [result, ...prev];
        });
        setExpandedJobs((prev) => new Set(prev).add(result.id));
        setKeyword("");
      } else {
        const dbId = result.id;
        const newJob: TopicGraphJob = {
          id: dbId,
          created_at: new Date().toISOString(),
          parameters: {
            country_code: countryCode,
            language_code: languageCode,
            keyword: trimmed,
          },
          status: "processing",
          topic_graph: null,
        };

        setJobs((prev) => [newJob, ...prev]);
        setExpandedJobs((prev) => new Set(prev).add(dbId));
        setKeyword("");

        pollJob(dbId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setIsLoading(false);
    }
  }, [keyword, countryCode, languageCode, isLoading, pollJob]);

  const totalTopics = (job: TopicGraphJob) => {
    if (!job.topic_graph) return 0;
    return flattenTopics(job.topic_graph).length;
  };

  const exportAllToXlsx = useCallback(() => {
    const succeededJobs = jobs.filter((j) => j.status === "succeeded" && j.topic_graph);
    if (succeededJobs.length === 0) return;

    const wb = XLSX.utils.book_new();

    succeededJobs.forEach((job) => {
      if (!job.topic_graph) return;
      const rows = flattenForExport(job.topic_graph);
      const ws = XLSX.utils.json_to_sheet(rows, {
        header: ["topic", "ebene", "pfad"],
      });
      ws["!cols"] = [{ wch: 40 }, { wch: 8 }, { wch: 80 }];
      XLSX.utils.sheet_add_aoa(ws, [["Topic", "Ebene", "Pfad"]], { origin: "A1" });

      const sheetName = job.parameters.keyword.slice(0, 31).replace(/[\\/*?[\]:]/g, "");
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    const date = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `alle-topics-${date}.xlsx`);
  }, [jobs]);

  const succeededCount = jobs.filter((j) => j.status === "succeeded").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Topic Research</h1>
          <p className="text-sm text-slate-400 mt-1">
            Finde alle relevanten Unterthemen fuer deine Inhalte via TopicLoops
          </p>
        </div>
        {succeededCount > 0 && (
          <button
            onClick={exportAllToXlsx}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Alle exportieren ({succeededCount})
          </button>
        )}
      </div>

      {/* Eingabe */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Keyword / Thema
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="z.B. hypothek, vorsorge 3a, ..."
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Land</label>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ch">Schweiz</option>
              <option value="de">Deutschland</option>
              <option value="at">Oesterreich</option>
              <option value="us">USA</option>
              <option value="gb">UK</option>
              <option value="fr">Frankreich</option>
              <option value="it">Italien</option>
            </select>
          </div>
          <div className="w-32">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Sprache</label>
            <select
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="de">Deutsch</option>
              <option value="en">Englisch</option>
              <option value="fr">Franzoesisch</option>
              <option value="it">Italienisch</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSubmit}
              disabled={isLoading || !keyword.trim()}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Wird erstellt...
                </span>
              ) : (
                "Topic-Graph erstellen"
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Ergebnisse */}
      {jobs.map((job) => {
        const isExpanded = expandedJobs.has(job.id);
        return (
          <div key={job.id} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <div
              onClick={() => toggleJob(job.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <svg
                  className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-90" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <h2 className="text-lg font-semibold text-white">
                  &ldquo;{job.parameters.keyword}&rdquo;
                </h2>
                <span className="text-xs text-slate-500 uppercase">
                  {job.parameters.country_code} / {job.parameters.language_code}
                </span>
                {job.status === "processing" && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-400">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Wird verarbeitet...
                  </span>
                )}
                {job.status === "succeeded" && (
                  <span className="text-xs text-emerald-400">
                    {totalTopics(job)} Topics gefunden
                  </span>
                )}
                {job.status === "failed" && (
                  <span className="text-xs text-red-400">Fehlgeschlagen</span>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Topic-Graph "${job.parameters.keyword}" wirklich loeschen?`)) {
                    deleteJob(job.id);
                  }
                }}
                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Loeschen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            {isExpanded && job.status === "succeeded" && job.topic_graph && (
              <TopicContent job={job} />
            )}

            {isExpanded && job.status === "processing" && (
              <div className="px-6 py-12 border-t border-slate-700 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <svg className="animate-spin h-8 w-8" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-sm">Topic-Graph wird erstellt, das dauert ca. 10 Sekunden...</p>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Leerzustand */}
      {isLoadingSaved && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
          <svg className="animate-spin h-8 w-8 mx-auto text-slate-400 mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-sm text-slate-400">Gespeicherte Topic-Graphs werden geladen...</p>
        </div>
      )}
      {!isLoadingSaved && jobs.length === 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          <h3 className="text-lg font-medium text-slate-300 mb-2">Noch keine Topic-Graphs</h3>
          <p className="text-sm text-slate-500">
            Gib oben ein Keyword oder Thema ein, um einen Topic-Graph zu erstellen.
          </p>
        </div>
      )}
    </div>
  );
}
