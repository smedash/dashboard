/**
 * Shared sync logic for Conductor Monitoring data.
 * Used by both the manual sync API route and the cron job.
 *
 * A sync run is resumable: pages are upserted batch by batch and the API cursor is
 * stored on the sync log, so a run that hits its time budget pauses and the next
 * invocation continues where it stopped. Pages that disappeared from Conductor are
 * only removed once a run has completed, so readers always see a full data set.
 */

import { randomUUID } from "crypto";
import { prisma } from "./prisma";
import { Prisma, type ConductorSyncLog } from "@prisma/client";
import {
  getPages,
  getIssues,
  getWebsites,
  type ConductorPageData,
  type ConductorIssueData,
  type ConductorWebsiteData,
} from "./conductor-monitoring";

const PAGE_BATCH_SIZE = 1000;
/** 39 bind parameters per row; Prisma allows at most 32,767 per statement. */
const UPSERT_CHUNK_SIZE = 500;
const LOCK_TTL_MS = 5 * 60 * 1000;
/** Cursors of older runs are not trusted anymore; such runs are restarted. */
const MAX_RESUME_AGE_MS = 24 * 60 * 60 * 1000;
/** A website counts as due for the cron once its last completed sync is older than this. */
const SYNC_INTERVAL_MS = 20 * 60 * 60 * 1000;
/** Time reserved after the budget for the final cleanup + issue sync. */
const FINALIZE_RESERVE_MS = 60 * 1000;

export type SyncOutcome = "completed" | "paused" | "locked";

export interface SyncResult {
  status: SyncOutcome;
  websiteId: string;
  conductorId: string;
  domain: string;
  pagesProcessed: number;
  issuesProcessed: number;
  durationMs: number;
}

