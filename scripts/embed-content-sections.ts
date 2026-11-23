/**
 * Content-Mapping: Embeddings für alle noch nicht eingebetteten Abschnitte erzeugen.
 *
 * Grundlage für den Abgleich der Topic-Gaps mit anderen URLs. Neu gecrawlte Seiten werden
 * automatisch eingebettet; das Skript holt den Bestand nach.
 *
 * Nutzung:
 *   npx tsx scripts/embed-content-sections.ts --dry-run
 *   npm run embed-content -- --yes
 *   npx tsx scripts/embed-content-sections.ts --yes --limit 5000
 */

import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { countPendingSections, embedPendingSections } from "../src/lib/content-mapping/embeddings";

const CHUNK_SIZE = 500;

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
  const limit = intArg("limit", Number.MAX_SAFE_INTEGER);

  const pending = await countPendingSections();
  const planned = Math.min(pending, limit);
  console.log(`${pending} Abschnitte ohne Embedding, geplant: ${planned}`);
  if (dryRun || planned === 0) return;
  if (!confirmed) {
    console.log("Mit --yes starten.");
    return;
  }

  let processed = 0;
  while (processed < planned) {
    const n = await embedPendingSections({ limit: Math.min(CHUNK_SIZE, planned - processed) });
    if (n === 0) break;
    processed += n;
    console.log(`[${processed}/${planned}] eingebettet`);
  }

  console.log(`Fertig: ${processed} Abschnitte eingebettet.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
