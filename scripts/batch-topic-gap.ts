/**
 * Topic-Gap für alle URLs im Keyword-Mapper anstoßen.
 *
 * Nutzt denselben Ablauf wie der Button im URL-Drawer: TopicLoops-Graph zum
 * Fokus-Keyword (gecacht, ausser mit --refresh-topics) und anschliessend
 * Abgleich des Seiteninhalts per Claude.
 *
 * Bereits erfolgreiche Analysen zum aktuellen Fokus-Keyword werden übersprungen.
 * Laufende Analysen werden fortgesetzt. URLs ohne Fokus-Keyword werden ausgelassen.
 * Denselben Lauf gibt es in der Oberfläche über „Topic-Gaps analysieren“.
 *
 * Nutzung:
 *   npx tsx scripts/batch-topic-gap.ts --dry-run
 *   npx tsx scripts/batch-topic-gap.ts --yes
 *   npm run batch-topic-gap -- --yes
 *   npx tsx scripts/batch-topic-gap.ts --yes --project "Hypotheken"
 *   npx tsx scripts/batch-topic-gap.ts --yes --url "beispiel.ch/ratgeber"
 *   npx tsx scripts/batch-topic-gap.ts --yes --force
 *   npx tsx scripts/batch-topic-gap.ts --yes --refresh-topics
 *   npx tsx scripts/batch-topic-gap.ts --yes --limit 10 --concurrency 2
 */

import "dotenv/config";

import type { TopicGraph } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { advanceTopicGap, ensureTopicGraph, refreshTopicGraph } from "../src/lib/keyword-map/topic-gap";
import { countNewTopicJobs, loadTopicGapBatch, topicGraphNeedsNewJob, type TopicGapWorkItem } from "../src/lib/keyword-map/topic-gap-batch";
import { getAccount, TopicLoopsError } from "../src/lib/topicloops";

const GRAPH_POLL_MS = 8_000;
const ANALYSIS_POLL_MS = 5_000;
const NEW_JOB_DELAY_MS = 3_000;
const RATE_LIMIT_BACKOFF_MS = 30_000;
const MAX_RATE_LIMIT_RETRIES = 10;
const DEFAULT_GRAPH_TIMEOUT_MIN = 15;
const DEFAULT_CONCURRENCY = 2;
const MAX_CONCURRENCY = 8;

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

function intArg(name: string, fallback: number): number {
  const raw = getArg(name);
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`--${name} erwartet eine positive Zahl, erhalten: ${raw}`);
  }
  return Math.floor(n);
}

const dryRun = args.includes("--dry-run");
const confirmed = args.includes("--yes");
const force = args.includes("--force");
const refreshTopics = args.includes("--refresh-topics");
const ignoreCredits = args.includes("--ignore-credits");
const projectFilter = getArg("project");
const urlFilter = getArg("url");
const limit = getArg("limit") ? intArg("limit", 0) : undefined;
const concurrency = Math.min(intArg("concurrency", DEFAULT_CONCURRENCY), MAX_CONCURRENCY);
const graphTimeoutMs = intArg("graph-timeout-min", DEFAULT_GRAPH_TIMEOUT_MIN) * 60_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof TopicLoopsError && e.rateLimited) || attempt >= MAX_RATE_LIMIT_RETRIES) throw e;
      const wait = e.retryAfterMs ?? RATE_LIMIT_BACKOFF_MS;
      process.stdout.write(`TopicLoops-Limit, warte ${Math.round(wait / 1000)} s … `);
      await sleep(wait);
    }
  }
}

function graphKey(keyword: string, countryCode: string, languageCode: string) {
  return `${keyword}\0${countryCode}\0${languageCode}`;
}

type WorkItem = TopicGapWorkItem;

type GraphState = TopicGraph | { error: string };

async function loadWork(): Promise<{
  items: WorkItem[];
  skippedNoKeyword: number;
  skippedDone: number;
  truncated: number;
  totalUrls: number;
}> {
  const snapshot = await loadTopicGapBatch({
    projectQuery: projectFilter,
    urlContains: urlFilter,
    force,
    refreshTopics,
    startedAt: null,
  });
  const items = limit ? snapshot.items.slice(0, limit) : snapshot.items;
  return {
    items,
    skippedNoKeyword: snapshot.skippedNoKeyword,
    skippedDone: snapshot.skippedDone,
    truncated: snapshot.items.length - items.length,
    totalUrls: snapshot.totalUrls,
  };
}

