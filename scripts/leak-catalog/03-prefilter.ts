/**
 * Phase 3: Automatic relevance pre-filter
 *
 * Splits the raw modules into three buckets:
 * - excluded: Clearly not search-relevant (YouTube, Assistant, Ads, etc.)
 * - relevant: Clearly search-relevant (Anchors, Quality, PerDocData, etc.)
 * - uncertain: Needs AI classification
 *
 * Usage:
 *   npx tsx scripts/leak-catalog/03-prefilter.ts
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

const CATALOG_DIR = join(process.cwd(), "data/leak-catalog");
const INPUT_PATH = join(CATALOG_DIR, "raw-modules.json");

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

// Namespaces/prefixes that are clearly NOT related to web search ranking
const EXCLUDE_PREFIXES = [
  "AppsDynamite",
  "AppsPeopleOz",
  "AppsPeopleActivity",
  "AssistantApi",
  "AssistantDevice",
  "AssistantGroundingRange",
  "AssistantLogs",
  "AssistantPrefill",
  "AssistantProductivity",
  "AssistantReminders",
  "AdsShoppingReporting",
  "CloudAi",
  "CloudAiPlatform",
  "Enterprise",
  "GoogleCloudContentwarehouse",
  "GoogleCloudDocumentai",
  "GoogleIam",
  "GoogleLongrunning",
  "GoogleRpc",
  "GoogleType",
  "GoogleProtobuf",
  "Proto2Bridge",
  "StorageGraphBfg",
  "NlpSeniority",
  "SdrPage",
  "SdrScrollTo",
  "TrawlerFetch",
  "TelephoneNumber",
  "PersonalizationMapsAlias",
  "QualityDialogManager",
  "MediaIndex",
  "MultiscalePointerIndex",
  "OceanLocale",
  "Ks", // KnowledgeSearch internal
  "SecurityCredentials",
  "SocialGraph",
  "SocialCommon",
  "YoutubeComments",
  "Youtube",
  "ResearchScam",
  "KnowledgeAnswers",  // Assistant/Dialog, not search ranking
];

// Namespaces definitely relevant to web search/SEO
const INCLUDE_PREFIXES = [
  "Anchors",
  "AnchorsAnchor",
  "AnchorsRedundant",
  "Quality",
  "QualityNsr",
  "QualitySalient",
  "QualityBoost",
  "QualityCalypso",
  "QualityFringe",
  "QualityRankembeddings",
  "QualitySitemapTarget",
  "QualitySnippets",
  "QualityTimebased",
  "QualityViews",
  "QualityWebanswers",
  "Indexing",
  "IndexingDocument",
  "IndexingDups",
  "IndexingBadpages",
  "IndexingConverter",
  "IndexingMobile",
  "IndexingSignal",
  "IndexingUrlPattern",
  "Htmlrender",
  "HtmlrenderWebkitHeadless",
  "Nlp",
  "NlpSaft",
  "NlpSemantic",
  "Goodoc",
  "GoodocDocument",
  "CompositeDoc",
  "PerDocData",
  "RepositoryWebref",
  "RepositoryAnnotations",
  "WebOf",
  "Spam",
  "SpamBrain",
  "Freshness",
  "FreshnessAnnotation",
  "Mustang",
  "NavBoost",
  "Crawl",
  "CrawlerChanged",
  "Safesearch",
  "SafesearchImage",
  "Wwwsearch",
  "GDoc", // GDocumentBase
  "DocProperties",
  "CountryCount",
  "CrawlLog",
  "DupsCalcContent",
  "ExtraSnippet",
  "FatcatCompact",
  "ImageData",
  "ImageContent",
  "KnowledgeAnswersIntentQuery",
  "LocalSearch",
  "MobileApp",
  "MustangRepos",
  "NavishFeed",
  "PairwiseQ",
  "QualityAnchors",
  "QualityDnav",
  "QualityFusion",
  "QualityGeoBrain",
  "QualityLabels",
  "QualityOrbit",
  "QualityProduct",
  "QualityRealtime",
  "QualityRichsnippets",
  "QualityShoppingShoppingAttachment",
  "QualitySitemapSubresource",
  "QualityTangramInformation",
  "Render",
  "RichsnippetsData",
  "SafeBrowsing",
  "SchemaCom",
  "SecurityCredentials",
  "SocialCommon",
  "SocialGraph",
  "UrlPoisoning",
  "VideoContent",
  "WebLink",
  "Webref",
];

// Keywords in descriptions that indicate search relevance
const RELEVANCE_KEYWORDS = [
  "ranking", "pagerank", "anchor", "crawl", "index", "serp",
  "query", "search result", "snippet", "quality score", "spam",
  "freshness", "content quality", "link", "backlink", "authority",
  "navboost", "click", "impression", "document signal", "page quality",
  "canonical", "redirect", "robots", "sitemap", "hreflang",
  "mobile friendly", "page speed", "core web vitals", "rendering",
  "schema.org", "structured data", "entity", "knowledge graph",
  "e-e-a-t", "expertise", "trust", "topical",
];

function classifyModule(mod: RawModule): "excluded" | "relevant" | "uncertain" {
  const shortName = mod.shortName;

  // Check exclude prefixes first
  for (const prefix of EXCLUDE_PREFIXES) {
    if (shortName.startsWith(prefix)) return "excluded";
  }

  // Check include prefixes
  for (const prefix of INCLUDE_PREFIXES) {
    if (shortName.startsWith(prefix)) return "relevant";
  }

  // Check description and attribute descriptions for relevance keywords
  const allText = [
    mod.description,
    ...mod.attributes.map((a) => a.description),
    ...mod.attributes.map((a) => a.name),
  ].join(" ").toLowerCase();

  const relevanceScore = RELEVANCE_KEYWORDS.filter((kw) => allText.includes(kw)).length;
  if (relevanceScore >= 2) return "relevant";
  if (relevanceScore === 1) return "uncertain";

  return "excluded";
}

async function main() {
  console.log("=== Phase 3: Automatic Relevance Pre-Filter ===\n");

  if (!existsSync(INPUT_PATH)) {
    console.error(`Input not found: ${INPUT_PATH}`);
    console.error("Run 02-parse.ts first.");
    process.exit(1);
  }

  const modules: RawModule[] = JSON.parse(readFileSync(INPUT_PATH, "utf-8"));
  console.log(`Loaded ${modules.length} modules\n`);

  const excluded: RawModule[] = [];
  const relevant: RawModule[] = [];
  const uncertain: RawModule[] = [];

  for (const mod of modules) {
    const classification = classifyModule(mod);
    if (classification === "excluded") excluded.push(mod);
    else if (classification === "relevant") relevant.push(mod);
    else uncertain.push(mod);
  }

  // Stats
  const relevantAttrs = relevant.reduce((sum, m) => sum + m.attributeCount, 0);
  const uncertainAttrs = uncertain.reduce((sum, m) => sum + m.attributeCount, 0);
  const excludedAttrs = excluded.reduce((sum, m) => sum + m.attributeCount, 0);

  console.log("=== Classification Results ===");
  console.log(`  Relevant:  ${relevant.length} modules (${relevantAttrs} attributes)`);
  console.log(`  Uncertain: ${uncertain.length} modules (${uncertainAttrs} attributes)`);
  console.log(`  Excluded:  ${excluded.length} modules (${excludedAttrs} attributes)`);
  console.log(`  Total:     ${modules.length} modules`);

  console.log(`\nRelevant namespaces:`);
  const relNs = new Map<string, number>();
  for (const m of relevant) relNs.set(m.namespace, (relNs.get(m.namespace) || 0) + 1);
  const sortedRelNs = [...relNs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [ns, count] of sortedRelNs) {
    console.log(`    ${ns}: ${count} modules`);
  }

  console.log(`\nUncertain namespaces:`);
  const uncNs = new Map<string, number>();
  for (const m of uncertain) uncNs.set(m.namespace, (uncNs.get(m.namespace) || 0) + 1);
  const sortedUncNs = [...uncNs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [ns, count] of sortedUncNs) {
    console.log(`    ${ns}: ${count} modules`);
  }

  // Save outputs
  writeFileSync(join(CATALOG_DIR, "excluded-modules.json"), JSON.stringify(excluded, null, 2), "utf-8");
  writeFileSync(join(CATALOG_DIR, "relevant-modules.json"), JSON.stringify(relevant, null, 2), "utf-8");
  writeFileSync(join(CATALOG_DIR, "uncertain-modules.json"), JSON.stringify(uncertain, null, 2), "utf-8");

  console.log(`\nFiles saved to ${CATALOG_DIR}/`);
  console.log(`  - excluded-modules.json`);
  console.log(`  - relevant-modules.json`);
  console.log(`  - uncertain-modules.json`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
