/**
 * Content-Mapping: alle URLs aus dem Cleanup-Inventar crawlen und den Inhalt speichern.
 *
 * Gleicher Ablauf wie „Crawl starten“ im SEO-Helper Content Mapping, aber ohne Zeitlimit.
 * Bereits gecrawlte URLs werden übersprungen, fehlgeschlagene einmal pro Lauf erneut versucht.
 *
 * Nutzung:
 *   npx tsx scripts/crawl-content.ts --dry-run
 *   npm run crawl-content -- --yes
 *   npx tsx scripts/crawl-content.ts --yes --force
 *   npx tsx scripts/crawl-content.ts --yes --country ch --language de --section ratgeber
 *   npx tsx scripts/crawl-content.ts --yes --url "beispiel.ch/ratgeber" --limit 20 --concurrency 4
 */

import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { countPending, crawlContentBatch, type CrawlScope } from "../src/lib/content-mapping/crawl";

const CHUNK_SIZE = 100;
const DEFAULT_CONCURRENCY = 5;

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

async function main() {
  const dryRun = args.includes("--dry-run");
  const confirmed = args.includes("--yes");
  const force = args.includes("--force");
  const concurrency = intArg("concurrency", DEFAULT_CONCURRENCY);
  const limit = intArg("limit", Number.MAX_SAFE_INTEGER);
  const scope: CrawlScope = {
    q: getArg("url"),
    country: getArg("country"),
    language: getArg("language"),
    section: getArg("section"),
  };
  const startedAt = new Date();

  const pending = await countPending({ force, startedAt, scope });
  const planned = Math.min(pending, limit);
  console.log(`${pending} offene URLs${force ? " (--force: alle neu)" : ""}, geplant: ${planned}`);
  if (dryRun || planned === 0) return;
  if (!confirmed) {
    console.log("Mit --yes starten.");
    return;
  }

  const totals = { succeeded: 0, failed: 0, skipped: 0 };
  let processed = 0;
  while (processed < planned) {
    const step = await crawlContentBatch({
      force,
      startedAt,
      scope,
      concurrency,
      limit: Math.min(CHUNK_SIZE, planned - processed),
      onResult: (r) => {
        const n = processed + 1;
        processed = n;
        const suffix = r.error ? ` – ${r.error}` : "";
        console.log(`[${n}/${planned}] ${r.outcome.padEnd(9)} ${r.url}${suffix}`);
      },
    });
    totals.succeeded += step.succeeded;
    totals.failed += step.failed;
    totals.skipped += step.skipped;
    if (step.done || step.processed === 0) break;
  }

  console.log(`Fertig: ${totals.succeeded} gecrawlt, ${totals.failed} fehlgeschlagen, ${totals.skipped} übersprungen.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
