/**
 * Phase 2: Parse scraped HexDocs HTML into structured JSON
 *
 * Handles the actual HexDocs HTML format (not plain text).
 * Works with:
 * - The single-page API reference (v0.4.0 or v0.3.0 - preferred, fastest)
 * - Individual module HTML files from Phase 1
 *
 * Usage:
 *   npx tsx scripts/leak-catalog/02-parse.ts
 *   npx tsx scripts/leak-catalog/02-parse.ts --from-single-page path/to/file.html
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import * as cheerio from "cheerio";

const RAW_DIR = join(process.cwd(), "data/leak-raw");
const CATALOG_DIR = join(process.cwd(), "data/leak-catalog");

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

function extractNamespace(shortName: string): string {
  const knownPrefixes = [
    "AbuseiamVideo", "Abuseiam", "AppsDynamiteShared", "AppsDynamite",
    "AppsPeopleOzExternalMergedpeopleapi", "AppsPeopleOz", "AppsPeopleActivity", "AppsPeople",
    "AssistantApiCore", "AssistantApi", "AssistantDevice", "AssistantGrounding",
    "AssistantLogs", "AssistantPrefill", "AssistantProductivity", "AssistantReminders",
    "AdsShoppingReporting",
    "CloudAiPlatformTenantresource", "CloudAi",
    "CompositeDoc",
    "CountryCountry",
    "CrawlerChangenotes",
    "DrishtiVesper",
    "EnterpriseTopaz",
    "FatcatCompact",
    "FreebaseProperty", "Freebase",
    "GeostoreAddress", "Geostore",
    "GoodocDocument", "Goodoc",
    "GoogleApi",
    "GoogleCloudContentwarehouse", "GoogleCloudDocumentai",
    "GoogleIam", "GoogleLongrunning", "GoogleRpc", "GoogleType", "GoogleProtobuf",
    "HtmlrenderWebkitHeadless", "Htmlrender",
    "ImageData", "ImageContent", "ImageSearch",
    "IndexingDocument", "IndexingDups", "IndexingBadpages", "IndexingConverter",
    "IndexingMobile", "IndexingSignal", "IndexingUrlPattern", "Indexing",
    "KnowledgeAnswers", "KnowledgeGraph", "KnowledgeVerticals", "Knowledge",
    "LegalCitation", "Legal",
    "MediaIndex",
    "MustangRepos", "Mustang",
    "NavBoost",
    "NlpSaft", "NlpSemantic", "Nlp",
    "OceanLocale", "Ocean",
    "PerDocData",
    "Proto2Bridge",
    "QualityNsr", "QualitySalient", "QualityBoost", "QualityCalypso",
    "QualityFringe", "QualityRankembeddings", "QualityRichsnippets",
    "QualitySnippets", "QualityTimebased", "QualityViews", "Quality",
    "RepositoryWebref", "RepositoryAnnotations", "Repository",
    "ResearchScam", "Research",
    "SafeBrowsing", "Safesearch",
    "SecurityCredentials", "Security",
    "SocialCommon", "SocialGraph", "Social",
    "SpamBrain", "Spam",
    "StorageGraphBfg", "Storage",
    "TrawlerFetch", "Trawler",
    "VideoContent", "Video",
    "WebLink", "Webref", "WebOf",
    "WwwsearchUniversal", "Wwwsearch",
    "YoutubeComments", "Youtube",
    "AnchorsAnchor", "AnchorsRedundant", "Anchors",
    "FreshnessAnnotation", "Freshness",
    "DocProperties", "Doc",
  ];

  for (const prefix of knownPrefixes) {
    if (shortName.startsWith(prefix)) return prefix;
  }

  // Fallback: extract CamelCase prefix
  const match = shortName.match(/^([A-Z][a-z]+(?:[A-Z][a-z]+)*)/);
  return match ? match[1] : shortName;
}

function parseAttributeFromLi(text: string): RawAttribute | null {
  // Format in HTML (after stripping tags):
  // fieldName (type: TYPE, default: DEFAULT) - Description
  const regex = /^\s*(\w+)\s*\((?:type:\s*)?([^,)]+?)(?:,\s*default:\s*([^)]*))?\)\s*-?\s*(.*)/s;
  const match = text.match(regex);

  if (!match) return null;

  const name = match[1].trim();
  const type = match[2].trim();
  const dflt = (match[3] || "nil").trim();
  const description = (match[4] || "").trim();

  return {
    name,
    type,
    default: dflt,
    description,
    referencedTypes: extractReferencedTypes(type),
  };
}

function extractReferencedTypes(typeStr: string): string[] {
  const refs: string[] = [];
  const regex = /GoogleApi\.ContentWarehouse\.V1\.Model\.(\w+)/g;
  let m;
  while ((m = regex.exec(typeStr)) !== null) {
    refs.push(m[1]);
  }
  return refs;
}

function parseApiReferenceHtml(html: string): RawModule[] {
  const $ = cheerio.load(html);
  const modules: RawModule[] = [];

  $(".summary-row").each((_, row) => {
    const $row = $(row);
    const $link = $row.find(".summary-signature a");
    const fullName = $link.text().trim();

    if (!fullName.startsWith("GoogleApi.ContentWarehouse.V1.Model.")) return;

    const shortName = fullName.replace("GoogleApi.ContentWarehouse.V1.Model.", "");
    const namespace = extractNamespace(shortName);

    // Get synopsis content (contains description and attributes)
    const $synopsis = $row.find(".summary-synopsis");
    const synopsisHtml = $synopsis.html() || "";

    // Extract description: text before the Attributes heading
    let description = "";
    const $synClone = cheerio.load(synopsisHtml);
    const synText = $synopsis.text();
    const attrIdx = synText.indexOf("Attributes");
    if (attrIdx > 0) {
      description = synText.substring(0, attrIdx).trim();
    } else if (!synText.includes("type:")) {
      description = synText.trim();
    }

    // Parse attributes from <li> elements
    const attributes: RawAttribute[] = [];
    $synopsis.find("li").each((_, li) => {
      const liText = $(li).text().trim();
      const attr = parseAttributeFromLi(liText);
      if (attr) attributes.push(attr);
    });

    // If no <li> found but there are inline code elements, try inline parsing
    if (attributes.length === 0 && synopsisHtml.includes("code")) {
      const inlineRegex = /<code[^>]*>(\w+)<\/code>\s*\(<em>type:<\/em>\s*<code[^>]*>([^<]+)<\/code>(?:,\s*<em>default:<\/em>\s*<code[^>]*>([^<]*)<\/code>)?\)\s*-?\s*([^<]*(?:<[^l][^/].*?)?)/g;
      let im;
      while ((im = inlineRegex.exec(synopsisHtml)) !== null) {
        attributes.push({
          name: im[1],
          type: im[2],
          default: im[3] || "nil",
          description: cheerio.load(im[4]).text().trim(),
          referencedTypes: extractReferencedTypes(im[2]),
        });
      }
    }

    modules.push({
      fullName,
      shortName,
      namespace,
      description: description.substring(0, 500),
      attributes,
      attributeCount: attributes.length,
    });
  });

  return modules;
}

function parseIndividualModuleHtml(html: string, fallbackName?: string): RawModule | null {
  const $ = cheerio.load(html);

  // Get module name from h1
  let fullName = "";
  const h1Text = $("h1 span[translate='no']").first().text().trim();
  if (h1Text.includes("GoogleApi.ContentWarehouse.V1.Model.")) {
    fullName = h1Text;
  } else if (fallbackName) {
    fullName = fallbackName;
  } else {
    return null;
  }

  const shortName = fullName.replace("GoogleApi.ContentWarehouse.V1.Model.", "");
  const namespace = extractNamespace(shortName);

  // Get description from moduledoc section (before attributes list)
  let description = "";
  const $moduledoc = $("#moduledoc");
  const moduledocText = $moduledoc.text();
  const attrIdx = moduledocText.indexOf("Attributes");
  if (attrIdx > 0) {
    description = moduledocText.substring(0, attrIdx).trim().substring(0, 500);
  }

  // Parse attributes
  const attributes: RawAttribute[] = [];
  $moduledoc.find("li").each((_, li) => {
    const liText = $(li).text().trim();
    const attr = parseAttributeFromLi(liText);
    if (attr) attributes.push(attr);
  });

  return {
    fullName,
    shortName,
    namespace,
    description,
    attributes,
    attributeCount: attributes.length,
  };
}

async function main() {
  console.log("=== Phase 2: Parsing HTML to structured JSON ===\n");

  const args = process.argv.slice(2);
  const singlePageIdx = args.indexOf("--from-single-page");
  let modules: RawModule[] = [];

  if (singlePageIdx >= 0 && args[singlePageIdx + 1]) {
    const filePath = args[singlePageIdx + 1];
    console.log(`Parsing single-page reference: ${filePath}`);
    const html = readFileSync(filePath, "utf-8");
    modules = parseApiReferenceHtml(html);
  } else {
    // First try the downloaded v0.4.0 API reference (single page with all data)
    const indexPath = join(RAW_DIR, "_api-reference.html");
    if (existsSync(indexPath)) {
      console.log(`Parsing API reference index: ${indexPath}`);
      const html = readFileSync(indexPath, "utf-8");
      modules = parseApiReferenceHtml(html);
      console.log(`  Parsed ${modules.length} modules from index page`);
    }

    // Enrich with individual module pages (they have fuller descriptions)
    const individualFiles = existsSync(RAW_DIR)
      ? readdirSync(RAW_DIR).filter((f) => f.endsWith(".html") && !f.startsWith("_"))
      : [];

    if (individualFiles.length > 0) {
      console.log(`\nEnriching with ${individualFiles.length} individual module pages...`);
      const moduleMap = new Map(modules.map((m) => [m.fullName, m]));
      let enriched = 0;

      for (const file of individualFiles) {
        const html = readFileSync(join(RAW_DIR, file), "utf-8");
        const moduleName = "GoogleApi.ContentWarehouse.V1.Model." +
          file.replace("GoogleApi_ContentWarehouse_V1_Model_", "").replace(".html", "");
        const parsed = parseIndividualModuleHtml(html, moduleName);

        if (!parsed) continue;

        const existing = moduleMap.get(parsed.fullName);
        if (existing) {
          // Enrich: prefer individual page data if it has more attributes
          if (parsed.attributeCount > existing.attributeCount) {
            existing.attributes = parsed.attributes;
            existing.attributeCount = parsed.attributeCount;
            enriched++;
          }
          if (parsed.description && parsed.description.length > existing.description.length) {
            existing.description = parsed.description;
          }
        } else {
          moduleMap.set(parsed.fullName, parsed);
          modules.push(parsed);
          enriched++;
        }
      }
      console.log(`  Enriched/added ${enriched} modules`);
    }
  }

  if (modules.length === 0) {
    console.error("No modules found. Run 01-scrape.ts first, or use --from-single-page.");
    process.exit(1);
  }

  // Filter out non-Model entries (V1, V1.Api.Projects, V1.Connection)
  modules = modules.filter((m) => m.fullName.includes(".Model."));

  // Stats
  const totalAttributes = modules.reduce((sum, m) => sum + m.attributeCount, 0);
  const modulesWithAttrs = modules.filter((m) => m.attributeCount > 0);
  const namespaces = [...new Set(modules.map((m) => m.namespace))].sort();

  console.log(`\n=== Parse Results ===`);
  console.log(`  Modules total: ${modules.length}`);
  console.log(`  Modules with attributes: ${modulesWithAttrs.length}`);
  console.log(`  Total attributes: ${totalAttributes}`);
  console.log(`  Unique namespaces: ${namespaces.length}`);
  console.log(`\nTop namespaces by module count:`);

  const nsCounts = new Map<string, { modules: number; attrs: number }>();
  for (const m of modules) {
    const entry = nsCounts.get(m.namespace) || { modules: 0, attrs: 0 };
    entry.modules++;
    entry.attrs += m.attributeCount;
    nsCounts.set(m.namespace, entry);
  }
  const sortedNs = [...nsCounts.entries()].sort((a, b) => b[1].attrs - a[1].attrs).slice(0, 25);
  for (const [ns, stats] of sortedNs) {
    console.log(`    ${ns}: ${stats.modules} modules, ${stats.attrs} attributes`);
  }

  // Save output
  const outputPath = join(CATALOG_DIR, "raw-modules.json");
  writeFileSync(outputPath, JSON.stringify(modules, null, 2), "utf-8");
  const fileSizeMB = (Buffer.byteLength(JSON.stringify(modules, null, 2)) / 1024 / 1024).toFixed(1);
  console.log(`\nSaved to ${outputPath} (${fileSizeMB} MB)`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
