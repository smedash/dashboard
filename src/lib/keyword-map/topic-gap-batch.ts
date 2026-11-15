import { prisma } from "@/lib/prisma";
import { advanceTopicGap, ensureTopicGraph, refreshTopicGraph, STALE_ANALYSIS_MS } from "@/lib/keyword-map/topic-gap";
import { TopicLoopsError } from "@/lib/topicloops";

const REFRESH_PER_STEP = 5;
const RATE_LIMIT_BACKOFF_MS = 30_000;

export type TopicGapWorkBucket = "needsStart" | "ready" | "waiting" | "locked" | "graphFailed";

export interface TopicGapWorkItem {
  urlId: string;
  url: string;
  projectName: string;
  countryCode: string;
  languageCode: string;
  category: string | null;
  userId: string;
  keyword: string;
  /** Vorhandene Analyse, die fortgesetzt wird. Leer, wenn eine neue Analyse angelegt werden soll. */
  resumeGapId: string | null;
  resumeGraphId: string | null;
  /** Bestehende Analyse, z. B. wenn der Topic-Graph fehlgeschlagen ist. */
  gapId: string | null;
  topicloopsId: string | null;
  bucket: TopicGapWorkBucket;
}

export interface TopicGapBatchSnapshot {
  totalUrls: number;
  skippedNoKeyword: number;
  skippedDone: number;
  succeeded: number;
  failed: number;
  items: TopicGapWorkItem[];
}

export interface TopicGapBatchStep {
  done: boolean;
  phase: "analyzed" | "started" | "waiting" | "rateLimited" | "done";
  /** Bei `rateLimited`: so lange soll der Client vor dem nächsten Schritt warten. */
  retryAfterMs?: number;
  total: number;
  succeeded: number;
  failed: number;
  waiting: number;
  remaining: number;
  current: {
    projectName: string;
    url: string;
    keyword: string;
    outcome: "succeeded" | "failed" | "waiting" | "started";
    coverageScore: number | null;
    error: string | null;
  } | null;
}

function graphKey(keyword: string, countryCode: string, languageCode: string) {
  return `${keyword}\0${countryCode}\0${languageCode}`;
}

export function topicGraphNeedsNewJob(existing: { status: string; topicGraph: string | null } | undefined, refreshTopics: boolean): boolean {
  if (refreshTopics) return true;
  if (!existing) return true;
  if (existing.status === "processing") return false;
  if (existing.status === "succeeded" && existing.topicGraph) return false;
  return true;
}

