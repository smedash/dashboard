/**
 * Read access to the synced Conductor Monitoring data (pages, issues, sync logs).
 */

import { Prisma, type ConductorIssue, type ConductorPage, type ConductorWebsite } from "@prisma/client";
import { prisma } from "./prisma";
import {
  CRAWLER_BOTS,
  HEALTH_GOOD,
  HEALTH_MEDIUM,
  isOpenIssue,
  type CrawlerBot,
  type CrawlerSummary,
  type FrequencyValue,
  type MetricValue,
  type SyncLogEntry,
  type TechnicalSeoIssue,
  type TechnicalSeoOverview,
  type TechnicalSeoUrl,
  type UrlFilter,
  type UrlSortField,
} from "./technical-seo";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Matches the lock TTL in conductor-sync.ts: no heartbeat for this long means the process died. */
const STALE_SYNC_MS = 5 * 60 * 1000;

const LAST_VISIT_COLUMN: Record<CrawlerBot, string> = {
  google: "lfaGoogleLastVisit",
  bing: "lfaBingLastVisit",
  openai: "lfaOpenaiLastVisit",
  perplexity: "lfaPerplexityLastVisit",
};

const NULLABLE_SORT_FIELDS = new Set<UrlSortField>([
  "health",
  "statusCode",
  "relevance",
  "urlDepth",
  "timeDocumentDownload",
  "lfaGoogleLastVisit",
  "lfaBingLastVisit",
  "lfaOpenaiLastVisit",
  "lfaPerplexityLastVisit",
]);

export function findConductorWebsiteForDomain(domain: string) {
  return prisma.conductorWebsite.findFirst({
    where: { domain: { contains: domain, mode: "insensitive" } },
    orderBy: { lastSyncAt: { sort: "desc", nulls: "last" } },
  });
}

