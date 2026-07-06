/**
 * Bridge between the ParsedPage (existing checker) and the catalog-based engine.
 *
 * Responsibilities:
 * 1. Resolve catalog rule.field names from ParsedPage data
 * 2. Run evaluateCatalog() with the resolved data
 * 3. Map CatalogCheckResult[] → CategoryResult[] compatible with the UI
 */

import { ParsedPage, CheckResult, CategoryResult } from "./types";
import {
  evaluateCatalog,
  CatalogCheckResult,
  CatalogEvaluationResult,
  CatalogEntry,
  ParsedPageData,
  getCatalog,
} from "./engine";

const CATALOG_TO_UI_CATEGORY: Record<string, string> = {
  content_quality: "Content Quality",
  media: "Media & Visuals",
  structured_data: "Structured Data",
  technical_indexing: "Technical / Indexing",
  entity_semantics: "Entity & Topicality",
  internationalization: "Hreflang & i18n",
  anchors_links: "Authority & Trust",
  authority_trust: "Authority & Trust",
  local_geo: "Local & Geo",
  freshness: "Freshness",
  page_structure: "Page Structure",
  rendering: "User Experience",
  spam_safety: "Spam-Risiko",
  mobile: "User Experience",
  user_signals: "User Experience",
};

/**
 * Resolve the flat field map that the engine expects from the structured ParsedPage.
 * Many catalog rules reference field names from the original leak modules –
 * we map as many as possible to real page data.
 */
function resolvePageData(page: ParsedPage): ParsedPageData {
  const hostname = (() => {
    try {
      return new URL(page.url).hostname;
    } catch {
      return "";
    }
  })();

  const schemaAuthor = findInSchemas(page, "author");
  const schemaPublisher = findInSchemas(page, "publisher");
  const schemaRating = findInSchemas(page, "aggregateRating");
  const schemaName = findInSchemas(page, "name");

  return {
    url: page.url,
    html: undefined,
    title: page.title || undefined,
    metaDescription: page.metaDescription || undefined,
    canonical: page.canonical || undefined,
    headings: page.headings,
    images: page.images.map((img) => ({
      src: img.src,
      alt: img.alt || "",
    })),
    links: [
      ...page.internalLinks.map((l) => ({
        href: l.href,
        text: l.text,
        rel: l.rel || undefined,
        isExternal: false,
      })),
      ...page.externalLinks.map((l) => ({
        href: l.href,
        text: l.text,
        rel: l.rel || undefined,
        isExternal: true,
      })),
    ],
    schema: page.schemas.map((s) => s.properties),
    hreflang: page.hreflang,
    wordCount: page.wordCount,
    textContent: page.textContent,
    scripts: page.scripts.map((s) => s.src).filter(Boolean) as string[],
    stylesheets: page.stylesheets,
    publishDate: page.dates.published || undefined,
    modifiedDate:
      page.dates.modified || page.dates.lastModifiedHeader || undefined,

    // Additional resolved fields for catalog rules
    domain: hostname,
    site: hostname,
    language: detectLanguage(page),
    languageCode: detectLanguage(page),
    documentLanguage: detectLanguage(page),
    lang: detectLanguage(page),
    locale: detectLanguage(page),
    parsedLanguage: detectLanguage(page),
    parsedRegion: detectRegion(page),
    doclength: page.wordCount,
    author: schemaAuthor ? String(schemaAuthor) : undefined,
    publisher: schemaPublisher ? String(schemaPublisher) : undefined,
    aggregateRating: schemaRating ? String(schemaRating) : undefined,
    name: schemaName ? String(schemaName) : undefined,
    outdegree: page.internalLinks.length + page.externalLinks.length,
    outsites: page.externalLinks.length,
    redirect: page.redirectChain.length > 0 ? page.redirectChain.join(" → ") : undefined,
    viewport: page.viewport || undefined,
    text: page.textContent,
    rawText: page.textContent,
    renderedText: page.textContent,
    statusCode: page.statusCode,
    isHttps: page.isHttps,
    htmlSize: page.htmlSize,
    internalLinkCount: page.internalLinks.length,
    externalLinkCount: page.externalLinks.length,
    imageCount: page.images.length,
    imagesWithAlt: page.images.filter((i) => i.alt && i.alt.trim().length > 0).length,
    imagesWithoutAlt: page.images.filter((i) => !i.alt || i.alt.trim().length === 0).length,
    h1Count: page.headings.filter((h) => h.level === 1).length,
    h2Count: page.headings.filter((h) => h.level === 2).length,
    schemaCount: page.schemas.length,
    schemaTypes: page.schemas.map((s) => s.type).join(", "),
    hasCanonical: page.canonical ? true : undefined,
    hasViewport: page.viewport ? true : undefined,
    hasHreflang: page.hreflang.length > 0 ? true : undefined,
    openGraphComplete: Object.keys(page.openGraph).length >= 4 ? true : undefined,
    robotsMeta: page.robotsMeta || undefined,
    hiddenTextRatio: page.hiddenTextRatio,
    scriptCount: page.scripts.length,
    blockingScripts: page.scripts.filter((s) => s.src && !s.isAsync && !s.isDefer).length,

    // Date fields
    publicationTime: page.dates.published || undefined,
    PublicationYear: extractYear(page.dates.published),
    PublicationMonth: extractMonth(page.dates.published),
    PublicationDay: extractDay(page.dates.published),
  };
}