function toJson(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

function parseDateSafe(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function cleanText(value: unknown): string | null {
  return typeof value === "string" && value !== "null" ? value : null;
}

/**
 * Upserts one API batch. Duplicate URLs within a batch are collapsed because
 * ON CONFLICT cannot touch the same row twice in one statement.
 */
async function upsertPageBatch(
  websiteId: string,
  syncLogId: string,
  pages: ConductorPageData[],
  capturedAt: string
): Promise<void> {
  const unique = [...new Map(pages.map((p) => [p.url, p])).values()];
  const captured = parseDateSafe(capturedAt);
  const now = new Date();
  for (let i = 0; i < unique.length; i += UPSERT_CHUNK_SIZE) {
    await upsertPageChunk(websiteId, syncLogId, unique.slice(i, i + UPSERT_CHUNK_SIZE), captured, now);
  }
}

async function upsertPageChunk(
  websiteId: string,
  syncLogId: string,
  pages: ConductorPageData[],
  captured: Date | null,
  now: Date
): Promise<void> {
  const values = pages.map(
    (p) => Prisma.sql`(
      ${randomUUID()}::text, ${websiteId}::text, ${p.url}::text,
      ${p.health ?? null}::int, ${p.status_code ?? null}::int, ${p.type ?? null}::text,
      ${p.relevance ?? null}::float8,
      ${p.is_indexable ?? false}::boolean, ${p.is_in_sitemap ?? false}::boolean,
      ${p.is_disallowed_in_robots_txt ?? false}::boolean,
      ${p.is_linked ?? true}::boolean, ${p.is_https ?? true}::boolean,
      ${typeof p.url_depth === "number" ? p.url_depth : null}::int,
      ${cleanText(p.title)}::text, ${cleanText(p.h1)}::text, ${cleanText(p.meta_description)}::text,
      ${toJson(p.lighthouse_performance)}::jsonb, ${toJson(p.lighthouse_cls)}::jsonb,
      ${toJson(p.lighthouse_fcp)}::jsonb, ${toJson(p.lighthouse_lcp)}::jsonb,
      ${toJson(p.lighthouse_si)}::jsonb, ${toJson(p.lighthouse_tbt)}::jsonb, ${toJson(p.lighthouse_tti)}::jsonb,
      ${toJson(p.lfa_google_frequency)}::jsonb, ${parseDateSafe(p.lfa_google_last_visit)}::timestamp,
      ${toJson(p.lfa_bing_frequency)}::jsonb, ${parseDateSafe(p.lfa_bing_last_visit)}::timestamp,
      ${toJson(p.lfa_openai_frequency)}::jsonb, ${parseDateSafe(p.lfa_openai_last_visit)}::timestamp,
      ${toJson(p.lfa_perplexity_frequency)}::jsonb, ${parseDateSafe(p.lfa_perplexity_last_visit)}::timestamp,
      ${p.number_of_incoming_internal_links ?? 0}::int, ${p.number_of_outgoing_internal_links ?? 0}::int,
      ${p.number_of_outgoing_external_links ?? 0}::int,
      ${p.segments && p.segments.length > 0 ? toJson(p.segments) : null}::jsonb,
      ${typeof p.time_document_download === "number" ? Math.round(p.time_document_download) : null}::int,
      ${syncLogId}::text, ${captured}::timestamp, ${now}::timestamp
    )`
  );

  await prisma.$executeRaw`
    INSERT INTO "ConductorPage" (
      "id", "websiteId", "url",
      "health", "statusCode", "type", "relevance",
      "isIndexable", "isInSitemap", "isDisallowedInRobotsTxt", "isLinked", "isHttps", "urlDepth",
      "title", "h1", "metaDescription",
      "lighthousePerformance", "lighthouseCls", "lighthouseFcp", "lighthouseLcp",
      "lighthouseSi", "lighthouseTbt", "lighthouseTti",
      "lfaGoogleFrequency", "lfaGoogleLastVisit", "lfaBingFrequency", "lfaBingLastVisit",
      "lfaOpenaiFrequency", "lfaOpenaiLastVisit", "lfaPerplexityFrequency", "lfaPerplexityLastVisit",
      "incomingInternalLinks", "outgoingInternalLinks", "outgoingExternalLinks",
      "segments", "timeDocumentDownload", "syncLogId", "dataCapturedAt", "updatedAt"
    )
    VALUES ${Prisma.join(values)}
    ON CONFLICT ("websiteId", "url") DO UPDATE SET
      "health" = EXCLUDED."health",
      "statusCode" = EXCLUDED."statusCode",
      "type" = EXCLUDED."type",
      "relevance" = EXCLUDED."relevance",
      "isIndexable" = EXCLUDED."isIndexable",
      "isInSitemap" = EXCLUDED."isInSitemap",
      "isDisallowedInRobotsTxt" = EXCLUDED."isDisallowedInRobotsTxt",
      "isLinked" = EXCLUDED."isLinked",
      "isHttps" = EXCLUDED."isHttps",
      "urlDepth" = EXCLUDED."urlDepth",
      "title" = EXCLUDED."title",
      "h1" = EXCLUDED."h1",
      "metaDescription" = EXCLUDED."metaDescription",
      "lighthousePerformance" = EXCLUDED."lighthousePerformance",
      "lighthouseCls" = EXCLUDED."lighthouseCls",
      "lighthouseFcp" = EXCLUDED."lighthouseFcp",
      "lighthouseLcp" = EXCLUDED."lighthouseLcp",
      "lighthouseSi" = EXCLUDED."lighthouseSi",
      "lighthouseTbt" = EXCLUDED."lighthouseTbt",
      "lighthouseTti" = EXCLUDED."lighthouseTti",
      "lfaGoogleFrequency" = EXCLUDED."lfaGoogleFrequency",
      "lfaGoogleLastVisit" = EXCLUDED."lfaGoogleLastVisit",
      "lfaBingFrequency" = EXCLUDED."lfaBingFrequency",
      "lfaBingLastVisit" = EXCLUDED."lfaBingLastVisit",
      "lfaOpenaiFrequency" = EXCLUDED."lfaOpenaiFrequency",
      "lfaOpenaiLastVisit" = EXCLUDED."lfaOpenaiLastVisit",
      "lfaPerplexityFrequency" = EXCLUDED."lfaPerplexityFrequency",
      "lfaPerplexityLastVisit" = EXCLUDED."lfaPerplexityLastVisit",
      "incomingInternalLinks" = EXCLUDED."incomingInternalLinks",
      "outgoingInternalLinks" = EXCLUDED."outgoingInternalLinks",
      "outgoingExternalLinks" = EXCLUDED."outgoingExternalLinks",
      "segments" = EXCLUDED."segments",
      "timeDocumentDownload" = EXCLUDED."timeDocumentDownload",
      "syncLogId" = EXCLUDED."syncLogId",
      "dataCapturedAt" = EXCLUDED."dataCapturedAt",
      "updatedAt" = EXCLUDED."updatedAt"
  `;
}

function buildIssueRecord(websiteId: string, issue: ConductorIssueData, capturedAt: string) {
  const tags = Array.isArray(issue.tags) ? issue.tags.join(",") : issue.tags;
  const abs = issue.pages_per_issue_state?.absolute_number;

  return {
    websiteId,
    name: issue.name,
    type: issue.type,
    tags: tags || null,
    pagesOpen: abs?.open ?? 0,
    pagesClosed: abs?.closed ?? 0,
    pagesIgnored: abs?.ignored ?? 0,
    pointsGained: issue.points_gained ?? 0,
    pointsToGain: issue.points_to_gain ?? 0,
    dataCapturedAt: parseDateSafe(capturedAt),
  };
}

async function upsertWebsite(data: ConductorWebsiteData) {
  return prisma.conductorWebsite.upsert({
    where: { conductorId: data.id },
    update: { domain: data.domain, name: data.name, pageCapacity: data.page_capacity },
    create: {
      conductorId: data.id,
      domain: data.domain,
      name: data.name,
      pageCapacity: data.page_capacity,
    },
  });
}

/** Atomically takes the per-website lock; false if another run holds it. */
async function acquireLock(websiteId: string): Promise<boolean> {
  const now = new Date();
  const { count } = await prisma.conductorWebsite.updateMany({
    where: {
      id: websiteId,
      OR: [{ syncLockedUntil: null }, { syncLockedUntil: { lt: now } }],
    },
    data: { syncLockedUntil: new Date(now.getTime() + LOCK_TTL_MS) },
  });
  return count === 1;
}

async function releaseLock(websiteId: string): Promise<void> {
  await prisma.conductorWebsite.update({
    where: { id: websiteId },
    data: { syncLockedUntil: null },
  });
}

/** Resumes the latest unfinished run if its cursor is still fresh, otherwise starts a new one. */
async function startOrResumeRun(
  websiteId: string,
  syncType: "manual" | "cron"
): Promise<ConductorSyncLog> {
  const unfinished = await prisma.conductorSyncLog.findMany({
    where: { websiteId, status: { in: ["running", "paused"] } },
    orderBy: { createdAt: "desc" },
  });
  const resumable = unfinished.find(
    (log) => log.cursor && Date.now() - log.createdAt.getTime() < MAX_RESUME_AGE_MS
  );
  const superseded = unfinished.filter((log) => log.id !== resumable?.id).map((log) => log.id);
  if (superseded.length > 0) {
    await prisma.conductorSyncLog.updateMany({
      where: { id: { in: superseded } },
      data: { status: "aborted" },
    });
  }

  if (resumable) {
    return prisma.conductorSyncLog.update({
      where: { id: resumable.id },
      data: { status: "running", heartbeatAt: new Date() },
    });
  }
  return prisma.conductorSyncLog.create({
    data: { websiteId, type: syncType, status: "running", heartbeatAt: new Date() },
  });
}

/**
 * Syncs one website until it is complete or `deadline` (epoch ms) is reached; every call
 * processes at least one batch. Returns "paused" when the budget ran out — call again to continue.
 */
export async function syncConductorWebsite(
  websiteData: ConductorWebsiteData,
  syncType: "manual" | "cron",
  deadline: number
): Promise<SyncResult> {
  const startTime = Date.now();
  const website = await upsertWebsite(websiteData);
  const base = {
    websiteId: website.id,
    conductorId: websiteData.id,
    domain: websiteData.domain,
  };

  if (!(await acquireLock(website.id))) {
    return { ...base, status: "locked", pagesProcessed: 0, issuesProcessed: 0, durationMs: 0 };
  }

  let run: ConductorSyncLog | null = null;
  try {
    run = await startOrResumeRun(website.id, syncType);
    let cursor = run.cursor ?? undefined;
    let pagesProcessed = run.pagesProcessed;
    let finished = false;

    console.log(
      `[Conductor Sync] ${websiteData.domain}: ${cursor ? `resuming run ${run.id} at ${pagesProcessed} pages` : `starting run ${run.id}`}`
    );

    do {
      const batch = await getPages(websiteData.id, PAGE_BATCH_SIZE, cursor);
      await upsertPageBatch(website.id, run.id, batch.pages, batch.capturedAt);
      pagesProcessed += batch.pages.length;
      cursor = batch.nextCursor ?? undefined;
      finished = !batch.nextCursor || batch.pages.length === 0;

      const now = new Date();
      await prisma.$transaction([
        prisma.conductorSyncLog.update({
          where: { id: run.id },
          data: { cursor: cursor ?? null, pagesProcessed, heartbeatAt: now },
        }),
        prisma.conductorWebsite.update({
          where: { id: website.id },
          data: { syncLockedUntil: new Date(now.getTime() + LOCK_TTL_MS) },
        }),
      ]);
    } while (!finished && Date.now() < deadline);

    const invocationMs = Date.now() - startTime;
    const durationMs = (run.durationMs ?? 0) + invocationMs;

    if (!finished) {
      await prisma.conductorSyncLog.update({
        where: { id: run.id },
        data: { status: "paused", durationMs },
      });
      console.log(`[Conductor Sync] ${websiteData.domain}: paused after ${pagesProcessed} pages`);
      return { ...base, status: "paused", pagesProcessed, issuesProcessed: 0, durationMs };
    }

    const { count: removed } = await prisma.conductorPage.deleteMany({
      where: {
        websiteId: website.id,
        OR: [{ syncLogId: null }, { syncLogId: { not: run.id } }],
      },
    });

    const { issues, capturedAt } = await getIssues(websiteData.id);
    await prisma.$transaction([
      prisma.conductorIssue.deleteMany({ where: { websiteId: website.id } }),
      prisma.conductorIssue.createMany({
        data: issues.map((i) => buildIssueRecord(website.id, i, capturedAt)),
      }),
    ]);

    const totalMs = (run.durationMs ?? 0) + (Date.now() - startTime);
    await prisma.$transaction([
      prisma.conductorSyncLog.update({
        where: { id: run.id },
        data: {
          status: "completed",
          cursor: null,
          pagesProcessed,
          issuesProcessed: issues.length,
          durationMs: totalMs,
        },
      }),
      prisma.conductorWebsite.update({
        where: { id: website.id },
        data: { lastSyncAt: new Date() },
      }),
    ]);

    console.log(
      `[Conductor Sync] ${websiteData.domain}: completed with ${pagesProcessed} pages (${removed} removed), ${issues.length} issues`
    );
    return {
      ...base,
      status: "completed",
      pagesProcessed,
      issuesProcessed: issues.length,
      durationMs: totalMs,
    };
  } catch (error) {
    if (run) {
      await prisma.conductorSyncLog.update({
        where: { id: run.id },
        data: {
          status: "failed",
          cursor: null,
          error: error instanceof Error ? error.message : String(error),
          durationMs: (run.durationMs ?? 0) + (Date.now() - startTime),
        },
      });
    }
    throw error;
  } finally {
    await releaseLock(website.id);
  }
}

/**
 * Cron entry point: works through the websites of the Conductor account that have
 * an unfinished run or whose last sync is older than SYNC_INTERVAL_MS — oldest first —
 * until the time budget is used up. Remaining websites follow on the next invocation.
 */
export async function syncDueConductorWebsites(budgetMs: number): Promise<SyncResult[]> {
  const deadline = Date.now() + budgetMs;
  const websites = await getWebsites();
  if (websites.length === 0) {
    throw new Error("No websites found in Conductor Monitoring account");
  }

  const known = await prisma.conductorWebsite.findMany({
    where: { conductorId: { in: websites.map((w) => w.id) } },
    select: {
      conductorId: true,
      lastSyncAt: true,
      syncLogs: {
        where: { status: { in: ["running", "paused"] }, cursor: { not: null } },
        select: { id: true },
        take: 1,
      },
    },
  });
  const state = new Map(known.map((w) => [w.conductorId, w]));
  const dueBefore = Date.now() - SYNC_INTERVAL_MS;

  const due = websites
    .map((ws) => {
      const s = state.get(ws.id);
      return {
        ws,
        unfinished: (s?.syncLogs.length ?? 0) > 0,
        lastSyncAt: s?.lastSyncAt?.getTime() ?? 0,
      };
    })
    .filter((w) => w.unfinished || w.lastSyncAt < dueBefore)
    .sort((a, b) => Number(b.unfinished) - Number(a.unfinished) || a.lastSyncAt - b.lastSyncAt);

  const results: SyncResult[] = [];
  for (const { ws } of due) {
    if (Date.now() > deadline - FINALIZE_RESERVE_MS) break;
    try {
      const result = await syncConductorWebsite(ws, "cron", deadline - FINALIZE_RESERVE_MS);
      results.push(result);
      if (result.status === "paused") break;
    } catch (error) {
      console.error(`[Conductor Sync] Failed for ${ws.domain} (${ws.id}):`, error);
    }
  }
  return results;
}

/** Find the Conductor website whose domain matches the given domain string. */
export async function findConductorWebsiteByDomain(
  domain: string
): Promise<ConductorWebsiteData | undefined> {
  const websites = await getWebsites();
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  return websites.find((w) => w.domain.toLowerCase().includes(normalized));
}
