/**
 * Fills ConductorPage.openIssues from the Conductor affected_pages endpoint.
 *
 * The bulk pages endpoint carries no issue data. Instead of one detail request per page,
 * the affected URLs of every issue are listed in result pages of up to 1000 URLs, so a
 * website needs about sum(ceil(open pages per issue / 1000)) requests — a few thousand
 * even for websites with hundreds of thousands of pages.
 *
 * A run is resumable: the position of the next request (issue + result page) is stored on
 * the website and the matches are collected in ConductorPageIssueStage. Only a completed
 * run replaces the issue lists, so readers keep the previous full data set meanwhile.
 * A run belongs to one completed page sync; a newer page sync restarts it.
 */

import type { ConductorWebsite } from "@prisma/client";
import { prisma } from "./prisma";
import { ConductorApiError, getAffectedPages } from "./conductor-monitoring";

const PER_PAGE = 1000;
/** Responses take seconds; the shared throttle keeps the request starts within the rate limit. */
const CONCURRENCY = 16;
const BATCH_SIZE = 48;
const FINALIZE_CHUNK = 10_000;
const LOCK_TTL_MS = 5 * 60 * 1000;
/** Conductor answers these for issues it cannot list pages for; such issues are skipped. */
const SKIPPABLE_STATUS = new Set([400, 404, 422]);

export type PageIssueRefreshStatus = "completed" | "paused" | "locked" | "current";

export interface PageIssueRefreshResult {
  domain: string;
  status: PageIssueRefreshStatus;
  /** API requests made in this call. */
  processed: number;
  /** Estimated API requests left until the run is complete. */
  pending: number;
}

type WebsiteRef = Pick<ConductorWebsite, "id" | "conductorId" | "domain" | "lastSyncAt">;
type RunState = Pick<ConductorWebsite, "lastSyncAt" | "pageIssuesBasis" | "pageIssuesCursorPage">;

interface IssuePlan {
  name: string;
  /** Result pages of the affected_pages endpoint; corrected by the totals the API reports. */
  pages: number;
}

interface Cursor {
  index: number;
  page: number;
}

function isRunning(w: RunState): boolean {
  return w.pageIssuesCursorPage !== null && w.pageIssuesBasis?.getTime() === w.lastSyncAt?.getTime();
}

function isDue(w: RunState): boolean {
  return w.lastSyncAt !== null && (w.pageIssuesBasis?.getTime() !== w.lastSyncAt.getTime() || isRunning(w));
}

export async function getPageIssueCoverage(
  websiteId: string
): Promise<{ pages: number; synced: number; syncedAt: string | null }> {
  const [pages, synced, latest] = await Promise.all([
    prisma.conductorPage.count({ where: { websiteId, type: "page" } }),
    prisma.conductorPage.count({ where: { websiteId, type: "page", issuesSyncedAt: { not: null } } }),
    prisma.conductorPage.aggregate({
      where: { websiteId, type: "page" },
      _max: { issuesSyncedAt: true },
    }),
  ]);
  return { pages, synced, syncedAt: latest._max.issuesSyncedAt?.toISOString() ?? null };
}

async function acquireLock(websiteId: string): Promise<boolean> {
  const now = new Date();
  const { count } = await prisma.conductorWebsite.updateMany({
    where: {
      id: websiteId,
      OR: [{ pageIssuesLockedUntil: null }, { pageIssuesLockedUntil: { lt: now } }],
    },
    data: { pageIssuesLockedUntil: new Date(now.getTime() + LOCK_TTL_MS) },
  });
  return count === 1;
}

async function releaseLock(websiteId: string): Promise<void> {
  await prisma.conductorWebsite.update({
    where: { id: websiteId },
    data: { pageIssuesLockedUntil: null },
  });
}