function findInSchemas(page: ParsedPage, property: string): unknown {
  for (const schema of page.schemas) {
    if (schema.properties[property]) {
      const val = schema.properties[property];
      if (typeof val === "object" && val !== null && "name" in (val as Record<string, unknown>)) {
        return (val as Record<string, unknown>).name;
      }
      return val;
    }
  }
  return undefined;
}

function detectLanguage(page: ParsedPage): string | undefined {
  if (page.hreflang.length > 0) {
    const self = page.hreflang.find(
      (h) => h.href === page.url || h.href === page.canonical
    );
    if (self) return self.lang;
    return page.hreflang[0]?.lang;
  }
  return undefined;
}

function detectRegion(page: ParsedPage): string | undefined {
  const lang = detectLanguage(page);
  if (lang && lang.includes("-")) return lang.split("-")[1];
  return undefined;
}

function extractYear(date: string | null | undefined): number | undefined {
  if (!date) return undefined;
  const match = date.match(/(\d{4})/);
  return match ? parseInt(match[1]) : undefined;
}

function extractMonth(date: string | null | undefined): number | undefined {
  if (!date) return undefined;
  const match = date.match(/\d{4}-(\d{2})/);
  return match ? parseInt(match[1]) : undefined;
}

function extractDay(date: string | null | undefined): number | undefined {
  if (!date) return undefined;
  const match = date.match(/\d{4}-\d{2}-(\d{2})/);
  return match ? parseInt(match[1]) : undefined;
}

function mapStatus(status: CatalogCheckResult["status"]): CheckResult["status"] {
  if (status === "pass") return "pass";
  if (status === "warn") return "warn";
  if (status === "fail") return "fail";
  return "pass"; // skip/pending → don't include
}

/**
 * Fields that we can meaningfully resolve from a standard web page.
 * Checks referencing other fields are skipped to avoid false "fail" noise
 * from academic/citation-specific attributes.
 */
const RESOLVABLE_FIELDS = new Set([
  "url", "title", "author", "publisher", "language", "languageCode",
  "documentLanguage", "lang", "locale", "parsedLanguage", "parsedRegion",
  "domain", "site", "doclength", "text", "rawText", "renderedText",
  "viewport", "outdegree", "outsites", "redirect", "name",
  "aggregateRating", "imageCount", "imagesWithAlt", "imagesWithoutAlt",
  "h1Count", "h2Count", "schemaCount", "schemaTypes", "hasCanonical",
  "hasViewport", "hasHreflang", "openGraphComplete", "robotsMeta",
  "hiddenTextRatio", "scriptCount", "blockingScripts", "htmlSize",
  "statusCode", "isHttps", "internalLinkCount", "externalLinkCount",
  "publicationTime", "PublicationYear", "PublicationMonth", "PublicationDay",
  "wordCount", "metaDescription", "canonical",
  // Common fields used in checks via exists operator
  "feedUrl", "images", "height", "width", "link", "linkUrl",
  "hreflangTargetLink", "category", "categoryName", "subject",
  "countryCode", "regionCode", "timezone", "hours",
  "price", "currencyCode", "offer", "condition",
]);

/**
 * Run the catalog engine and return results grouped into UI categories.
 * Only returns checks that produced a definitive pass/warn/fail
 * AND whose rule.field is resolvable from standard page data.
 */
export function runCatalogChecks(page: ParsedPage): CategoryResult[] {
  const pageData = resolvePageData(page);
  const evaluation = evaluateCatalog(pageData);

  // Build a set of IDs whose rule.field we can actually resolve
  const catalog = getCatalog();
  const resolvableIds = new Set(
    catalog
      .filter((e) => !e.rule || RESOLVABLE_FIELDS.has(e.rule.field))
      .map((e) => e.id)
  );

  const actionable = evaluation.results.filter((r) => {
    if (r.status !== "pass" && r.status !== "warn" && r.status !== "fail") return false;
    return resolvableIds.has(r.id);
  });

  const grouped: Record<string, CheckResult[]> = {};

  for (const result of actionable) {
    const uiCategory =
      CATALOG_TO_UI_CATEGORY[result.category] || capitalizeCategory(result.category);

    if (!grouped[uiCategory]) {
      grouped[uiCategory] = [];
    }

    grouped[uiCategory].push({
      factor: result.message.slice(0, 80),
      status: mapStatus(result.status),
      value: result.value !== undefined ? formatValue(result.value) : null,
      recommendation: result.recommendation,
      leakAttribute: result.leakReference,
    });
  }

  return Object.entries(grouped).map(([name, checks]) => ({
    name,
    leakReference: `Leak-Katalog (${checks.length} Checks)`,
    checks,
    score: 0,
  }));
}

/**
 * Check if a catalog entry's rule field is resolvable from standard page data.
 * Used externally if needed for filtering.
 */
export function isResolvableField(field: string): boolean {
  return RESOLVABLE_FIELDS.has(field);
}

/**
 * Get the raw evaluation result for advanced usage (e.g. API responses).
 */
export function runCatalogEvaluation(page: ParsedPage): CatalogEvaluationResult {
  const pageData = resolvePageData(page);
  return evaluateCatalog(pageData);
}

function formatValue(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? "Ja" : "Nein";
  if (typeof value === "string") return value.slice(0, 100);
  return String(value).slice(0, 100);
}

function capitalizeCategory(cat: string): string {
  return cat
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