export async function loadTopicGapBatch(options: {
  projectId?: string | null;
  projectQuery?: string | null;
  urlContains?: string | null;
  force?: boolean;
  refreshTopics?: boolean;
  /** Laufzeitpunkt des Button-Laufs. Terminalzustände ab diesem Zeitpunkt bleiben abgeschlossen. */
  startedAt?: Date | null;
}): Promise<TopicGapBatchSnapshot> {
  const force = options.force === true;
  const refreshTopics = options.refreshTopics === true;
  const startedAt = options.startedAt ?? null;
  const projectQuery = options.projectQuery?.trim() || null;

  const rows = await prisma.keywordMapUrl.findMany({
    where: {
      ...(options.projectId ? { projectId: options.projectId } : {}),
      ...(projectQuery
        ? {
            OR: [
              { projectId: projectQuery },
              { project: { name: { contains: projectQuery, mode: "insensitive" } } },
            ],
          }
        : {}),
      ...(options.urlContains ? { url: { contains: options.urlContains, mode: "insensitive" } } : {}),
    },
    include: {
      project: true,
      keywords: { where: { type: "focus" }, orderBy: { position: "asc" }, take: 1 },
      topicGaps: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: [{ project: { name: "asc" } }, { url: "asc" }],
  });

  const graphIds = rows.map((row) => row.topicGaps[0]?.topicGraphId).filter((id): id is string => Boolean(id));
  const graphs = graphIds.length
    ? await prisma.topicGraph.findMany({
        where: { id: { in: graphIds } },
        select: { id: true, status: true, topicGraph: true, topicloopsId: true },
      })
    : [];
  const graphById = new Map(graphs.map((graph) => [graph.id, graph]));

  let skippedNoKeyword = 0;
  let skippedDone = 0;
  let succeeded = 0;
  let failed = 0;
  const items: TopicGapWorkItem[] = [];

  for (const row of rows) {
    const keyword = row.keywords[0]?.keyword.trim().toLowerCase();
    if (!keyword) {
      skippedNoKeyword++;
      continue;
    }
    const latest = row.topicGaps[0] ?? null;
    const sameKeyword = latest?.focusKeyword.trim().toLowerCase() === keyword;
    const graph = latest?.topicGraphId ? graphById.get(latest.topicGraphId) : undefined;
    const graphReady = graph?.status === "succeeded" && Boolean(graph.topicGraph);
    const graphFailed = graph?.status === "failed";
    const open = sameKeyword && (latest?.status === "processing" || latest?.status === "analyzing");
    const fromRun = Boolean(startedAt && latest && latest.createdAt >= startedAt);
    const touchedThisRun = Boolean(startedAt && latest && latest.updatedAt >= startedAt);

    const base = {
      urlId: row.id,
      url: row.url,
      projectName: row.project.name,
      countryCode: row.project.countryCode,
      languageCode: row.project.languageCode,
      category: row.project.category,
      userId: row.project.createdById,
      keyword,
      gapId: latest?.id ?? null,
      topicloopsId: graph?.topicloopsId ?? null,
    };

    if (startedAt) {
      if (sameKeyword && latest?.status === "succeeded" && (!force || fromRun)) {
        if (fromRun) succeeded++;
        else skippedDone++;
        continue;
      }
      if (sameKeyword && latest?.status === "failed" && touchedThisRun) {
        failed++;
        continue;
      }
      if (open && latest) {
        if (refreshTopics && !fromRun) {
          items.push({ ...base, resumeGapId: null, resumeGraphId: null, bucket: "needsStart" });
          continue;
        }
        if (graphFailed || !graph) {
          items.push({ ...base, resumeGapId: null, resumeGraphId: null, bucket: "graphFailed" });
          continue;
        }
        const locked = latest.status === "analyzing" && Date.now() - latest.updatedAt.getTime() < STALE_ANALYSIS_MS && graphReady;
        items.push({
          ...base,
          resumeGapId: latest.id,
          resumeGraphId: graph.id,
          bucket: locked ? "locked" : graphReady ? "ready" : "waiting",
        });
        continue;
      }
      items.push({ ...base, resumeGapId: null, resumeGraphId: null, bucket: "needsStart" });
      continue;
    }

    if (sameKeyword && latest?.status === "succeeded" && !force) {
      skippedDone++;
      continue;
    }
    if (!force && !refreshTopics && open && latest && graph && !graphFailed) {
      items.push({
        ...base,
        resumeGapId: latest.id,
        resumeGraphId: graph.id,
        bucket: graphReady ? "ready" : "waiting",
      });
      continue;
    }
    items.push({ ...base, resumeGapId: null, resumeGraphId: null, bucket: "needsStart" });
  }

  return { totalUrls: rows.length, skippedNoKeyword, skippedDone, succeeded, failed, items };
}

export async function countNewTopicJobs(items: TopicGapWorkItem[], refreshTopics: boolean): Promise<number> {
  const keys = new Map<string, TopicGapWorkItem>();
  for (const item of items) {
    if (!refreshTopics && item.resumeGapId) continue;
    keys.set(graphKey(item.keyword, item.countryCode, item.languageCode), item);
  }
  if (keys.size === 0) return 0;

  const existing = await prisma.topicGraph.findMany({
    where: {
      OR: [...keys.values()].map((item) => ({
        keyword: item.keyword,
        countryCode: item.countryCode,
        languageCode: item.languageCode,
      })),
    },
    select: { keyword: true, countryCode: true, languageCode: true, status: true, topicGraph: true },
  });
  const byKey = new Map(existing.map((graph) => [graphKey(graph.keyword, graph.countryCode, graph.languageCode), graph]));
  let created = 0;
  for (const [key] of keys) {
    if (topicGraphNeedsNewJob(byKey.get(key), refreshTopics)) created++;
  }
  return created;
}

export function topicGapBatchProgress(snapshot: TopicGapBatchSnapshot) {
  const waiting = snapshot.items.filter((item) => item.bucket === "waiting" || item.bucket === "locked").length;
  const remaining = snapshot.items.length;
  return {
    total: snapshot.succeeded + snapshot.failed + remaining,
    succeeded: snapshot.succeeded,
    failed: snapshot.failed,
    waiting,
    remaining,
    done: remaining === 0,
  };
}

function stepFrom(snapshot: TopicGapBatchSnapshot, current: TopicGapBatchStep["current"], phase: TopicGapBatchStep["phase"]): TopicGapBatchStep {
  const progress = topicGapBatchProgress(snapshot);
  return { ...progress, phase: progress.done ? "done" : phase, current };
}

async function failGap(item: TopicGapWorkItem, error: string) {
  if (item.gapId && item.bucket === "graphFailed") {
    await prisma.keywordMapTopicGap.update({ where: { id: item.gapId }, data: { status: "failed", error } });
    return;
  }
  if (item.resumeGapId) {
    await prisma.keywordMapTopicGap.update({ where: { id: item.resumeGapId }, data: { status: "failed", error } });
    return;
  }
  const gap = await prisma.keywordMapTopicGap.create({
    data: { urlId: item.urlId, focusKeyword: item.keyword, status: "failed", error },
  });
  item.gapId = gap.id;
  item.resumeGapId = gap.id;
}

async function analyzeGap(item: TopicGapWorkItem, gapId: string): Promise<NonNullable<TopicGapBatchStep["current"]>> {
  const gap = await advanceTopicGap(gapId);
  if (!gap) {
    return { projectName: item.projectName, url: item.url, keyword: item.keyword, outcome: "failed", coverageScore: null, error: "Analyse nicht gefunden" };
  }
  if (gap.status === "succeeded") {
    return {
      projectName: item.projectName,
      url: item.url,
      keyword: item.keyword,
      outcome: "succeeded",
      coverageScore: gap.coverageScore,
      error: null,
    };
  }
  if (gap.status === "failed") {
    return {
      projectName: item.projectName,
      url: item.url,
      keyword: item.keyword,
      outcome: "failed",
      coverageScore: null,
      error: gap.error,
    };
  }
  return { projectName: item.projectName, url: item.url, keyword: item.keyword, outcome: "waiting", coverageScore: null, error: null };
}

/**
 * Ein Request-Schritt: entweder eine Seite abgleichen, ein paar Topic-Graphen starten
 * oder laufende TopicLoops-Jobs abfragen. Der Browser ruft das auf, bis `done` ist.
 */
export async function advanceTopicGapBatch(options: {
  projectId?: string | null;
  userId: string;
  force?: boolean;
  refreshTopics?: boolean;
  startedAt: Date;
}): Promise<TopicGapBatchStep> {
  const load = () =>
    loadTopicGapBatch({
      projectId: options.projectId,
      force: options.force,
      refreshTopics: options.refreshTopics,
      startedAt: options.startedAt,
    });

  const snapshot = await load();
  const progress = topicGapBatchProgress(snapshot);
  if (progress.done) return stepFrom(snapshot, null, "done");

  const blocked = snapshot.items.find((item) => item.bucket === "graphFailed");
  if (blocked) {
    const error = blocked.topicloopsId
      ? `TopicLoops hat den Job abgebrochen (Job-ID ${blocked.topicloopsId}).`
      : "Topic-Graph nicht gefunden";
    await failGap(blocked, error);
    const next = await load();
    return stepFrom(next, {
      projectName: blocked.projectName,
      url: blocked.url,
      keyword: blocked.keyword,
      outcome: "failed",
      coverageScore: null,
      error,
    }, "analyzed");
  }

  const ready = snapshot.items.find((item) => item.bucket === "ready" && item.resumeGapId);
  if (ready?.resumeGapId) {
    try {
      const current = await analyzeGap(ready, ready.resumeGapId);
      return stepFrom(await load(), current, current.outcome === "waiting" ? "waiting" : "analyzed");
    } catch (e) {
      if (e instanceof TopicLoopsError && e.rateLimited) {
        const step = stepFrom(snapshot, {
          projectName: ready.projectName,
          url: ready.url,
          keyword: ready.keyword,
          outcome: "waiting",
          coverageScore: null,
          error: null,
        }, "rateLimited");
        return { ...step, retryAfterMs: e.retryAfterMs ?? RATE_LIMIT_BACKOFF_MS };
      }
      const error = e instanceof Error ? e.message : "Analyse fehlgeschlagen";
      await failGap(ready, error);
      return stepFrom(await load(), {
        projectName: ready.projectName,
        url: ready.url,
        keyword: ready.keyword,
        outcome: "failed",
        coverageScore: null,
        error,
      }, "analyzed");
    }
  }

  const item = snapshot.items.find((entry) => entry.bucket === "needsStart");
  if (item) {
    try {
      const existing = await prisma.topicGraph.findUnique({
        where: {
          keyword_countryCode_languageCode: {
            keyword: item.keyword,
            countryCode: item.countryCode,
            languageCode: item.languageCode,
          },
        },
        select: { updatedAt: true },
      });
      const refreshThis = options.refreshTopics === true && (!existing || existing.updatedAt < options.startedAt);
      const graph = await ensureTopicGraph({
        keyword: item.keyword,
        countryCode: item.countryCode,
        languageCode: item.languageCode,
        userId: options.userId,
        category: item.category,
        force: refreshThis,
      });
      const gap = await prisma.keywordMapTopicGap.create({
        data: { urlId: item.urlId, focusKeyword: item.keyword, topicGraphId: graph.id, status: "processing" },
      });
      item.resumeGapId = gap.id;
      item.gapId = gap.id;
      if (graph.status === "succeeded" && graph.topicGraph) {
        const analyzed = await analyzeGap(item, gap.id);
        return stepFrom(await load(), analyzed, analyzed.outcome === "waiting" ? "waiting" : "analyzed");
      }
      return stepFrom(await load(), {
        projectName: item.projectName,
        url: item.url,
        keyword: item.keyword,
        outcome: "started",
        coverageScore: null,
        error: null,
      }, "started");
    } catch (e) {
      if (e instanceof TopicLoopsError && e.rateLimited) {
        const step = stepFrom(snapshot, {
          projectName: item.projectName,
          url: item.url,
          keyword: item.keyword,
          outcome: "waiting",
          coverageScore: null,
          error: null,
        }, "rateLimited");
        return { ...step, retryAfterMs: e.retryAfterMs ?? RATE_LIMIT_BACKOFF_MS };
      }
      const error = e instanceof Error ? e.message : "TopicLoops-Aufruf fehlgeschlagen";
      await failGap(item, error);
      return stepFrom(await load(), {
        projectName: item.projectName,
        url: item.url,
        keyword: item.keyword,
        outcome: "failed",
        coverageScore: null,
        error,
      }, "analyzed");
    }
  }

  const waiting = snapshot.items.filter((item) => item.bucket === "waiting" && item.resumeGraphId);
  if (waiting.length > 0) {
    const graphIds = [...new Set(waiting.map((item) => item.resumeGraphId as string))].slice(0, REFRESH_PER_STEP);
    let rateLimited: TopicLoopsError | null = null;
    for (const graphId of graphIds) {
      try {
        const graph = await prisma.topicGraph.findUnique({ where: { id: graphId } });
        if (graph) await refreshTopicGraph(graph);
      } catch (e) {
        if (e instanceof TopicLoopsError && e.rateLimited) {
          rateLimited = e;
          break;
        }
        console.error("[keyword-map/topic-gap-batch] TopicLoops-Abfrage fehlgeschlagen", e);
      }
    }
    if (rateLimited) {
      const sample = waiting[0];
      const step = stepFrom(snapshot, {
        projectName: sample.projectName,
        url: sample.url,
        keyword: sample.keyword,
        outcome: "waiting",
        coverageScore: null,
        error: null,
      }, "rateLimited");
      return { ...step, retryAfterMs: rateLimited.retryAfterMs ?? RATE_LIMIT_BACKOFF_MS };
    }
    const afterRefresh = await load();
    const sample = waiting[0];
    const canContinue = afterRefresh.items.some((item) => item.bucket === "ready" || item.bucket === "needsStart" || item.bucket === "graphFailed");
    return stepFrom(afterRefresh, {
      projectName: sample.projectName,
      url: sample.url,
      keyword: sample.keyword,
      outcome: "waiting",
      coverageScore: null,
      error: null,
    }, canContinue ? "started" : "waiting");
  }

  const locked = snapshot.items.find((item) => item.bucket === "locked");
  if (locked) {
    return stepFrom(snapshot, {
      projectName: locked.projectName,
      url: locked.url,
      keyword: locked.keyword,
      outcome: "waiting",
      coverageScore: null,
      error: null,
    }, "waiting");
  }

  return stepFrom(snapshot, null, "done");
}

export function projectsInBatch(items: TopicGapWorkItem[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.projectName, (counts.get(item.projectName) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}
