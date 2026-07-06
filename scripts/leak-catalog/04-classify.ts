/**
 * Phase 4: AI Classification using Claude
 *
 * Sends relevant + uncertain modules to Claude in batches for classification.
 * Each attribute gets classified by measurability, impact, category, etc.
 *
 * Usage:
 *   npx tsx scripts/leak-catalog/04-classify.ts
 *   npx tsx scripts/leak-catalog/04-classify.ts --resume     (skip already classified)
 *   npx tsx scripts/leak-catalog/04-classify.ts --dry-run    (show what would be sent)
 *   npx tsx scripts/leak-catalog/04-classify.ts --batch-size 30
 */

import "dotenv/config";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import Anthropic from "@anthropic-ai/sdk";

const CATALOG_DIR = join(process.cwd(), "data/leak-catalog");
const OUTPUT_PATH = join(CATALOG_DIR, "classified-modules.json");
const PROGRESS_PATH = join(CATALOG_DIR, "classify-progress.json");

const BATCH_SIZE = parseInt(getArg("batch-size") || "30");
const DRY_RUN = process.argv.includes("--dry-run");
const RESUME = process.argv.includes("--resume");
const DELAY_BETWEEN_BATCHES_MS = 2000;

function getArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

interface RawAttribute {
  name: string;
  type: string;
  default: string;
  description: string;
  referencedTypes: string[];
}

interface RawModule {
  fullName: string;
  shortName: string;
  namespace: string;
  description: string;
  attributes: RawAttribute[];
  attributeCount: number;
}