async function ensureGraphs(items: WorkItem[]): Promise<Map<string, GraphState>> {
  const groups = new Map<string, WorkItem[]>();
  for (const item of items) {
    const key = graphKey(item.keyword, item.countryCode, item.languageCode);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  const graphs = new Map<string, GraphState>();
  let index = 0;
  for (const [key, group] of groups) {
    index++;
    const item = group[0];
    const label = `${item.keyword} (${item.countryCode}/${item.languageCode})`;
    const onlyResume = group.every((entry) => entry.resumeGapId);
    try {
      if (onlyResume) {
        const graphId = group.find((entry) => entry.resumeGraphId)?.resumeGraphId;
        process.stdout.write(`[Graph ${index}/${groups.size}] ${label} … `);
        if (!graphId) {
          graphs.set(key, { error: "Laufende Analyse ohne Topic-Graph" });
          console.log("FEHLER: kein Topic-Graph verknüpft");
          continue;
        }
        const graph = await prisma.topicGraph.findUnique({ where: { id: graphId } });
        if (!graph) {
          graphs.set(key, { error: "Topic-Graph nicht gefunden" });
          console.log("FEHLER: Topic-Graph nicht gefunden");
          continue;
        }
        graphs.set(key, graph);
        console.log(`Fortsetzung (${graph.status})`);
        continue;
      }

      const existing = await prisma.topicGraph.findUnique({
        where: {
          keyword_countryCode_languageCode: {
            keyword: item.keyword,
            countryCode: item.countryCode,
            languageCode: item.languageCode,
          },
        },
        select: { status: true, topicGraph: true },
      });
      const willCreate = topicGraphNeedsNewJob(existing ?? undefined, refreshTopics);
      process.stdout.write(`[Graph ${index}/${groups.size}] ${label} … `);
      const graph = await withRateLimitRetry(() =>
        ensureTopicGraph({
          keyword: item.keyword,
          countryCode: item.countryCode,
          languageCode: item.languageCode,
          userId: item.userId,
          category: item.category,
          force: refreshTopics,
        }),
      );
      graphs.set(key, graph);
      console.log(willCreate ? `Job gestartet (${graph.topicloopsId})` : `Cache (${graph.status})`);
      if (willCreate) await sleep(NEW_JOB_DELAY_MS);
    } catch (e) {
      const message = e instanceof Error ? e.message : "TopicLoops-Aufruf fehlgeschlagen";
      graphs.set(key, { error: message });
      console.log(`FEHLER: ${message}`);
    }
  }

  const deadline = Date.now() + graphTimeoutMs;
  while (true) {
    const pending: string[] = [];
    for (const [key, graph] of graphs) {
      if ("error" in graph || graph.status !== "processing") continue;
      try {
        const fresh = await refreshTopicGraph(graph);
        graphs.set(key, fresh);
        if (fresh.status === "processing") pending.push(fresh.keyword);
      } catch (e) {
        const message = e instanceof Error ? e.message : "TopicLoops-Abfrage fehlgeschlagen";
        console.error(`  Abfrage für „${graph.keyword}“ fehlgeschlagen: ${message}`);
        pending.push(graph.keyword);
      }
    }
    if (pending.length === 0) break;
    if (Date.now() >= deadline) {
      console.log(`TopicLoops-Timeout. Noch offen: ${pending.join(", ")}`);
      break;
    }
    console.log(`  ${pending.length} Topic-Graphen noch in Arbeit: ${pending.slice(0, 8).join(", ")}${pending.length > 8 ? " …" : ""}`);
    await sleep(GRAPH_POLL_MS);
  }

  return graphs;
}

async function failGap(item: WorkItem, error: string) {
  if (item.resumeGapId) {
    await prisma.keywordMapTopicGap.update({
      where: { id: item.resumeGapId },
      data: { status: "failed", error },
    });
    return;
  }
  const gap = await prisma.keywordMapTopicGap.create({
    data: { urlId: item.urlId, focusKeyword: item.keyword, status: "failed", error },
  });
  item.resumeGapId = gap.id;
}

async function analyzeOne(item: WorkItem, graphs: Map<string, GraphState>, position: number, total: number): Promise<"succeeded" | "failed" | "waiting"> {
  const prefix = `[${position}/${total}] ${item.projectName}`;
  console.log(`${prefix}  ${item.url}  „${item.keyword}“${item.resumeGapId ? " (Fortsetzung)" : ""}`);

  const state = graphs.get(graphKey(item.keyword, item.countryCode, item.languageCode));
  if (!state) {
    await failGap(item, "Topic-Graph wurde nicht angelegt");
    console.log("  fehlgeschlagen: Topic-Graph wurde nicht angelegt");
    return "failed";
  }
  if ("error" in state) {
    await failGap(item, state.error);
    console.log(`  fehlgeschlagen: ${state.error}`);
    return "failed";
  }
  if (state.status === "failed") {
    await failGap(item, `TopicLoops hat den Job abgebrochen (Job-ID ${state.topicloopsId})`);
    console.log("  fehlgeschlagen: TopicLoops-Job abgebrochen");
    return "failed";
  }
  if (state.status !== "succeeded" || !state.topicGraph) {
    if (!item.resumeGapId) {
      const gap = await prisma.keywordMapTopicGap.create({
        data: { urlId: item.urlId, focusKeyword: item.keyword, topicGraphId: state.id, status: "processing" },
      });
      item.resumeGapId = gap.id;
    }
    console.log("  wartet auf TopicLoops. Ein erneuter Lauf setzt die Analyse fort.");
    return "waiting";
  }

  if (!item.resumeGapId) {
    const gap = await prisma.keywordMapTopicGap.create({
      data: { urlId: item.urlId, focusKeyword: item.keyword, topicGraphId: state.id, status: "processing" },
    });
    item.resumeGapId = gap.id;
  }

  const deadline = Date.now() + graphTimeoutMs;
  while (Date.now() < deadline) {
    const gap = await advanceTopicGap(item.resumeGapId);
    if (!gap) {
      console.log("  fehlgeschlagen: Analyse nicht gefunden");
      return "failed";
    }
    if (gap.status === "succeeded") {
      console.log(`  Coverage ${gap.coverageScore ?? "–"} %`);
      return "succeeded";
    }
    if (gap.status === "failed") {
      console.log(`  fehlgeschlagen: ${gap.error ?? "unbekannter Fehler"}`);
      return "failed";
    }
    await sleep(ANALYSIS_POLL_MS);
  }
  console.log("  wartet noch (Timeout). Ein erneuter Lauf setzt die Analyse fort.");
  return "waiting";
}

async function mapPool<T>(items: T[], limit: number, fn: (item: T, index: number) => Promise<void>) {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL fehlt");

  console.log("Keyword-Mapping: Topic-Gap für alle URLs\n");
  const { items, skippedNoKeyword, skippedDone, truncated, totalUrls } = await loadWork();
  const uniqueKeywords = new Set(items.map((item) => graphKey(item.keyword, item.countryCode, item.languageCode))).size;
  const newJobs = await countNewTopicJobs(items, refreshTopics);

  console.log(`URLs in der Auswahl: ${totalUrls}`);
  console.log(`Ohne Fokus-Keyword übersprungen: ${skippedNoKeyword}`);
  console.log(`Bereits analysiert übersprungen: ${skippedDone}${skippedDone ? "  (--force wiederholt sie)" : ""}`);
  console.log(`Zu analysieren: ${items.length}${limit ? ` (Limit ${limit}, weitere ${truncated} nicht enthalten)` : ""}`);
  console.log(`  davon laufende Analysen fortsetzen: ${items.filter((item) => item.resumeGapId).length}`);
  console.log(`Eindeutige Fokus-Keywords: ${uniqueKeywords}`);
  console.log(`Neue TopicLoops-Jobs: ${newJobs}${refreshTopics ? "  (--refresh-topics ignoriert den Cache)" : ""}`);

  let credits: number | null = null;
  if (process.env.TOPICLOOPS_API_KEY) {
    try {
      credits = (await getAccount()).credits;
      console.log(`TopicLoops-Credits: ${credits}`);
    } catch (e) {
      console.log(`TopicLoops-Credits: nicht abrufbar (${e instanceof Error ? e.message : "Fehler"})`);
    }
  } else {
    console.log("TopicLoops-Credits: TOPICLOOPS_API_KEY fehlt");
  }

  if (items.length === 0) {
    console.log("\nNichts zu tun.");
    return;
  }

  console.log("");
  const byProject = new Map<string, number>();
  for (const item of items) byProject.set(item.projectName, (byProject.get(item.projectName) ?? 0) + 1);
  for (const [name, count] of byProject) console.log(`  ${name}: ${count}`);

  if (dryRun || !confirmed) {
    console.log(dryRun ? "\nDry-Run. Es wurde keine Analyse gestartet." : "\nKeine Analyse gestartet. Zum Ausführen --yes anhängen.");
    return;
  }
  if (!process.env.TOPICLOOPS_API_KEY) throw new Error("TOPICLOOPS_API_KEY fehlt");
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY fehlt");
  if (credits !== null && newJobs > credits && !ignoreCredits) {
    throw new Error(
      `${newJobs} neue TopicLoops-Jobs, aber nur ${credits} Credits. Abbruch. Mit --ignore-credits trotzdem starten.`,
    );
  }

  const started = Date.now();
  console.log("\nTopic-Graphen …");
  const graphs = await ensureGraphs(items);

  console.log("\nAbgleich mit den Seiten …");
  const counts = { succeeded: 0, failed: 0, waiting: 0 };
  await mapPool(items, concurrency, async (item, index) => {
    try {
      const result = await analyzeOne(item, graphs, index + 1, items.length);
      counts[result]++;
    } catch (e) {
      counts.failed++;
      const message = e instanceof Error ? e.message : "Analyse fehlgeschlagen";
      console.error(`[${index + 1}/${items.length}] ${item.url}  FEHLER: ${message}`);
      try {
        await failGap(item, message);
      } catch (writeError) {
        console.error("  Status konnte nicht gespeichert werden", writeError);
      }
    }
  });

  const minutes = Math.max(1, Math.round((Date.now() - started) / 60_000));
  console.log(`\nFertig in ${minutes} Min.`);
  console.log(`  erfolgreich: ${counts.succeeded}`);
  console.log(`  fehlgeschlagen: ${counts.failed}`);
  console.log(`  wartet auf TopicLoops: ${counts.waiting}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