function toIssue(issue: ConductorIssue): TechnicalSeoIssue {
  return {
    id: issue.id,
    name: issue.name,
    type: issue.type,
    tags: (issue.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    pagesOpen: issue.pagesOpen,
    pagesClosed: issue.pagesClosed,
    pagesIgnored: issue.pagesIgnored,
    pointsGained: issue.pointsGained,
    pointsToGain: issue.pointsToGain,
  };
}

export async function getConductorIssues(websiteId: string): Promise<TechnicalSeoIssue[]> {
  const issues = await prisma.conductorIssue.findMany({
    where: { websiteId },
    orderBy: [{ pointsToGain: "desc" }, { pagesOpen: "desc" }, { name: "asc" }],
  });
  return issues.map(toIssue);
}

interface OverviewRow {
  urls: number;
  pages: number;
  redirects: number;
  missing: number;
  serverErrors: number;
  timeouts: number;
  s2xx: number;
  s3xx: number;
  s4xx: number;
  s5xx: number;
  sNone: number;
  avgHealth: number | null;
  healthGood: number;
  healthMedium: number;
  healthPoor: number;
  indexable: number;
  notIndexable: number;
  notInSitemap: number;
  orphans: number;
  disallowed: number;
  avgDownloadMs: number | null;
  capturedAt: Date | null;
  [crawlerColumn: string]: number | Date | null;
}

export async function getTechnicalSeoOverview(
  website: ConductorWebsite
): Promise<TechnicalSeoOverview> {
  const now = Date.now();
  const since7 = new Date(now - 7 * DAY_MS);
  const since30 = new Date(now - 30 * DAY_MS);

  const crawlerColumns = Prisma.join(
    CRAWLER_BOTS.map((bot) => {
      const col = Prisma.raw(`"${LAST_VISIT_COLUMN[bot]}"`);
      return Prisma.sql`
        count(${col})::int AS ${Prisma.raw(`"${bot}Visited"`)},
        count(*) FILTER (WHERE ${col} >= ${since7})::int AS ${Prisma.raw(`"${bot}Last7"`)},
        count(*) FILTER (WHERE ${col} >= ${since30})::int AS ${Prisma.raw(`"${bot}Last30"`)},
        max(${col}) AS ${Prisma.raw(`"${bot}LastVisit"`)}`;
    })
  );

  const [[row], depthGroups, issues] = await Promise.all([
    prisma.$queryRaw<OverviewRow[]>`
      SELECT
        count(*)::int AS "urls",
        count(*) FILTER (WHERE "type" = 'page')::int AS "pages",
        count(*) FILTER (WHERE "type" = 'redirect')::int AS "redirects",
        count(*) FILTER (WHERE "type" = 'missing')::int AS "missing",
        count(*) FILTER (WHERE "type" = 'server_error')::int AS "serverErrors",
        count(*) FILTER (WHERE "type" = 'timeout')::int AS "timeouts",
        count(*) FILTER (WHERE "statusCode" BETWEEN 200 AND 299)::int AS "s2xx",
        count(*) FILTER (WHERE "statusCode" BETWEEN 300 AND 399)::int AS "s3xx",
        count(*) FILTER (WHERE "statusCode" BETWEEN 400 AND 499)::int AS "s4xx",
        count(*) FILTER (WHERE "statusCode" >= 500)::int AS "s5xx",
        count(*) FILTER (WHERE "statusCode" IS NULL)::int AS "sNone",
        avg("health")::float AS "avgHealth",
        count(*) FILTER (WHERE "health" >= ${HEALTH_GOOD})::int AS "healthGood",
        count(*) FILTER (WHERE "health" >= ${HEALTH_MEDIUM} AND "health" < ${HEALTH_GOOD})::int AS "healthMedium",
        count(*) FILTER (WHERE "health" < ${HEALTH_MEDIUM})::int AS "healthPoor",
        count(*) FILTER (WHERE "type" = 'page' AND "isIndexable")::int AS "indexable",
        count(*) FILTER (WHERE "type" = 'page' AND NOT "isIndexable")::int AS "notIndexable",
        count(*) FILTER (WHERE "type" = 'page' AND "isIndexable" AND NOT "isInSitemap")::int AS "notInSitemap",
        count(*) FILTER (WHERE "type" = 'page' AND NOT "isLinked")::int AS "orphans",
        count(*) FILTER (WHERE "isDisallowedInRobotsTxt")::int AS "disallowed",
        avg("timeDocumentDownload") FILTER (WHERE "type" = 'page')::float AS "avgDownloadMs",
        max("dataCapturedAt") AS "capturedAt",
        ${crawlerColumns}
      FROM "ConductorPage"
      WHERE "websiteId" = ${website.id}
    `,
    prisma.conductorPage.groupBy({
      by: ["urlDepth"],
      where: { websiteId: website.id, type: "page", urlDepth: { not: null } },
      _count: { _all: true },
      orderBy: { urlDepth: "asc" },
    }),
    getConductorIssues(website.id),
  ]);

  const openIssues = issues.filter(isOpenIssue);
  const countOpen = (type: string) => openIssues.filter((i) => i.type === type).length;

  const crawlers: CrawlerSummary[] = CRAWLER_BOTS.map((bot) => {
    const lastVisit = row[`${bot}LastVisit`] as Date | null;
    return {
      bot,
      pagesVisited: row[`${bot}Visited`] as number,
      visitedLast7Days: row[`${bot}Last7`] as number,
      visitedLast30Days: row[`${bot}Last30`] as number,
      lastVisit: lastVisit ? lastVisit.toISOString() : null,
    };
  });

  return {
    website: {
      name: website.name || website.domain,
      domain: website.domain,
      lastSyncAt: website.lastSyncAt?.toISOString() ?? null,
    },
    capturedAt: row.capturedAt?.toISOString() ?? null,
    totals: {
      urls: row.urls,
      pages: row.pages,
      redirects: row.redirects,
      missing: row.missing,
      serverErrors: row.serverErrors,
      timeouts: row.timeouts,
    },
    statusClasses: {
      s2xx: row.s2xx,
      s3xx: row.s3xx,
      s4xx: row.s4xx,
      s5xx: row.s5xx,
      none: row.sNone,
    },
    health: {
      average: row.avgHealth === null ? null : Math.round(row.avgHealth),
      good: row.healthGood,
      medium: row.healthMedium,
      poor: row.healthPoor,
    },
    indexability: {
      indexable: row.indexable,
      notIndexable: row.notIndexable,
      notInSitemap: row.notInSitemap,
      orphans: row.orphans,
      disallowed: row.disallowed,
    },
    avgDownloadMs: row.avgDownloadMs === null ? null : Math.round(row.avgDownloadMs),
    depth: depthGroups.map((g) => ({ depth: g.urlDepth as number, count: g._count._all })),
    issues: {
      critical: countOpen("critical"),
      fix: countOpen("fix"),
      opportunity: countOpen("opportunity"),
      pointsToGain: issues.reduce((sum, i) => sum + i.pointsToGain, 0),
      pointsGained: issues.reduce((sum, i) => sum + i.pointsGained, 0),
    },
    topIssues: openIssues.slice(0, 5),
    crawlers,
  };
}

function urlFilterWhere(filter: UrlFilter): Prisma.ConductorPageWhereInput {
  switch (filter) {
    case "pages":
      return { type: "page" };
    case "notIndexable":
      return { type: "page", isIndexable: false };
    case "notInSitemap":
      return { type: "page", isIndexable: true, isInSitemap: false };
    case "lowHealth":
      return { health: { lt: HEALTH_MEDIUM } };
    case "orphans":
      return { type: "page", isLinked: false };
    case "disallowed":
      return { isDisallowedInRobotsTxt: true };
    case "redirects":
      return { type: "redirect" };
    case "missing":
      return { type: "missing" };
    case "errors":
      return { type: { in: ["server_error", "timeout"] } };
    case "crawled":
      return {
        OR: CRAWLER_BOTS.map((bot) => ({ [LAST_VISIT_COLUMN[bot]]: { not: null } })),
      };
    case "aiCrawled":
      return {
        OR: [{ lfaOpenaiLastVisit: { not: null } }, { lfaPerplexityLastVisit: { not: null } }],
      };
    default:
      return {};
  }
}

const asMetric = (v: Prisma.JsonValue) => (v as unknown as MetricValue | null) ?? null;
const asFrequency = (v: Prisma.JsonValue) => (v as unknown as FrequencyValue | null) ?? null;
const iso = (d: Date | null) => (d ? d.toISOString() : null);

function toUrl(p: ConductorPage): TechnicalSeoUrl {
  return {
    id: p.id,
    url: p.url,
    health: p.health,
    statusCode: p.statusCode,
    type: p.type,
    relevance: p.relevance,
    isIndexable: p.isIndexable,
    isInSitemap: p.isInSitemap,
    isDisallowedInRobotsTxt: p.isDisallowedInRobotsTxt,
    isLinked: p.isLinked,
    isHttps: p.isHttps,
    urlDepth: p.urlDepth,
    title: p.title,
    h1: p.h1,
    metaDescription: p.metaDescription,
    lighthouse: {
      performance: asMetric(p.lighthousePerformance),
      cls: asMetric(p.lighthouseCls),
      fcp: asMetric(p.lighthouseFcp),
      lcp: asMetric(p.lighthouseLcp),
      si: asMetric(p.lighthouseSi),
      tbt: asMetric(p.lighthouseTbt),
      tti: asMetric(p.lighthouseTti),
    },
    crawlers: {
      google: { frequency: asFrequency(p.lfaGoogleFrequency), lastVisit: iso(p.lfaGoogleLastVisit) },
      bing: { frequency: asFrequency(p.lfaBingFrequency), lastVisit: iso(p.lfaBingLastVisit) },
      openai: { frequency: asFrequency(p.lfaOpenaiFrequency), lastVisit: iso(p.lfaOpenaiLastVisit) },
      perplexity: {
        frequency: asFrequency(p.lfaPerplexityFrequency),
        lastVisit: iso(p.lfaPerplexityLastVisit),
      },
    },
    incomingInternalLinks: p.incomingInternalLinks,
    outgoingInternalLinks: p.outgoingInternalLinks,
    outgoingExternalLinks: p.outgoingExternalLinks,
    timeDocumentDownload: p.timeDocumentDownload,
  };
}

export interface UrlQuery {
  filter: UrlFilter;
  search: string;
  sort: UrlSortField;
  dir: "asc" | "desc";
  skip: number;
  take: number;
}

export async function queryConductorUrls(
  websiteId: string,
  q: UrlQuery
): Promise<{ rows: TechnicalSeoUrl[]; total: number }> {
  const where: Prisma.ConductorPageWhereInput = {
    websiteId,
    ...urlFilterWhere(q.filter),
    ...(q.search ? { url: { contains: q.search, mode: "insensitive" } } : {}),
  };
  const orderBy: Prisma.ConductorPageOrderByWithRelationInput[] = [
    NULLABLE_SORT_FIELDS.has(q.sort)
      ? { [q.sort]: { sort: q.dir, nulls: "last" } }
      : { [q.sort]: q.dir },
    { id: "asc" },
  ];

  const [rows, total] = await Promise.all([
    prisma.conductorPage.findMany({ where, orderBy, skip: q.skip, take: q.take }),
    prisma.conductorPage.count({ where }),
  ]);
  return { rows: rows.map(toUrl), total };
}

export async function getConductorSyncLogs(websiteId: string, take = 10): Promise<SyncLogEntry[]> {
  const logs = await prisma.conductorSyncLog.findMany({
    where: { websiteId },
    orderBy: { createdAt: "desc" },
    take,
  });
  const staleBefore = Date.now() - STALE_SYNC_MS;
  const displayStatus = (log: (typeof logs)[number]): SyncLogEntry["status"] => {
    const lastSign = (log.heartbeatAt ?? log.createdAt).getTime();
    if (log.status === "running" && lastSign < staleBefore) {
      return log.cursor ? "paused" : "aborted";
    }
    return log.status as SyncLogEntry["status"];
  };
  return logs.map((log) => ({
    id: log.id,
    type: log.type,
    status: displayStatus(log),
    pagesProcessed: log.pagesProcessed,
    issuesProcessed: log.issuesProcessed,
    durationMs: log.durationMs,
    error: log.error,
    createdAt: log.createdAt.toISOString(),
  }));
}
