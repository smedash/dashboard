/**
 * Topic-Gaps nachträglich mit anderen URLs aus dem Content-Mapping abgleichen.
 *
 * Nutzt denselben Ablauf wie der Button „Abgleich“ im URL-Drawer. Berücksichtigt wird pro URL
 * nur die neueste Analyse (die der Drawer anzeigt), und nur wenn sie erfolgreich ist, offene
 * Topics hat und noch keinen Abgleich besitzt. Fehlgeschlagene Abgleiche werden wiederholt.
 *
 * Startet nicht, solange noch Abschnitte ohne Embedding vorhanden sind (npm run embed-content),
 * da der Abgleich sonst nur einen Teil der Seiten findet.
 *
 * Nutzung:
 *   npx tsx scripts/batch-cross-coverage.ts --dry-run
 *   npm run batch-cross-coverage -- --yes
 *   npx tsx scripts/batch-cross-coverage.ts --yes --project "Hypotheken"
 *   npx tsx scripts/batch-cross-coverage.ts --yes --url "beispiel.ch/ratgeber"
 *   npx tsx scripts/batch-cross-coverage.ts --yes --limit 10 --concurrency 2
 *   npx tsx scripts/batch-cross-coverage.ts --yes --force
 *   npx tsx scripts/batch-cross-coverage.ts --yes --allow-pending-embeddings
 */

import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { countPendingSections } from "../src/lib/content-mapping/embeddings";
import { runCrossCoverage } from "../src/lib/keyword-map/cross-coverage";
import type { TopicGapItem } from "../src/lib/keyword-map/shared";

const DEFAULT_CONCURRENCY = 2;
const MAX_CONCURRENCY = 6;

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
const allowPending = args.includes("--allow-pending-embeddings");
const projectFilter = getArg("project");
const urlFilter = getArg("url");
const limit = getArg("limit") ? intArg("limit", 0) : undefined;
const concurrency = Math.min(intArg("concurrency", DEFAULT_CONCURRENCY), MAX_CONCURRENCY);

interface WorkItem {
  gapId: string;
  url: string;
  projectName: string;
  focusKeyword: string;
  openTopics: number;
  hadError: boolean;
}

async function loadWork(): Promise<{ items: WorkItem[]; latest: number; skippedDone: number; skippedNoOpen: number }> {
  const rows = await prisma.$queryRaw<
    Array<{ gapId: string; url: string; projectName: string; focusKeyword: string; results: unknown; crossCoverageError: string | null }>
  >`
    SELECT * FROM (
      SELECT DISTINCT ON (g."urlId")
        g."id" AS "gapId", u."url", p."name" AS "projectName", g."focusKeyword", g."status", g."results", g."crossCoverageError"
      FROM "KeywordMapTopicGap" g
      JOIN "KeywordMapUrl" u ON u."id" = g."urlId"
      JOIN "KeywordMapProject" p ON p."id" = u."projectId"
      ORDER BY g."urlId", g."createdAt" DESC
    ) latest
    WHERE latest."status" = 'succeeded'
    ORDER BY latest."projectName", latest."url"
  `;

  const project = projectFilter?.toLowerCase();
  const urlPart = urlFilter?.toLowerCase();
  let skippedDone = 0;
  let skippedNoOpen = 0;
  const items: WorkItem[] = [];
  for (const row of rows) {
    if (project && !row.projectName.toLowerCase().includes(project)) continue;
    if (urlPart && !row.url.toLowerCase().includes(urlPart)) continue;
    const results = Array.isArray(row.results) ? (row.results as TopicGapItem[]) : [];
    const openTopics = results.filter((i) => i.status !== "covered").length;
    if (openTopics === 0) {
      skippedNoOpen++;
      continue;
    }
    const checked = results.some((i) => i.otherUrls !== undefined);
    const hadError = row.crossCoverageError !== null;
    if (checked && !hadError && !force) {
      skippedDone++;
      continue;
    }
    items.push({ gapId: row.gapId, url: row.url, projectName: row.projectName, focusKeyword: row.focusKeyword, openTopics, hadError });
  }
  return { items, latest: rows.length, skippedDone, skippedNoOpen };
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

  console.log("Keyword-Mapping: Topic-Gaps mit dem Content-Mapping abgleichen\n");
  const pending = await countPendingSections();
  const { items: all, latest, skippedDone, skippedNoOpen } = await loadWork();
  const items = limit ? all.slice(0, limit) : all;

  console.log(`Abschnitte ohne Embedding: ${pending}`);
  console.log(`Erfolgreiche Analysen (neueste je URL): ${latest}`);
  console.log(`Ohne offene Topics übersprungen: ${skippedNoOpen}`);
  console.log(`Bereits abgeglichen übersprungen: ${skippedDone}${skippedDone ? "  (--force wiederholt sie)" : ""}`);
  console.log(`Abzugleichen: ${items.length}${limit ? ` (Limit ${limit}, weitere ${all.length - items.length} nicht enthalten)` : ""}`);
  console.log(`  davon nach Fehler wiederholt: ${items.filter((i) => i.hadError).length}`);
  console.log(`Offene Topics gesamt: ${items.reduce((sum, i) => sum + i.openTopics, 0)}`);

  if (items.length === 0) {
    console.log("\nNichts zu tun.");
    return;
  }

  console.log("");
  const byProject = new Map<string, number>();
  for (const item of items) byProject.set(item.projectName, (byProject.get(item.projectName) ?? 0) + 1);
  for (const [name, count] of byProject) console.log(`  ${name}: ${count}`);

  if (dryRun || !confirmed) {
    console.log(dryRun ? "\nDry-Run. Es wurde kein Abgleich gestartet." : "\nKein Abgleich gestartet. Zum Ausführen --yes anhängen.");
    return;
  }
  if (pending > 0 && !allowPending) {
    throw new Error(
      `${pending} Abschnitte haben noch kein Embedding. Erst npm run embed-content -- --yes abschliessen oder mit --allow-pending-embeddings trotzdem starten.`,
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY fehlt");

  const started = Date.now();
  const counts = { succeeded: 0, failed: 0 };
  await mapPool(items, concurrency, async (item, index) => {
    const prefix = `[${index + 1}/${items.length}] ${item.projectName}  ${item.url}`;
    try {
      await runCrossCoverage(item.gapId);
      const gap = await prisma.keywordMapTopicGap.findUnique({ where: { id: item.gapId }, select: { results: true, crossCoverageError: true } });
      if (gap?.crossCoverageError) {
        counts.failed++;
        console.log(`${prefix}  FEHLER: ${gap.crossCoverageError}`);
        return;
      }
      const results = Array.isArray(gap?.results) ? (gap.results as unknown as TopicGapItem[]) : [];
      const elsewhere = results.filter((i) => i.status !== "covered" && (i.otherUrls?.length ?? 0) > 0).length;
      counts.succeeded++;
      console.log(`${prefix}  ${elsewhere}/${item.openTopics} offene Topics anderswo abgedeckt`);
    } catch (e) {
      counts.failed++;
      console.error(`${prefix}  FEHLER: ${e instanceof Error ? e.message : "Abgleich fehlgeschlagen"}`);
    }
  });

  const minutes = Math.max(1, Math.round((Date.now() - started) / 60_000));
  console.log(`\nFertig in ${minutes} Min.`);
  console.log(`  erfolgreich: ${counts.succeeded}`);
  console.log(`  fehlgeschlagen: ${counts.failed}${counts.failed ? "  (ein erneuter Lauf wiederholt sie)" : ""}`);
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
