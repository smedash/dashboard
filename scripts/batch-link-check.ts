/**
 * Prüft für abgeglichene Topic-Gaps, ob die Mapping-URL bereits intern auf die URLs verlinkt,
 * die offene Topics anderswo abdecken.
 *
 * Nutzt denselben Ablauf wie der Button „Links prüfen“ im URL-Drawer. Berücksichtigt wird pro URL
 * nur die neueste Analyse, und nur wenn sie erfolgreich ist, anderswo abgedeckte Topics hat und
 * noch nicht geprüft wurde. Fehlgeschlagene Prüfungen werden wiederholt. Keine KI-Aufrufe.
 *
 * Nutzung:
 *   npx tsx scripts/batch-link-check.ts --dry-run
 *   npm run batch-link-check -- --yes
 *   npx tsx scripts/batch-link-check.ts --yes --project "Hypotheken"
 *   npx tsx scripts/batch-link-check.ts --yes --url "beispiel.ch/ratgeber"
 *   npx tsx scripts/batch-link-check.ts --yes --limit 10 --concurrency 4
 *   npx tsx scripts/batch-link-check.ts --yes --force
 */

import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { runLinkCheck } from "../src/lib/keyword-map/internal-links";
import type { TopicGapItem, TopicOtherUrl } from "../src/lib/keyword-map/shared";

const DEFAULT_CONCURRENCY = 4;
const MAX_CONCURRENCY = 10;

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
const projectFilter = getArg("project");
const urlFilter = getArg("url");
const limit = getArg("limit") ? intArg("limit", 0) : undefined;
const concurrency = Math.min(intArg("concurrency", DEFAULT_CONCURRENCY), MAX_CONCURRENCY);

interface WorkItem {
  gapId: string;
  url: string;
  projectName: string;
  targets: number;
  hadError: boolean;
}

/** Anderswo abdeckende URLs der offenen Topics, je Inventar-URL einmal. */
function linkTargets(results: TopicGapItem[]): TopicOtherUrl[] {
  const byId = new Map<string, TopicOtherUrl>();
  for (const item of results) {
    if (item.status === "covered") continue;
    for (const u of item.otherUrls ?? []) byId.set(u.inventoryId, u);
  }
  return [...byId.values()];
}

async function loadWork(): Promise<{ items: WorkItem[]; latest: number; skippedDone: number; skippedNoTargets: number }> {
  const rows = await prisma.$queryRaw<
    Array<{ gapId: string; url: string; projectName: string; results: unknown; linksCheckedAt: Date | null; linkCheckError: string | null }>
  >`
    SELECT * FROM (
      SELECT DISTINCT ON (g."urlId")
        g."id" AS "gapId", u."url", p."name" AS "projectName", g."status", g."results", g."linksCheckedAt", g."linkCheckError"
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
  let skippedNoTargets = 0;
  const items: WorkItem[] = [];
  for (const row of rows) {
    if (project && !row.projectName.toLowerCase().includes(project)) continue;
    if (urlPart && !row.url.toLowerCase().includes(urlPart)) continue;
    const results = Array.isArray(row.results) ? (row.results as TopicGapItem[]) : [];
    const targets = linkTargets(results).length;
    if (targets === 0) {
      skippedNoTargets++;
      continue;
    }
    const hadError = row.linkCheckError !== null;
    if (row.linksCheckedAt && !hadError && !force) {
      skippedDone++;
      continue;
    }
    items.push({ gapId: row.gapId, url: row.url, projectName: row.projectName, targets, hadError });
  }
  return { items, latest: rows.length, skippedDone, skippedNoTargets };
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

  console.log("Keyword-Mapping: interne Links zu anderswo abdeckenden URLs prüfen\n");
  const { items: all, latest, skippedDone, skippedNoTargets } = await loadWork();
  const items = limit ? all.slice(0, limit) : all;

  console.log(`Erfolgreiche Analysen (neueste je URL): ${latest}`);
  console.log(`Ohne anderswo abgedeckte Topics übersprungen: ${skippedNoTargets}`);
  console.log(`Bereits geprüft übersprungen: ${skippedDone}${skippedDone ? "  (--force wiederholt sie)" : ""}`);
  console.log(`Zu prüfen: ${items.length}${limit ? ` (Limit ${limit}, weitere ${all.length - items.length} nicht enthalten)` : ""}`);
  console.log(`  davon nach Fehler wiederholt: ${items.filter((i) => i.hadError).length}`);

  if (items.length === 0) {
    console.log("\nNichts zu tun.");
    return;
  }

  console.log("");
  const byProject = new Map<string, number>();
  for (const item of items) byProject.set(item.projectName, (byProject.get(item.projectName) ?? 0) + 1);
  for (const [name, count] of byProject) console.log(`  ${name}: ${count}`);

  if (dryRun || !confirmed) {
    console.log(dryRun ? "\nDry-Run. Es wurde keine Prüfung gestartet." : "\nKeine Prüfung gestartet. Zum Ausführen --yes anhängen.");
    return;
  }

  const started = Date.now();
  const counts = { succeeded: 0, failed: 0, targets: 0, missing: 0 };
  await mapPool(items, concurrency, async (item, index) => {
    const prefix = `[${index + 1}/${items.length}] ${item.projectName}  ${item.url}`;
    try {
      await runLinkCheck(item.gapId);
      const gap = await prisma.keywordMapTopicGap.findUnique({ where: { id: item.gapId }, select: { results: true, linkCheckError: true } });
      if (gap?.linkCheckError) {
        counts.failed++;
        console.log(`${prefix}  FEHLER: ${gap.linkCheckError}`);
        return;
      }
      const targets = linkTargets(Array.isArray(gap?.results) ? (gap.results as unknown as TopicGapItem[]) : []);
      const linked = targets.filter((u) => u.link?.inContent).length;
      const navOnly = targets.filter((u) => u.link && !u.link.inContent).length;
      counts.succeeded++;
      counts.targets += targets.length;
      counts.missing += targets.length - linked;
      console.log(
        `${prefix}  ${linked}/${targets.length} abdeckende URLs im Content verlinkt, ${targets.length - linked} fehlen${navOnly ? ` (davon ${navOnly} nur Navigation)` : ""}`
      );
    } catch (e) {
      counts.failed++;
      console.error(`${prefix}  FEHLER: ${e instanceof Error ? e.message : "Linkprüfung fehlgeschlagen"}`);
    }
  });

  const minutes = Math.max(1, Math.round((Date.now() - started) / 60_000));
  console.log(`\nFertig in ${minutes} Min.`);
  console.log(`  erfolgreich: ${counts.succeeded}`);
  console.log(`  fehlgeschlagen: ${counts.failed}${counts.failed ? "  (ein erneuter Lauf wiederholt sie)" : ""}`);
  console.log(`  fehlende Querverweise im Content: ${counts.missing} von ${counts.targets}`);
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
