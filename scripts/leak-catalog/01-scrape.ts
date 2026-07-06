/**
 * Phase 1: Scrape Google Content Warehouse API Leak from HexDocs v0.4.0
 *
 * Downloads the full API reference page and all individual module pages.
 * Rate-limited to 1 request per second to be respectful.
 *
 * Usage:
 *   npx tsx scripts/leak-catalog/01-scrape.ts
 *   npx tsx scripts/leak-catalog/01-scrape.ts --resume  (skip already downloaded)
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";

const BASE_URL = "https://google-api-content-warehouse.hexdocs.pm/0.4.0";
const API_REF_URL = `${BASE_URL}/api-reference.html`;
const RAW_DIR = join(process.cwd(), "data/leak-raw");
const CATALOG_DIR = join(process.cwd(), "data/leak-catalog");
const DELAY_MS = 1200;
const MAX_RETRIES = 3;

const resume = process.argv.includes("--resume");

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SEO-Catalog-Builder/1.0)",
          Accept: "text/html",
        },
      });
      if (!res.ok) {
        if (res.status === 429) {
          console.log(`  Rate limited, waiting 10s...`);
          await sleep(10000);
          continue;
        }
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return await res.text();
    } catch (err) {
      if (i < retries - 1) {
        console.log(`  Retry ${i + 1}/${retries} for ${url}`);
        await sleep(3000 * (i + 1));
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
}

function extractModuleLinks(html: string): { name: string; url: string }[] {
  const modules: { name: string; url: string }[] = [];
  const regex = /href="([^"]+\.html)"[^>]*>\s*(GoogleApi\.ContentWarehouse\.V1\.Model\.\w+)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const relUrl = match[1];
    const name = match[2];
    const fullUrl = relUrl.startsWith("http") ? relUrl : `${BASE_URL}/${relUrl}`;
    modules.push({ name, url: fullUrl });
  }

  if (modules.length === 0) {
    const fallbackRegex = /GoogleApi\.ContentWarehouse\.V1\.Model\.(\w+)/g;
    let fm;
    while ((fm = fallbackRegex.exec(html)) !== null) {
      const shortName = fm[1];
      const fullName = `GoogleApi.ContentWarehouse.V1.Model.${shortName}`;
      if (!modules.find((m) => m.name === fullName)) {
        modules.push({
          name: fullName,
          url: `${BASE_URL}/GoogleApi.ContentWarehouse.V1.Model.${shortName}.html`,
        });
      }
    }
  }

  const unique = [...new Map(modules.map((m) => [m.name, m])).values()];
  return unique;
}

async function main() {
  ensureDir(RAW_DIR);
  ensureDir(CATALOG_DIR);

  console.log("=== Phase 1: Scraping HexDocs v0.4.0 ===\n");

  // Step 1: Fetch the API reference index
  const indexPath = join(RAW_DIR, "_api-reference.html");
  let indexHtml: string;

  if (resume && existsSync(indexPath)) {
    console.log("Loading cached API reference index...");
    indexHtml = readFileSync(indexPath, "utf-8");
  } else {
    console.log(`Fetching API reference index: ${API_REF_URL}`);
    indexHtml = await fetchWithRetry(API_REF_URL);
    writeFileSync(indexPath, indexHtml, "utf-8");
    console.log(`  Saved (${(indexHtml.length / 1024).toFixed(0)} KB)`);
  }

  // Step 2: Extract module links
  const modules = extractModuleLinks(indexHtml);
  console.log(`\nFound ${modules.length} modules\n`);

  // Save module index
  writeFileSync(
    join(CATALOG_DIR, "module-index.json"),
    JSON.stringify(modules, null, 2),
    "utf-8"
  );

  // Step 3: Fetch each module page
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const failures: string[] = [];

  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i];
    const filename = mod.name.replace(/\./g, "_") + ".html";
    const filepath = join(RAW_DIR, filename);

    if (resume && existsSync(filepath)) {
      skipped++;
      continue;
    }

    const progress = `[${i + 1}/${modules.length}]`;
    process.stdout.write(`${progress} ${mod.name}...`);

    try {
      const html = await fetchWithRetry(mod.url);
      writeFileSync(filepath, html, "utf-8");
      downloaded++;
      console.log(` OK (${(html.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      failed++;
      failures.push(mod.name);
      console.log(` FAILED: ${(err as Error).message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n=== Scraping Complete ===`);
  console.log(`  Downloaded: ${downloaded}`);
  console.log(`  Skipped (cached): ${skipped}`);
  console.log(`  Failed: ${failed}`);

  if (failures.length > 0) {
    writeFileSync(
      join(CATALOG_DIR, "scrape-failures.json"),
      JSON.stringify(failures, null, 2),
      "utf-8"
    );
    console.log(`  Failures saved to data/leak-catalog/scrape-failures.json`);
  }

  // Also parse the single-page reference as fallback (contains summaries)
  console.log(`\nAPI reference index saved as fallback for parsing.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