interface ClassifiedAttribute {
  name: string;
  type: string;
  description: string;
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

const SYSTEM_PROMPT = `Du bist ein erfahrener SEO-Experte und Entwickler, der den Google Content Warehouse API Leak (2024) analysiert.

Deine Aufgabe: Klassifiziere die Attribute jedes Moduls nach folgenden Kriterien.

Fuer JEDES Attribut gib ein JSON-Objekt zurueck mit:

1. "measurability": Eines von:
   - "direct": Kann durch HTML-Fetch + HTTP-Header-Analyse direkt ermittelt werden (z.B. Title-Tag, Meta-Tags, Canonical, HTTP Status)
   - "heuristic": Kann durch KI-Analyse des Contents oder Pattern-Matching approximiert werden (z.B. Content-Qualitaet, E-E-A-T Signale, Topical Authority)
   - "external_api": Braucht externe Datenquellen wie PageSpeed API, Backlink-APIs, CrUX, SERP-Daten
   - "not_measurable": Nur Google-intern verfuegbar, kein externer Proxy moeglich (z.B. interne Scores, ML-Model-Outputs)

2. "dataSource": Woher kommen die Daten?
   - "html_content" | "http_headers" | "structured_data" | "dom_structure" | "css_js" | "external_api" | "ai_inference" | "link_graph" | "user_signals" | "none"

3. "impactEstimate": Geschaetzte SEO-Relevanz:
   - "critical": Direkt ranking-entscheidend (z.B. Title, Content-Qualitaet, Backlinks)
   - "high": Starker Einfluss (z.B. Page Speed, Mobile-Friendly, Schema)
   - "medium": Messbarer aber moderater Einfluss
   - "low": Geringer oder indirekter Einfluss
   - "unknown": Nicht sicher einschaetzbar

4. "category": Eine der folgenden Kategorien:
   "anchors_links" | "content_quality" | "technical_indexing" | "freshness" | "user_signals" | "entity_semantics" | "spam_safety" | "rendering" | "mobile" | "structured_data" | "local_geo" | "media" | "authority_trust" | "page_structure" | "internationalization"

5. "checkDescription": Ein Satz der beschreibt, was geprueft werden koennte (deutsch)

6. "ruleSuggestion": Fuer "direct" und "heuristic" Attribute: Wie koennte ein automatischer Check aussehen? Fuer "not_measurable": leer lassen.

WICHTIG:
- Sei realistisch bei measurability. Viele Attribute die intern klingen HABEN externe Proxies.
- Wenn ein Attribut "pagerank" oder "authority" heisst, ist es trotzdem "not_measurable" weil wir den echten Wert nicht kennen. Aber wir koennen Proxies nutzen (external_api via Backlink-Tools).
- Antworte NUR mit validem JSON. Kein Markdown, keine Erklaerungen ausserhalb des JSON.`;

function buildBatchPrompt(modules: RawModule[]): string {
  let prompt = "Klassifiziere die folgenden Module und ihre Attribute:\n\n";

  for (const mod of modules) {
    prompt += `### ${mod.shortName}\n`;
    if (mod.description) prompt += `Beschreibung: ${mod.description.substring(0, 200)}\n`;
    prompt += `Attribute:\n`;
    for (const attr of mod.attributes) {
      prompt += `- ${attr.name} (${attr.type}): ${attr.description.substring(0, 150)}\n`;
    }
    prompt += "\n";
  }

  prompt += `\nAntworte als JSON-Array mit folgendem Format:
[
  {
    "shortName": "ModuleName",
    "attributes": [
      {
        "name": "attributeName",
        "measurability": "direct|heuristic|external_api|not_measurable",
        "dataSource": "...",
        "impactEstimate": "critical|high|medium|low|unknown",
        "category": "...",
        "checkDescription": "...",
        "ruleSuggestion": "..."
      }
    ]
  }
]`;

  return prompt;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function classifyBatch(
  client: Anthropic,
  modules: RawModule[],
  batchIndex: number,
  totalBatches: number
): Promise<ClassifiedModule[]> {
  const prompt = buildBatchPrompt(modules);

  console.log(`  Batch ${batchIndex + 1}/${totalBatches}: ${modules.length} modules, ${modules.reduce((s, m) => s + m.attributeCount, 0)} attributes`);

  if (DRY_RUN) {
    console.log(`    [DRY RUN] Would send ${prompt.length} chars to Claude`);
    return [];
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16384,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("");

  // Extract JSON from response
  let jsonStr = text;
  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  } else {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) jsonStr = jsonMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr) as Array<{
      shortName: string;
      attributes: ClassifiedAttribute[];
    }>;

    return parsed.map((p) => {
      const originalMod = modules.find((m) => m.shortName === p.shortName);
      return {
        fullName: originalMod?.fullName || `GoogleApi.ContentWarehouse.V1.Model.${p.shortName}`,
        shortName: p.shortName,
        namespace: originalMod?.namespace || "",
        description: originalMod?.description || "",
        attributes: p.attributes || [],
      };
    });
  } catch (err) {
    console.error(`    Failed to parse JSON response for batch ${batchIndex + 1}`);
    console.error(`    Response preview: ${text.substring(0, 200)}...`);

    // Save failed response for debugging
    writeFileSync(
      join(CATALOG_DIR, `classify-error-batch-${batchIndex + 1}.txt`),
      text,
      "utf-8"
    );
    return [];
  }
}

