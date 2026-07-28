/**
 * Conductor Monitoring API Client (Reporting API v2 + CMS API)
 *
 * Base URL: https://api.cm.conductor.com
 * Auth: "Authorization: token {TOKEN}"
 * Rate limit: 6 req/s — 429 triggers a 1-minute cooldown
 */

const BASE_URL = "https://api.cm.conductor.com";
const REPORTING_TOKEN = () => process.env.CONDUCTOR_REPORTING_TOKEN;
const CMS_TOKEN = () => process.env.CONDUCTOR_CMS_TOKEN;

const USER_AGENT =
  "Mozilla/5.0 (compatible; SMEDashboard/1.0; +https://smedash.com)";

const MIN_REQUEST_INTERVAL_MS = 200; // 5 req/s with buffer
let lastRequestTime = 0;

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

async function conductorFetch<T>(
  path: string,
  options: {
    token?: string;
    method?: "GET" | "POST";
    body?: unknown;
    retries?: number;
  } = {}
): Promise<T> {
  const { method = "GET", body, retries = 2 } = options;
  const token = options.token || REPORTING_TOKEN();

  if (!token) {
    throw new Error(
      "Conductor Monitoring API token is not configured. Set CONDUCTOR_REPORTING_TOKEN in your environment."
    );
  }

  await throttle();

  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Authorization: `token ${token}`,
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT,
  };

  const fetchOptions: RequestInit = { method, headers };
  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, fetchOptions);

    if (res.status === 429) {
      console.warn(
        `[Conductor] Rate limited (429) on ${path} — waiting 60s (attempt ${attempt + 1})`
      );
      await new Promise((r) => setTimeout(r, 60_000));
      continue;
    }

    if (!res.ok) {
      const errorBody = await res.text().catch(() => "");
      throw new Error(
        `Conductor API ${method} ${path} failed: ${res.status} ${res.statusText} — ${errorBody}`
      );
    }

    return res.json() as Promise<T>;
  }

  throw new Error(
    `Conductor API ${method} ${path} failed after ${retries + 1} attempts (rate limited)`
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConductorWebsiteData {
  id: string;
  app_url: string;
  domain: string;
  name: string | null;
  page_capacity: number;
}

export interface ConductorSegmentData {
  id: string;
  color: string;
  label: string;
  shortcode: string | null;
}

export interface ConductorLighthouseValue {
  value: number;
  range: "good" | "needsImprovement" | "bad";
}

export interface ConductorFrequencyValue {
  value: number;
  unit: string;
}

export interface ConductorPageData {
  url: string;
  app_url: string;
  type: string;
  status_code: number;
  health: number;
  relevance: number;
  h1: string | null;
  title: string | null;
  meta_description: string | null;
  is_indexable: boolean;
  is_in_sitemap: boolean;
  is_disallowed_in_robots_txt: boolean;
  is_linked: boolean;
  is_https: boolean;
  url_depth: number;
  canonical: string | null;
  canonical_type: string;
  segments: string[];
  lighthouse_performance: ConductorLighthouseValue | null;
  lighthouse_cls: ConductorLighthouseValue | null;
  lighthouse_fcp: ConductorLighthouseValue | null;
  lighthouse_lcp: ConductorLighthouseValue | null;
  lighthouse_si: ConductorLighthouseValue | null;
  lighthouse_tbt: ConductorLighthouseValue | null;
  lighthouse_tti: ConductorLighthouseValue | null;
  lfa_google_frequency: ConductorFrequencyValue | null;
  lfa_google_last_visit: string | null;
  lfa_bing_frequency: ConductorFrequencyValue | null;
  lfa_bing_last_visit: string | null;
  lfa_openai_frequency: ConductorFrequencyValue | null;
  lfa_openai_last_visit: string | null;
  lfa_perplexity_frequency: ConductorFrequencyValue | null;
  lfa_perplexity_last_visit: string | null;
  time_document_download: number | null;
  number_of_incoming_internal_links: number;
  number_of_outgoing_internal_links: number;
  number_of_outgoing_external_links: number;
  [key: string]: unknown;
}

export interface ConductorIssueData {
  name: string;
  type: "critical" | "fix" | "opportunity";
  tags: string | string[];
  points_gained: number;
  points_to_gain: number;
  scope: string;
  pages_per_issue_state: {
    absolute_number: {
      open: number;
      closed: number;
      ignored: number;
      not_applicable: number;
      not_required: number;
      unknown: number;
    };
    percentage: {
      open: number;
      closed: number;
      ignored: number;
      not_applicable: number;
      not_required: number;
      unknown: number;
    };
  };
}

export interface ConductorStatisticsData {
  health: number;
  number_of_issues: number;
  number_of_urls: {
    page: number;
    missing: number;
    redirect: number;
    server_error: number;
    unreachable: number;
  };
  [key: string]: unknown;
}

interface PagesResponse {
  data: {
    total: number;
    next_page_cursor: string | null;
    urls: ConductorPageData[];
  };
  data_captured_at: string;
  is_data_golden: boolean;
}

interface WebsitesResponse {
  data: ConductorWebsiteData[];
}

interface SegmentsResponse {
  data: ConductorSegmentData[];
}

interface StatisticsResponse {
  data: ConductorStatisticsData;
  data_captured_at: string;
  is_data_golden: boolean;
}

interface IssuesResponse {
  data: ConductorIssueData[];
  data_captured_at: string;
  is_data_golden: boolean;
}

interface PageDetailResponse {
  data: ConductorPageData & {
    content: Array<{ type: string; content: string; hreflang?: string }>;
    open_issues: Array<{ name: string }>;
    schema_org: unknown[];
  };
  data_captured_at: string;
  is_data_golden: boolean;
}

interface AlertData {
  id: string;
  app_url: string;
  date_last_updated: string;
  date_opened: string;
  scope: string;
  type: string;
}

interface AlertsResponse {
  data: AlertData[];
}

interface CheckUrlResponse {
  status: string;
}

// ---------------------------------------------------------------------------
// Reporting API v2 — Entities
// ---------------------------------------------------------------------------

export async function getWebsites(): Promise<ConductorWebsiteData[]> {
  const res = await conductorFetch<WebsitesResponse>(
    "/v2/entities/websites"
  );
  return res.data;
}

export async function getSegments(
  websiteId: string
): Promise<ConductorSegmentData[]> {
  const res = await conductorFetch<SegmentsResponse>(
    `/v2/entities/segments?website_id=${encodeURIComponent(websiteId)}`
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Reporting API v2 — Data
// ---------------------------------------------------------------------------

export async function getStatistics(
  websiteId: string,
  scope: string = "website"
): Promise<{ statistics: ConductorStatisticsData; capturedAt: string }> {
  const res = await conductorFetch<StatisticsResponse>(
    `/v2/data/statistics?website_id=${encodeURIComponent(websiteId)}&scope=${encodeURIComponent(scope)}`
  );
  return { statistics: res.data, capturedAt: res.data_captured_at };
}

export async function getPages(
  websiteId: string,
  perPage: number = 1000,
  pageCursor?: string
): Promise<{
  pages: ConductorPageData[];
  total: number;
  nextCursor: string | null;
  capturedAt: string;
}> {
  let path = `/v2/data/pages?website_id=${encodeURIComponent(websiteId)}&per_page=${perPage}`;
  if (pageCursor) {
    path += `&page_cursor=${encodeURIComponent(pageCursor)}`;
  }
  const res = await conductorFetch<PagesResponse>(path);
  return {
    pages: res.data.urls,
    total: res.data.total,
    nextCursor: res.data.next_page_cursor,
    capturedAt: res.data_captured_at,
  };
}

/** Fetches ALL pages, auto-paginating through the full dataset. */
export async function getAllPages(
  websiteId: string
): Promise<{ pages: ConductorPageData[]; capturedAt: string }> {
  const allPages: ConductorPageData[] = [];
  let cursor: string | undefined;
  let capturedAt = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await getPages(websiteId, 1000, cursor);
    allPages.push(...result.pages);
    capturedAt = result.capturedAt;

    if (!result.nextCursor || result.pages.length === 0) break;
    cursor = result.nextCursor;
  }

  return { pages: allPages, capturedAt };
}

export async function getPageDetail(
  websiteId: string,
  url: string
): Promise<PageDetailResponse> {
  return conductorFetch<PageDetailResponse>(
    `/v2/data/page?website_id=${encodeURIComponent(websiteId)}&url=${encodeURIComponent(url)}`
  );
}

export async function getIssues(
  websiteId: string,
  scope: string = "website"
): Promise<{ issues: ConductorIssueData[]; capturedAt: string }> {
  const res = await conductorFetch<IssuesResponse>(
    `/v2/data/issues?website_id=${encodeURIComponent(websiteId)}&scope=${encodeURIComponent(scope)}`
  );
  return { issues: res.data, capturedAt: res.data_captured_at };
}

export async function getAlerts(websiteId: string): Promise<AlertData[]> {
  const res = await conductorFetch<AlertsResponse>(
    `/v2/alerts?website_id=${encodeURIComponent(websiteId)}`
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// CMS API — check_url
// ---------------------------------------------------------------------------

export async function checkUrl(url: string): Promise<CheckUrlResponse> {
  const cmsToken = CMS_TOKEN();
  if (!cmsToken) {
    throw new Error(
      "Conductor CMS API token is not configured. Set CONDUCTOR_CMS_TOKEN in your environment."
    );
  }
  return conductorFetch<CheckUrlResponse>("/v1/check_url", {
    token: cmsToken,
    method: "POST",
    body: { url },
  });
}

// ---------------------------------------------------------------------------
// Helper: resolve default website ID
// ---------------------------------------------------------------------------

export async function resolveWebsiteId(): Promise<string> {
  const envId = process.env.CONDUCTOR_WEBSITE_ID;
  if (envId) return envId;

  const websites = await getWebsites();
  if (websites.length === 0) {
    throw new Error("No websites found in Conductor Monitoring account");
  }
  return websites[0].id;
}
