import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildInventoryWhere } from "@/lib/url-cleanup/filters";
import { HtmlFetchError, loadHtml } from "./fetch";
import { extractContent } from "./extract";

const NON_HTML_EXTENSIONS = /\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|pptx?|mp4|mp3)(\?|#|$)/i;

export interface CrawlScope {
  q?: string;
  country?: string;
  language?: string;
  section?: string;
}

export interface CrawlRunOptions {
  /** Auch bereits gecrawlte URLs erneut laden. */
  force?: boolean;
  /** Beginn des Laufs. Alles, was ab hier gecrawlt wurde, gilt als erledigt (auch Fehler). */
  startedAt: Date;
  scope?: CrawlScope;
}

export type CrawlOutcome = "succeeded" | "failed" | "skipped";

export interface CrawlResult {
  inventoryId: string;
  url: string;
  outcome: CrawlOutcome;
  error: string | null;
}

export interface CrawlBatchStep {
  done: boolean;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  remaining: number;
  errors: Array<{ url: string; error: string }>;
}

function scopeWhere(scope: CrawlScope = {}): Prisma.UrlInventoryWhereInput {
  return buildInventoryWhere({ q: scope.q, country: scope.country, language: scope.language, section: scope.section });
}

export function pendingWhere(options: CrawlRunOptions): Prisma.UrlInventoryWhereInput {
  const notThisRun: Prisma.UrlContentWhereInput = {
    OR: [{ crawledAt: null }, { crawledAt: { lt: options.startedAt } }],
  };
  const content: Prisma.UrlInventoryWhereInput = options.force
    ? { OR: [{ content: { is: null } }, { content: { is: notThisRun } }] }
    : {
        OR: [
          { content: { is: null } },
          { content: { is: { AND: [{ status: { in: ["pending", "failed"] } }, notThisRun] } } },
        ],
      };
  return { AND: [scopeWhere(options.scope), content] };
}

export async function countPending(options: CrawlRunOptions): Promise<number> {
  return prisma.urlInventory.count({ where: pendingWhere(options) });
}

export async function contentStats(scope: CrawlScope = {}) {
  const where = scopeWhere(scope);
  const [total, grouped] = await Promise.all([
    prisma.urlInventory.count({ where }),
    prisma.urlContent.groupBy({ by: ["status"], where: { inventory: { is: where } }, _count: { _all: true } }),
  ]);
  const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count._all])) as Record<string, number>;
  const succeeded = byStatus.succeeded ?? 0;
  const failed = byStatus.failed ?? 0;
  const skipped = byStatus.skipped ?? 0;
  return { total, succeeded, failed, skipped, open: Math.max(0, total - succeeded - failed - skipped) };
}

/** Lädt eine Inventar-URL, extrahiert den Inhalt und speichert ihn samt Abschnitten. */
export async function crawlInventoryUrl(inventoryId: string, url: string): Promise<CrawlResult> {
  const crawledAt = new Date();

  if (NON_HTML_EXTENSIONS.test(url)) {
    await prisma.urlContent.upsert({
      where: { inventoryId },
      create: { inventoryId, status: "skipped", error: "Keine HTML-Seite", crawledAt },
      update: { status: "skipped", error: "Keine HTML-Seite", crawledAt },
    });
    return { inventoryId, url, outcome: "skipped", error: "Keine HTML-Seite" };
  }

  try {
    const loaded = await loadHtml(url, { logPrefix: "content-mapping" });
    const content = extractContent(loaded.html, loaded.finalUrl, loaded.status);
    const existing = await prisma.urlContent.findUnique({
      where: { inventoryId },
      select: { contentHash: true, status: true },
    });
    const unchanged = existing?.status === "succeeded" && existing.contentHash === content.contentHash;

    const data = {
      status: "succeeded",
      httpStatus: loaded.status,
      finalUrl: loaded.finalUrl,
      fetchedVia: loaded.fetchedVia,
      error: null,
      title: content.title,
      metaDescription: content.metaDescription,
      h1: content.h1,
      canonical: content.canonical,
      robots: content.robots,
      lang: content.lang,
      headings: content.headings as Prisma.InputJsonValue,
      text: content.text,
      wordCount: content.wordCount,
      sectionCount: content.sections.length,
      contentHash: content.contentHash,
      crawledAt,
    };
    const row = await prisma.urlContent.upsert({
      where: { inventoryId },
      create: { inventoryId, ...data },
      update: data,
      select: { id: true },
    });
    if (!unchanged) {
      await prisma.$transaction([
        prisma.urlContentSection.deleteMany({ where: { contentId: row.id } }),
        prisma.urlContentSection.createMany({
          data: content.sections.map((s) => ({ ...s, contentId: row.id })),
        }),
      ]);
    }
    return { inventoryId, url, outcome: "succeeded", error: null };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    const httpStatus = e instanceof HtmlFetchError ? e.status : null;
    await prisma.urlContent.upsert({
      where: { inventoryId },
      create: { inventoryId, status: "failed", error, httpStatus, crawledAt },
      update: { status: "failed", error, httpStatus, crawledAt },
    });
    return { inventoryId, url, outcome: "failed", error };
  }
}

/**
 * Crawlt offene URLs parallel. Nach `startDeadline` werden keine neuen URLs mehr begonnen,
 * damit ein API-Request innerhalb von `maxDuration` bleibt.
 */
export async function crawlContentBatch(
  options: CrawlRunOptions & {
    limit?: number;
    concurrency?: number;
    startDeadline?: number;
    onResult?: (result: CrawlResult) => void;
  }
): Promise<CrawlBatchStep> {
  const candidates = await prisma.urlInventory.findMany({
    where: pendingWhere(options),
    select: { id: true, url: true },
    orderBy: [{ gscImpressions: "desc" }, { id: "asc" }],
    take: options.limit ?? 50,
  });

  const results: CrawlResult[] = [];
  let next = 0;
  const worker = async () => {
    while (next < candidates.length) {
      if (options.startDeadline && Date.now() > options.startDeadline) return;
      const item = candidates[next++];
      const result = await crawlInventoryUrl(item.id, item.url);
      results.push(result);
      options.onResult?.(result);
    }
  };
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 5, 20));
  await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, worker));

  const remaining = await countPending(options);
  const count = (outcome: CrawlOutcome) => results.filter((r) => r.outcome === outcome).length;
  return {
    done: remaining === 0,
    processed: results.length,
    succeeded: count("succeeded"),
    failed: count("failed"),
    skipped: count("skipped"),
    remaining,
    errors: results
      .filter((r) => r.outcome === "failed" && r.error)
      .slice(0, 10)
      .map((r) => ({ url: r.url, error: r.error as string })),
  };
}
