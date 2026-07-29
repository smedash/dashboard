/**
 * Shared sync logic for Conductor Monitoring data.
 * Used by both the manual sync API route and the cron job.
 */

import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import {
  getAllPages,
  getIssues,
  getWebsites,
  resolveWebsiteId,
  type ConductorPageData,
  type ConductorIssueData,
} from "./conductor-monitoring";

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export interface SyncResult {
  websiteId: string;
  conductorId: string;
  domain: string;
  pagesProcessed: number;
  issuesProcessed: number;
  durationMs: number;
}

/**
 * Sync ALL websites from the Conductor account.
 * Each website is wrapped in try/catch so one failure doesn't abort the rest.
 */
export async function syncAllConductorWebsites(
  syncType: "manual" | "cron"
): Promise<SyncResult[]> {
  const websites = await getWebsites();
  if (websites.length === 0) {
    throw new Error("No websites found in Conductor Monitoring account");
  }
  const results: SyncResult[] = [];
  for (const ws of websites) {
    try {
      const result = await syncConductorData(syncType, ws.id);
      results.push(result);
    } catch (error) {
      console.error(`[Conductor Sync] Failed for ${ws.domain} (${ws.id}):`, error);
    }
  }
  return results;
}

/**
 * Find the Conductor website ID that matches a given domain string.
 * Returns undefined if no match found.
 */
export async function findConductorWebsiteByDomain(
  domain: string
): Promise<string | undefined> {
  const websites = await getWebsites();
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  const match = websites.find((w) =>
    w.domain.toLowerCase().includes(normalized)
  );
  return match?.id;
}

export async function syncConductorData(
  syncType: "manual" | "cron",
  conductorWebsiteId?: string
): Promise<SyncResult> {
  const startTime = Date.now();
  const cId = conductorWebsiteId || (await resolveWebsiteId());

  const websites = await getWebsites();
  const websiteData = websites.find((w) => w.id === cId);
  if (!websiteData) {
    throw new Error(`Website ${cId} not found in Conductor account`);
  }

  const website = await prisma.conductorWebsite.upsert({
    where: { conductorId: cId },
    update: {
      domain: websiteData.domain,
      name: websiteData.name,
      pageCapacity: websiteData.page_capacity,
    },
    create: {
      conductorId: cId,
      domain: websiteData.domain,
      name: websiteData.name,
      pageCapacity: websiteData.page_capacity,
    },
  });

  // Create sync log entry
  const syncLog = await prisma.conductorSyncLog.create({
    data: {
      websiteId: website.id,
      type: syncType,
      status: "running",
    },
  });

  try {
    // 1. Fetch pages from API
    console.log(`[Conductor Sync] Fetching all pages for ${cId}...`);
    const { pages, capturedAt } = await getAllPages(cId);
    console.log(`[Conductor Sync] Received ${pages.length} pages`);

    // 2. Fetch issues from API
    console.log(`[Conductor Sync] Fetching issues for ${cId}...`);
    const { issues, capturedAt: issuesCapturedAt } = await getIssues(cId);
    console.log(`[Conductor Sync] Received ${issues.length} issues`);

    // 3. Bulk write: delete old data + insert new in a transaction
    console.log(`[Conductor Sync] Writing ${pages.length} pages + ${issues.length} issues to DB...`);

    const pageRecords = pages.map((p) => buildPageRecord(website.id, p, capturedAt));
    const issueRecords = issues.map((i) => buildIssueRecord(website.id, i, issuesCapturedAt));

    const CHUNK_SIZE = 500;
    await prisma.$transaction(async (tx) => {
      await tx.conductorPage.deleteMany({ where: { websiteId: website.id } });
      for (let i = 0; i < pageRecords.length; i += CHUNK_SIZE) {
        await tx.conductorPage.createMany({ data: pageRecords.slice(i, i + CHUNK_SIZE) });
      }

      await tx.conductorIssue.deleteMany({ where: { websiteId: website.id } });
      if (issueRecords.length > 0) {
        await tx.conductorIssue.createMany({ data: issueRecords });
      }
    }, { timeout: 120_000 });

    const durationMs = Date.now() - startTime;

    await prisma.conductorSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "completed",
        pagesProcessed: pages.length,
        issuesProcessed: issues.length,
        durationMs,
      },
    });

    await prisma.conductorWebsite.update({
      where: { id: website.id },
      data: { lastSyncAt: new Date() },
    });

    console.log(
      `[Conductor Sync] Completed: ${pages.length} pages, ${issues.length} issues in ${durationMs}ms`
    );

    return {
      websiteId: website.id,
      conductorId: cId,
      domain: websiteData.domain,
      pagesProcessed: pages.length,
      issuesProcessed: issues.length,
      durationMs,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await prisma.conductorSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "failed",
        error: errMsg,
        durationMs: Date.now() - startTime,
      },
    });
    throw error;
  }
}

function parseDateSafe(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function buildPageRecord(websiteId: string, p: ConductorPageData, capturedAt: string) {
  return {
    websiteId,
    url: p.url,
    health: p.health ?? null,
    statusCode: p.status_code ?? null,
    type: p.type ?? null,
    relevance: p.relevance ?? null,
    isIndexable: p.is_indexable ?? false,
    isInSitemap: p.is_in_sitemap ?? false,
    isDisallowedInRobotsTxt: p.is_disallowed_in_robots_txt ?? false,
    isLinked: p.is_linked ?? true,
    isHttps: p.is_https ?? true,
    urlDepth: typeof p.url_depth === "number" ? p.url_depth : null,
    title: typeof p.title === "string" && p.title !== "null" ? p.title : null,
    h1: typeof p.h1 === "string" && p.h1 !== "null" ? p.h1 : null,
    metaDescription:
      typeof p.meta_description === "string" && p.meta_description !== "null"
        ? p.meta_description
        : null,
    lighthousePerformance: toJson(p.lighthouse_performance),
    lighthouseCls: toJson(p.lighthouse_cls),
    lighthouseFcp: toJson(p.lighthouse_fcp),
    lighthouseLcp: toJson(p.lighthouse_lcp),
    lighthouseSi: toJson(p.lighthouse_si),
    lighthouseTbt: toJson(p.lighthouse_tbt),
    lighthouseTti: toJson(p.lighthouse_tti),
    lfaGoogleFrequency: toJson(p.lfa_google_frequency),
    lfaGoogleLastVisit: parseDateSafe(p.lfa_google_last_visit),
    lfaBingFrequency: toJson(p.lfa_bing_frequency),
    lfaBingLastVisit: parseDateSafe(p.lfa_bing_last_visit),
    lfaOpenaiFrequency: toJson(p.lfa_openai_frequency),
    lfaOpenaiLastVisit: parseDateSafe(p.lfa_openai_last_visit),
    lfaPerplexityFrequency: toJson(p.lfa_perplexity_frequency),
    lfaPerplexityLastVisit: parseDateSafe(p.lfa_perplexity_last_visit),
    incomingInternalLinks: p.number_of_incoming_internal_links ?? 0,
    outgoingInternalLinks: p.number_of_outgoing_internal_links ?? 0,
    outgoingExternalLinks: p.number_of_outgoing_external_links ?? 0,
    segments: p.segments && p.segments.length > 0 ? toJson(p.segments) : undefined,
    timeDocumentDownload:
      typeof p.time_document_download === "number"
        ? p.time_document_download
        : null,
    dataCapturedAt: parseDateSafe(capturedAt),
  };
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
