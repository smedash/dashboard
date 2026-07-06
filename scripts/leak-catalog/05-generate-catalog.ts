/**
 * Phase 5: Generate final SEO audit catalog
 *
 * Combines classified modules into the final catalog.json format
 * that can be consumed by the URL Checker rule engine.
 *
 * Usage:
 *   npx tsx scripts/leak-catalog/05-generate-catalog.ts
 *   npx tsx scripts/leak-catalog/05-generate-catalog.ts --include-not-measurable
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const CATALOG_DIR = join(process.cwd(), "data/leak-catalog");
const OUTPUT_DIR = join(process.cwd(), "src/lib/url-checker");
const CLASSIFIED_PATH = join(CATALOG_DIR, "classified-modules.json");
const INCLUDE_NOT_MEASURABLE = process.argv.includes("--include-not-measurable");

interface ClassifiedAttribute {
  name: string;
  type?: string;
  description?: string;
  measurability: "direct" | "heuristic" | "external_api" | "not_measurable";
  dataSource: string;
  impactEstimate: "critical" | "high" | "medium" | "low" | "unknown";
  category: string;
  checkDescription: string;
  ruleSuggestion: string;
}

interface ClassifiedModule {
  fullName: string;
  shortName: string;
  namespace: string;
  description: string;
  attributes: ClassifiedAttribute[];
}

interface CatalogEntry {
  id: string;
  module: string;
  attribute: string;
  measurability: "direct" | "heuristic" | "external_api" | "not_measurable";
  dataSource: string;
  impact: "critical" | "high" | "medium" | "low" | "unknown";
  category: string;
  rule?: {
    field: string;
    operator: string;
    thresholds?: { pass: unknown; warn: unknown; fail: unknown };
  };
  aiPrompt?: string;
  originalDescription: string;
  checkDescription: string;
  recommendation: string;
  leakModule: string;
  leakAttribute: string;
}

function generateId(moduleName: string, attrName: string): string {
  const modPart = moduleName
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "")
    .replace(/__+/g, "_");
  return `${modPart}.${attrName}`;
}

function parseRuleSuggestion(suggestion: string, attrName: string): CatalogEntry["rule"] | undefined {
  if (!suggestion || suggestion.trim() === "" || suggestion === "-") return undefined;

  // Try to extract structured rule from the suggestion text
  const field = attrName;
  let operator = "exists";

  if (suggestion.includes(">=") || suggestion.includes("mindestens") || suggestion.includes("mehr als")) {
    operator = "gte";
  } else if (suggestion.includes("<=") || suggestion.includes("maximal") || suggestion.includes("weniger als")) {
    operator = "lte";
  } else if (suggestion.includes("vorhanden") || suggestion.includes("existiert") || suggestion.includes("pruefen ob")) {
    operator = "exists";
  } else if (suggestion.includes("enthaelt") || suggestion.includes("beinhaltet")) {
    operator = "contains";
  } else if (suggestion.includes("regex") || suggestion.includes("Muster")) {
    operator = "regex";
  }

  return { field, operator };
}

function generateRecommendation(attr: ClassifiedAttribute): string {
  if (attr.measurability === "not_measurable") {
    return `Dieses Attribut (${attr.name}) ist ein Google-internes Signal. ${attr.checkDescription}`;
  }

  const prefix = attr.impactEstimate === "critical"
    ? "KRITISCH: "
    : attr.impactEstimate === "high"
    ? "WICHTIG: "
    : "";

  return `${prefix}${attr.checkDescription}${attr.ruleSuggestion ? ` Empfehlung: ${attr.ruleSuggestion}` : ""}`;
}

async function main() {
  console.log("=== Phase 5: Generate Final Catalog ===\n");

  if (!existsSync(CLASSIFIED_PATH)) {
    console.error(`Classified modules not found: ${CLASSIFIED_PATH}`);
    console.error("Run 04-classify.ts first.");
    process.exit(1);
  }

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const classifiedModules: ClassifiedModule[] = JSON.parse(
    readFileSync(CLASSIFIED_PATH, "utf-8")
  );

  console.log(`Loaded ${classifiedModules.length} classified modules`);

  const catalog: CatalogEntry[] = [];

  for (const mod of classifiedModules) {
    for (const attr of mod.attributes) {
      // Skip not_measurable unless explicitly included
      if (attr.measurability === "not_measurable" && !INCLUDE_NOT_MEASURABLE) continue;

      const entry: CatalogEntry = {
        id: generateId(mod.shortName, attr.name),
        module: mod.shortName,
        attribute: attr.name,
        measurability: attr.measurability,
        dataSource: attr.dataSource,
        impact: attr.impactEstimate,
        category: attr.category,
        originalDescription: attr.description || "",
        checkDescription: attr.checkDescription || "",
        recommendation: generateRecommendation(attr),
        leakModule: mod.fullName,
        leakAttribute: `${mod.shortName}.${attr.name}`,
      };

      // Add rule for direct checks
      if (attr.measurability === "direct" && attr.ruleSuggestion) {
        entry.rule = parseRuleSuggestion(attr.ruleSuggestion, attr.name);
      }

      // Add AI prompt for heuristic checks
      if (attr.measurability === "heuristic") {
        entry.aiPrompt = `Bewerte das folgende Attribut fuer die analysierte Seite: "${attr.checkDescription}" (Leak-Referenz: ${mod.shortName}.${attr.name}). Antworte mit pass/warn/fail und einer kurzen Begruendung.`;
      }

      catalog.push(entry);
    }
  }

  // Sort by impact (critical first) then by category
  const impactOrder = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };
  catalog.sort((a, b) => {
    const impactDiff = (impactOrder[a.impact] || 4) - (impactOrder[b.impact] || 4);
    if (impactDiff !== 0) return impactDiff;
    return a.category.localeCompare(b.category);
  });

  // Generate category index
  const categories = new Map<string, { count: number; direct: number; heuristic: number; external: number }>();
  for (const entry of catalog) {
    const cat = categories.get(entry.category) || { count: 0, direct: 0, heuristic: 0, external: 0 };
    cat.count++;
    if (entry.measurability === "direct") cat.direct++;
    else if (entry.measurability === "heuristic") cat.heuristic++;
    else if (entry.measurability === "external_api") cat.external++;
    categories.set(entry.category, cat);
  }

  // Stats
  console.log(`\n=== Catalog Generated ===`);
  console.log(`  Total entries: ${catalog.length}`);
  console.log(`  Direct checks: ${catalog.filter((e) => e.measurability === "direct").length}`);
  console.log(`  Heuristic checks: ${catalog.filter((e) => e.measurability === "heuristic").length}`);
  console.log(`  External API checks: ${catalog.filter((e) => e.measurability === "external_api").length}`);
  if (INCLUDE_NOT_MEASURABLE) {
    console.log(`  Not measurable (info only): ${catalog.filter((e) => e.measurability === "not_measurable").length}`);
  }

  console.log(`\n  By impact:`);
  console.log(`    Critical: ${catalog.filter((e) => e.impact === "critical").length}`);
  console.log(`    High:     ${catalog.filter((e) => e.impact === "high").length}`);
  console.log(`    Medium:   ${catalog.filter((e) => e.impact === "medium").length}`);
  console.log(`    Low:      ${catalog.filter((e) => e.impact === "low").length}`);

  console.log(`\n  By category:`);
  const sortedCats = [...categories.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [cat, stats] of sortedCats) {
    console.log(`    ${cat}: ${stats.count} (direct: ${stats.direct}, heuristic: ${stats.heuristic}, external: ${stats.external})`);
  }

  // Save catalog
  const catalogPath = join(OUTPUT_DIR, "catalog.json");
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf-8");
  console.log(`\n  Catalog saved: ${catalogPath}`);
  console.log(`  File size: ${(JSON.stringify(catalog).length / 1024 / 1024).toFixed(2)} MB`);

  // Also save a lightweight category index
  const categoryIndex = Object.fromEntries(
    sortedCats.map(([cat, stats]) => [cat, stats])
  );
  writeFileSync(
    join(OUTPUT_DIR, "catalog-index.json"),
    JSON.stringify({ totalEntries: catalog.length, categories: categoryIndex, generatedAt: new Date().toISOString() }, null, 2),
    "utf-8"
  );
  console.log(`  Index saved: ${join(OUTPUT_DIR, "catalog-index.json")}`);

  // Save full catalog to data dir as well (for analysis)
  writeFileSync(
    join(CATALOG_DIR, "final-catalog.json"),
    JSON.stringify(catalog, null, 2),
    "utf-8"
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