/** Runs `fn` over `items` with at most `limit` calls in flight; stops taking new items after a failure. */
async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const index = next++;
      try {
        results[index] = await fn(items[index]);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function loadPlan(websiteId: string): Promise<IssuePlan[]> {
  const issues = await prisma.conductorIssue.findMany({
    where: { websiteId, pagesOpen: { gt: 0 } },
    select: { name: true, pagesOpen: true },
    orderBy: { name: "asc" },
  });
  return issues.map((i) => ({ name: i.name, pages: Math.ceil(i.pagesOpen / PER_PAGE) }));
}

/** Moves the cursor past issues whose result pages are exhausted. */
function normalize(plan: IssuePlan[], cursor: Cursor): Cursor {
  let { index, page } = cursor;
  while (index < plan.length && page > plan[index].pages) {
    index++;
    page = 1;
  }
  return { index, page };
}

function isBefore(a: Cursor, b: Cursor): boolean {
  return a.index < b.index || (a.index === b.index && a.page < b.page);
}

function remainingRequests(plan: IssuePlan[], cursor: Cursor): number {
  let n = 0;
  for (let i = cursor.index; i < plan.length; i++) {
    n += Math.max(0, plan[i].pages - (i === cursor.index ? cursor.page - 1 : 0));
  }
  return n;
}

function nextTasks(plan: IssuePlan[], from: Cursor, limit: number): { tasks: Cursor[]; after: Cursor } {
  const tasks: Cursor[] = [];
  let cursor = normalize(plan, from);
  while (tasks.length < limit && cursor.index < plan.length) {
    tasks.push(cursor);
    cursor = normalize(plan, { index: cursor.index, page: cursor.page + 1 });
  }
  return { tasks, after: cursor };
}

/** Stages the matches of one result page; returns the issue's total, or null if the issue is skipped. */
async function fetchAndStage(website: WebsiteRef, issue: string, page: number): Promise<number | null> {
  let result: { urls: string[]; total: number };
  try {
    result = await getAffectedPages(website.conductorId, issue, page, PER_PAGE);
  } catch (error) {
    if (error instanceof ConductorApiError && SKIPPABLE_STATUS.has(error.status)) {
      console.warn(`[Conductor Page Issues] ${website.domain} ${issue}: ${error.message}`);
      return null;
    }
    throw error;
  }
  if (result.urls.length > 0) {
    await prisma.$executeRaw`
      INSERT INTO "ConductorPageIssueStage" ("websiteId", "pageId", "issue")
      SELECT ${website.id}::text, p."id", ${issue}::text
      FROM "ConductorPage" AS p
      WHERE p."websiteId" = ${website.id} AND p."url" = ANY(${result.urls}::text[])
      ON CONFLICT DO NOTHING
    `;
  }
  return result.total;
}

/**
 * Applies the totals reported by the API to the plan. If an issue has more result pages than
 * planned and the batch already moved past it, the cursor goes back to its first missing page.
 */
function applyTotals(plan: IssuePlan[], tasks: Cursor[], totals: (number | null)[], after: Cursor): Cursor {
  let next = after;
  tasks.forEach((task, i) => {
    const total = totals[i];
    const issue = plan[task.index];
    const pages = total === null ? 0 : Math.ceil(total / PER_PAGE);
    if (pages > issue.pages) {
      const firstMissing = { index: task.index, page: issue.pages + 1 };
      if (isBefore(firstMissing, next)) next = firstMissing;
    }
    issue.pages = pages;
  });
  return normalize(plan, next);
}

/** Replaces the issue lists of all pages by the staged matches of the completed run. */
async function finalizeRun(websiteId: string): Promise<void> {
  const now = new Date();
  let lastId: string | undefined;
  for (;;) {
    const chunk = await prisma.conductorPage.findMany({
      where: {
        websiteId,
        OR: [{ type: "page" }, { NOT: { openIssues: { isEmpty: true } } }],
        ...(lastId ? { id: { gt: lastId } } : {}),
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: FINALIZE_CHUNK,
    });
    if (chunk.length === 0) break;
    const ids = chunk.map((c) => c.id);
    await prisma.$executeRaw`
      UPDATE "ConductorPage" AS p
      SET "openIssues" = v.issues, "issuesSyncedAt" = ${now}
      FROM (
        SELECT c.id,
          COALESCE(array_agg(s."issue" ORDER BY s."issue") FILTER (WHERE s."issue" IS NOT NULL), ARRAY[]::text[]) AS issues
        FROM unnest(${ids}::text[]) AS c(id)
        LEFT JOIN "ConductorPageIssueStage" AS s ON s."pageId" = c.id
        GROUP BY c.id
      ) AS v
      WHERE p."id" = v.id
    `;
    lastId = ids[ids.length - 1];
  }
  await prisma.$transaction([
    prisma.conductorPageIssueStage.deleteMany({ where: { websiteId } }),
    prisma.conductorWebsite.update({
      where: { id: websiteId },
      data: { pageIssuesSyncedAt: now, pageIssuesCursorIssue: null, pageIssuesCursorPage: null },
    }),
  ]);
}

/**
 * Works on the issue matching of one website until it is complete or `deadline` (epoch ms)
 * is reached; every call makes at least one batch of requests. Call again while "paused".
 */
export async function refreshPageIssues(website: WebsiteRef, deadline: number): Promise<PageIssueRefreshResult> {
  const base = { domain: website.domain };
  if (!(await acquireLock(website.id))) {
    return { ...base, status: "locked", processed: 0, pending: 0 };
  }

  try {
    const state = await prisma.conductorWebsite.findUniqueOrThrow({
      where: { id: website.id },
      select: {
        lastSyncAt: true,
        pageIssuesBasis: true,
        pageIssuesCursorIssue: true,
        pageIssuesCursorPage: true,
      },
    });
    if (!isDue(state)) {
      return { ...base, status: "current", processed: 0, pending: 0 };
    }

    const plan = await loadPlan(website.id);
    let cursor: Cursor;
    const cursorIndex = state.pageIssuesCursorIssue
      ? plan.findIndex((i) => i.name === state.pageIssuesCursorIssue)
      : plan.length;
    if (isRunning(state) && cursorIndex >= 0) {
      cursor = normalize(plan, { index: cursorIndex, page: state.pageIssuesCursorPage ?? 1 });
    } else {
      cursor = normalize(plan, { index: 0, page: 1 });
      await prisma.$transaction([
        prisma.conductorPageIssueStage.deleteMany({ where: { websiteId: website.id } }),
        prisma.conductorWebsite.update({
          where: { id: website.id },
          data: {
            pageIssuesBasis: state.lastSyncAt,
            pageIssuesCursorIssue: plan[cursor.index]?.name ?? null,
            pageIssuesCursorPage: cursor.page,
          },
        }),
      ]);
      console.log(
        `[Conductor Page Issues] ${website.domain}: starting run, ~${remainingRequests(plan, cursor)} requests`
      );
    }

    let processed = 0;
    while (cursor.index < plan.length && (processed === 0 || Date.now() < deadline)) {
      const { tasks, after } = nextTasks(plan, cursor, BATCH_SIZE);
      const totals = await mapConcurrent(tasks, CONCURRENCY, (task) =>
        fetchAndStage(website, plan[task.index].name, task.page)
      );
      processed += tasks.length;
      cursor = applyTotals(plan, tasks, totals, after);
      await prisma.conductorWebsite.update({
        where: { id: website.id },
        data: {
          pageIssuesCursorIssue: plan[cursor.index]?.name ?? null,
          pageIssuesCursorPage: cursor.page,
          pageIssuesLockedUntil: new Date(Date.now() + LOCK_TTL_MS),
        },
      });
    }

    if (cursor.index < plan.length) {
      return { ...base, status: "paused", processed, pending: remainingRequests(plan, cursor) };
    }
    await finalizeRun(website.id);
    console.log(`[Conductor Page Issues] ${website.domain}: completed`);
    return { ...base, status: "completed", processed, pending: 0 };
  } finally {
    await releaseLock(website.id);
  }
}

/**
 * Cron entry point: works through the websites whose issue matching is older than their
 * last page sync, cheapest first, so small websites are done quickly while large ones
 * progress over several runs.
 */
export async function refreshDuePageIssues(deadline: number): Promise<PageIssueRefreshResult[]> {
  const websites = await prisma.conductorWebsite.findMany({
    where: { lastSyncAt: { not: null } },
    select: {
      id: true,
      conductorId: true,
      domain: true,
      lastSyncAt: true,
      pageIssuesBasis: true,
      pageIssuesCursorPage: true,
    },
  });
  const due = websites.filter(isDue);
  if (due.length === 0) return [];

  const estimates = await prisma.$queryRaw<{ websiteId: string; requests: number }[]>`
    SELECT "websiteId", SUM(CEIL("pagesOpen"::float8 / ${PER_PAGE}))::int AS requests
    FROM "ConductorIssue"
    WHERE "websiteId" = ANY(${due.map((w) => w.id)}::text[]) AND "pagesOpen" > 0
    GROUP BY "websiteId"
  `;
  const cost = new Map(estimates.map((e) => [e.websiteId, e.requests]));
  due.sort((a, b) => (cost.get(a.id) ?? 0) - (cost.get(b.id) ?? 0));

  const results: PageIssueRefreshResult[] = [];
  for (const website of due) {
    if (Date.now() >= deadline) break;
    try {
      results.push(await refreshPageIssues(website, deadline));
    } catch (error) {
      console.error(`[Conductor Page Issues] Failed for ${website.domain}:`, error);
    }
  }
  return results;
}
