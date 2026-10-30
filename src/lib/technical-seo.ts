/**
 * Shared types and constants for the "Technisches SEO" page (client + server).
 * Data source: Conductor Monitoring tables filled by `conductor-sync.ts`.
 */

export const HEALTH_GOOD = 800;
export const HEALTH_MEDIUM = 500;

export const URL_FILTERS = [
  "all",
  "pages",
  "notIndexable",
  "notInSitemap",
  "lowHealth",
  "orphans",
  "disallowed",
  "redirects",
  "missing",
  "errors",
  "crawled",
  "aiCrawled",
] as const;
export type UrlFilter = (typeof URL_FILTERS)[number];

export const URL_SORT_FIELDS = [
  "url",
  "health",
  "statusCode",
  "relevance",
  "urlDepth",
  "incomingInternalLinks",
  "outgoingInternalLinks",
  "outgoingExternalLinks",
  "timeDocumentDownload",
  "lfaGoogleLastVisit",
  "lfaBingLastVisit",
  "lfaOpenaiLastVisit",
  "lfaPerplexityLastVisit",
] as const;
export type UrlSortField = (typeof URL_SORT_FIELDS)[number];

export const CRAWLER_BOTS = ["google", "bing", "openai", "perplexity"] as const;
export type CrawlerBot = (typeof CRAWLER_BOTS)[number];

export const URL_PAGE_SIZE = 50;
export const URL_EXPORT_LIMIT = 50_000;

export interface MetricValue {
  value: number;
  range: "good" | "needsImprovement" | "bad";
}

export interface FrequencyValue {
  value: number;
  unit: string;
}

export interface CrawlerVisit {
  frequency: FrequencyValue | null;
  lastVisit: string | null;
}

export interface TechnicalSeoUrl {
  id: string;
  url: string;
  health: number | null;
  statusCode: number | null;
  type: string | null;
  relevance: number | null;
  isIndexable: boolean;
  isInSitemap: boolean;
  isDisallowedInRobotsTxt: boolean;
  isLinked: boolean;
  isHttps: boolean;
  urlDepth: number | null;
  title: string | null;
  h1: string | null;
  metaDescription: string | null;
  lighthouse: {
    performance: MetricValue | null;
    cls: MetricValue | null;
    fcp: MetricValue | null;
    lcp: MetricValue | null;
    si: MetricValue | null;
    tbt: MetricValue | null;
    tti: MetricValue | null;
  };
  crawlers: Record<CrawlerBot, CrawlerVisit>;
  incomingInternalLinks: number;
  outgoingInternalLinks: number;
  outgoingExternalLinks: number;
  timeDocumentDownload: number | null;
  appUrl: string | null;
  openIssues: string[];
  issuesSyncedAt: string | null;
}

export interface UrlListResponse {
  rows: TechnicalSeoUrl[];
  total: number;
  truncated?: boolean;
}

export interface TechnicalSeoIssue {
  id: string;
  name: string;
  type: string;
  tags: string[];
  pagesOpen: number;
  pagesClosed: number;
  pagesIgnored: number;
  pointsGained: number;
  pointsToGain: number;
}

/** How many pages already have their per-URL issue list from Conductor. */
export interface PageIssueCoverage {
  pages: number;
  synced: number;
  syncedAt: string | null;
}

export interface IssuesResponse {
  issues: TechnicalSeoIssue[];
  coverage: PageIssueCoverage | null;
}

export interface CrawlerSummary {
  bot: CrawlerBot;
  pagesVisited: number;
  visitedLast7Days: number;
  visitedLast30Days: number;
  lastVisit: string | null;
}

export interface TechnicalSeoWebsite {
  name: string;
  domain: string;
  lastSyncAt: string | null;
}

export interface TechnicalSeoOverview {
  website: TechnicalSeoWebsite;
  capturedAt: string | null;
  totals: {
    urls: number;
    pages: number;
    redirects: number;
    missing: number;
    serverErrors: number;
    timeouts: number;
  };
  statusClasses: { s2xx: number; s3xx: number; s4xx: number; s5xx: number; none: number };
  health: { average: number | null; good: number; medium: number; poor: number };
  indexability: {
    indexable: number;
    notIndexable: number;
    notInSitemap: number;
    orphans: number;
    disallowed: number;
  };
  avgDownloadMs: number | null;
  depth: { depth: number; count: number }[];
  issues: {
    critical: number;
    fix: number;
    opportunity: number;
    pointsToGain: number;
    pointsGained: number;
  };
  topIssues: TechnicalSeoIssue[];
  crawlers: CrawlerSummary[];
}

export type SyncStatus = "running" | "paused" | "completed" | "failed" | "aborted";

export interface SyncLogEntry {
  id: string;
  type: string;
  status: SyncStatus;
  pagesProcessed: number;
  issuesProcessed: number;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
}

/** Website-wide issues have no affected pages but can still cost points. */
export function isOpenIssue(issue: Pick<TechnicalSeoIssue, "pagesOpen" | "pointsToGain">): boolean {
  return issue.pagesOpen > 0 || issue.pointsToGain > 0;
}

export function propertyToDomain(property: string): string {
  if (property.startsWith("sc-domain:")) {
    return property.replace("sc-domain:", "").replace(/^www\./, "");
  }
  try {
    return new URL(property).hostname.replace(/^www\./, "");
  } catch {
    return property.replace(/^www\./, "");
  }
}
