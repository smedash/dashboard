/**
 * Fills ConductorPage.openIssues from the Conductor page detail endpoint.
 *
 * The bulk pages endpoint carries no issue data, so every page needs its own request
 * (~6 req/s API limit). The refresh is therefore incremental: it works through the pages
 * whose issue list is older than the website's last completed page sync — never fetched
 * first, then oldest first — until the time budget is used up. Only pages of type "page"
 * have issues; redirects and missing URLs never do.
 */

import { Prisma, type ConductorWebsite } from "@prisma/client";
import { prisma } from "./prisma";
import { ConductorApiError, getPageDetail } from "./conductor-monitoring";

/** Requests in flight; the shared throttle keeps them within the API rate limit. */
const CONCURRENCY = 6;
const CHUNK_SIZE = 60;
/** A chunk with more failures than this is treated as an API outage, not as broken pages. */
const MAX_FAILURE_RATIO = 0.5;

export interface PageIssueRefreshResult {
  domain: string;
  processed: number;
  pending: number;
}

type WebsiteRef = Pick<ConductorWebsite, "id" | "conductorId" | "domain" | "lastSyncAt">;

function pendingWhere(website: WebsiteRef): Prisma.ConductorPageWhereInput {
  return {
    websiteId: website.id,
    type: "page",
    OR: [
      { issuesSyncedAt: null },
      ...(website.lastSyncAt ? [{ issuesSyncedAt: { lt: website.lastSyncAt } }] : []),
    ],
  };
}

export function countPendingPageIssues(website: WebsiteRef): Promise<number> {
  return prisma.conductorPage.count({ where: pendingWhere(website) });
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

/** Runs `fn` over `items` with at most `limit` calls in flight, preserving order. */
async function mapConcurrent<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Issue names of the page; [] if Conductor no longer knows the URL, null on other errors. */
async function fetchOpenIssues(conductorId: string, url: string): Promise<string[] | null> {
  try {
    const detail = await getPageDetail(conductorId, url);
    return [...new Set((detail.data.open_issues ?? []).map((issue) => issue.name))].sort();
  } catch (error) {
    if (error instanceof ConductorApiError && error.status === 404) return [];
    console.warn(`[Conductor Page Issues] ${url}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Refreshes the issue lists of one website until nothing is pending or `deadline` (epoch ms)
 * is reached. Pages that fail are still stamped, so they move to the back of the queue.
 */
export async function refreshPageIssues(website: WebsiteRef, deadline: number): Promise<PageIssueRefreshResult> {
  let processed = 0;

  while (Date.now() < deadline) {
    const pages = await prisma.conductorPage.findMany({
      where: pendingWhere(website),
      select: { id: true, url: true },
      orderBy: [{ issuesSyncedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
      take: CHUNK_SIZE,
    });
    if (pages.length === 0) break;

    const issues = await mapConcurrent(pages, CONCURRENCY, (page) =>
      fetchOpenIssues(website.conductorId, page.url)
    );
    const failed = pages.filter((_, i) => issues[i] === null);
    if (failed.length > pages.length * MAX_FAILURE_RATIO) {
      throw new Error(
        `Conductor page detail failed for ${failed.length} of ${pages.length} pages of ${website.domain}`
      );
    }

    const now = new Date();
    const updates = pages.flatMap((page, i) => {
      const names = issues[i];
      return names === null ? [] : [Prisma.sql`(${page.id}::text, ${names}::text[])`];
    });
    if (updates.length > 0) {
      await prisma.$executeRaw`
        UPDATE "ConductorPage" AS p
        SET "openIssues" = v.issues, "issuesSyncedAt" = ${now}
        FROM (VALUES ${Prisma.join(updates)}) AS v(id, issues)
        WHERE p."id" = v.id
      `;
    }
    if (failed.length > 0) {
      await prisma.conductorPage.updateMany({
        where: { id: { in: failed.map((p) => p.id) } },
        data: { issuesSyncedAt: now },
      });
    }
    processed += pages.length;
  }

  return { domain: website.domain, processed, pending: await countPendingPageIssues(website) };
}

/**
 * Cron entry point: refreshes all synced websites, smallest backlog first, so small
 * websites are complete quickly while large ones progress over several runs.
 */
export async function refreshDuePageIssues(deadline: number): Promise<PageIssueRefreshResult[]> {
  const websites = await prisma.conductorWebsite.findMany({
    where: { lastSyncAt: { not: null } },
    select: { id: true, conductorId: true, domain: true, lastSyncAt: true },
  });
  const backlog = await Promise.all(
    websites.map(async (website) => ({ website, pending: await countPendingPageIssues(website) }))
  );
  const due = backlog.filter((b) => b.pending > 0).sort((a, b) => a.pending - b.pending);

  const results: PageIssueRefreshResult[] = [];
  for (const { website } of due) {
    if (Date.now() >= deadline) break;
    try {
      results.push(await refreshPageIssues(website, deadline));
    } catch (error) {
      console.error(`[Conductor Page Issues] Failed for ${website.domain}:`, error);
    }
  }
  return results;
}