async function main() {
  console.log("=== Phase 4: AI Classification with Claude ===\n");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set in environment. Add it to .env");
    process.exit(1);
  }

  // Load modules to classify
  const relevantPath = join(CATALOG_DIR, "relevant-modules.json");
  const uncertainPath = join(CATALOG_DIR, "uncertain-modules.json");

  if (!existsSync(relevantPath) || !existsSync(uncertainPath)) {
    console.error("Input files not found. Run 03-prefilter.ts first.");
    process.exit(1);
  }

  const relevant: RawModule[] = JSON.parse(readFileSync(relevantPath, "utf-8"));
  const uncertain: RawModule[] = JSON.parse(readFileSync(uncertainPath, "utf-8"));
  const allModules = [...relevant, ...uncertain];

  // Filter to modules that actually have attributes (skip empty ones)
  const modulesWithAttrs = allModules.filter((m) => m.attributeCount > 0);

  console.log(`Modules to classify: ${modulesWithAttrs.length} (of ${allModules.length} total)`);
  console.log(`Total attributes: ${modulesWithAttrs.reduce((s, m) => s + m.attributeCount, 0)}`);
  console.log(`Batch size: ${BATCH_SIZE} modules per request`);

  // Load progress if resuming
  let classified: ClassifiedModule[] = [];
  const classifiedNames = new Set<string>();

  if (RESUME && existsSync(PROGRESS_PATH)) {
    classified = JSON.parse(readFileSync(PROGRESS_PATH, "utf-8"));
    for (const c of classified) classifiedNames.add(c.shortName);
    console.log(`Resuming: ${classified.length} modules already classified`);
  }

  // Filter out already classified
  const remaining = modulesWithAttrs.filter((m) => !classifiedNames.has(m.shortName));
  console.log(`Remaining to classify: ${remaining.length}\n`);

  if (remaining.length === 0) {
    console.log("All modules already classified!");
    writeFileSync(OUTPUT_PATH, JSON.stringify(classified, null, 2), "utf-8");
    return;
  }

  // Create batches - by attribute count to keep prompt sizes manageable
  const MAX_ATTRS_PER_BATCH = 100;
  const batches: RawModule[][] = [];
  let currentBatch: RawModule[] = [];
  let currentAttrCount = 0;

  for (const mod of remaining) {
    if (currentAttrCount + mod.attributeCount > MAX_ATTRS_PER_BATCH && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentAttrCount = 0;
    }
    currentBatch.push(mod);
    currentAttrCount += mod.attributeCount;
  }
  if (currentBatch.length > 0) batches.push(currentBatch);

  console.log(`Created ${batches.length} batches\n`);

  if (DRY_RUN) {
    console.log("[DRY RUN MODE - No API calls will be made]\n");
    for (let i = 0; i < Math.min(3, batches.length); i++) {
      await classifyBatch(null as unknown as Anthropic, batches[i], i, batches.length);
    }
    console.log(`\n... and ${batches.length - 3} more batches`);
    return;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  for (let i = 0; i < batches.length; i++) {
    try {
      const result = await classifyBatch(client, batches[i], i, batches.length);
      classified.push(...result);

      // Save progress after each batch
      writeFileSync(PROGRESS_PATH, JSON.stringify(classified, null, 2), "utf-8");
      console.log(`    Progress saved (${classified.length} modules total)\n`);
    } catch (err) {
      console.error(`    Batch ${i + 1} failed: ${(err as Error).message}`);
      console.error(`    Saving progress and stopping...`);
      writeFileSync(PROGRESS_PATH, JSON.stringify(classified, null, 2), "utf-8");

      if ((err as Error).message.includes("rate_limit") || (err as Error).message.includes("429")) {
        console.log(`    Rate limited. Waiting 60s before retry...`);
        await sleep(60000);
        i--; // Retry this batch
        continue;
      }
      break;
    }

    if (i < batches.length - 1) {
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  // Save final output
  writeFileSync(OUTPUT_PATH, JSON.stringify(classified, null, 2), "utf-8");

  // Stats
  const allAttrs = classified.flatMap((m) => m.attributes);
  const byMeasurability = {
    direct: allAttrs.filter((a) => a.measurability === "direct").length,
    heuristic: allAttrs.filter((a) => a.measurability === "heuristic").length,
    external_api: allAttrs.filter((a) => a.measurability === "external_api").length,
    not_measurable: allAttrs.filter((a) => a.measurability === "not_measurable").length,
  };
  const byImpact = {
    critical: allAttrs.filter((a) => a.impactEstimate === "critical").length,
    high: allAttrs.filter((a) => a.impactEstimate === "high").length,
    medium: allAttrs.filter((a) => a.impactEstimate === "medium").length,
    low: allAttrs.filter((a) => a.impactEstimate === "low").length,
    unknown: allAttrs.filter((a) => a.impactEstimate === "unknown").length,
  };

  console.log(`\n=== Classification Complete ===`);
  console.log(`  Modules classified: ${classified.length}`);
  console.log(`  Attributes classified: ${allAttrs.length}`);
  console.log(`\n  By measurability:`);
  console.log(`    direct:         ${byMeasurability.direct}`);
  console.log(`    heuristic:      ${byMeasurability.heuristic}`);
  console.log(`    external_api:   ${byMeasurability.external_api}`);
  console.log(`    not_measurable: ${byMeasurability.not_measurable}`);
  console.log(`\n  By impact:`);
  console.log(`    critical: ${byImpact.critical}`);
  console.log(`    high:     ${byImpact.high}`);
  console.log(`    medium:   ${byImpact.medium}`);
  console.log(`    low:      ${byImpact.low}`);
  console.log(`    unknown:  ${byImpact.unknown}`);
  console.log(`\n  Output: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
