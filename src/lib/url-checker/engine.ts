/**
 * Catalog-based Rule Engine for the URL Checker
 *
 * This engine evaluates catalog entries against a parsed page.
 * It replaces the hardcoded per-check-file approach with a data-driven model.
 *
 * Integration: This module is designed to work alongside the existing URL checker.
 * Call `evaluateCatalog()` with a parsed page to get results for all catalog entries.
 */

import catalogData from "./catalog.json";

// --- Types ---

export interface CatalogEntry {
  id: string;
  module: string;
  attribute: string;
  measurability: "direct" | "heuristic" | "external_api";
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

export type CheckStatus = "pass" | "warn" | "fail" | "skip" | "pending";

export interface CatalogCheckResult {
  id: string;
  status: CheckStatus;
  category: string;
  impact: CatalogEntry["impact"];
  measurability: CatalogEntry["measurability"];
  message: string;
  recommendation: string;
  leakReference: string;
  value?: unknown;
}

export interface CatalogEvaluationResult {
  totalChecks: number;
  evaluated: number;
  skipped: number;
  results: CatalogCheckResult[];
  byCategory: Record<string, { pass: number; warn: number; fail: number; skip: number }>;
  byImpact: Record<string, { pass: number; warn: number; fail: number }>;
  overallScore: number;
}

// --- Catalog Access ---

function loadCatalog(): CatalogEntry[] {
  return catalogData as unknown as CatalogEntry[];
}

export function getCatalog(): CatalogEntry[] {
  return loadCatalog();
}

export function getCatalogByCategory(category: string): CatalogEntry[] {
  return loadCatalog().filter((e) => e.category === category);
}

export function getCatalogByMeasurability(measurability: CatalogEntry["measurability"]): CatalogEntry[] {
  return loadCatalog().filter((e) => e.measurability === measurability);
}

export function getDirectChecks(): CatalogEntry[] {
  return loadCatalog().filter((e) => e.measurability === "direct");
}

export function getHeuristicChecks(): CatalogEntry[] {
  return loadCatalog().filter((e) => e.measurability === "heuristic");
}

export function getCategories(): string[] {
  return [...new Set(loadCatalog().map((e) => e.category))];
}

// --- Rule Evaluation Engine ---

export interface ParsedPageData {
  [key: string]: unknown;
  url: string;
  html?: string;
  httpHeaders?: Record<string, string>;
  title?: string;
  metaDescription?: string;
  canonical?: string;
  headings?: { level: number; text: string }[];
  images?: { src: string; alt: string }[];
  links?: { href: string; text: string; rel?: string; isExternal: boolean }[];
  schema?: Record<string, unknown>[];
  hreflang?: { lang: string; href: string }[];
  wordCount?: number;
  textContent?: string;
  scripts?: string[];
  stylesheets?: string[];
  publishDate?: string;
  modifiedDate?: string;
}

/**
 * Evaluate all direct-measurable catalog entries against a parsed page.
 * Heuristic and external_api entries are returned as "pending" for later async evaluation.
 */
export function evaluateCatalog(
  page: ParsedPageData,
  options?: { categories?: string[]; minImpact?: CatalogEntry["impact"] }
): CatalogEvaluationResult {
  let entries = loadCatalog();

  if (options?.categories) {
    entries = entries.filter((e) => options.categories!.includes(e.category));
  }
  if (options?.minImpact) {
    const impactOrder = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };
    const minLevel = impactOrder[options.minImpact] ?? 4;
    entries = entries.filter((e) => (impactOrder[e.impact] ?? 4) <= minLevel);
  }

  const results: CatalogCheckResult[] = [];
  const byCategory: Record<string, { pass: number; warn: number; fail: number; skip: number }> = {};
  const byImpact: Record<string, { pass: number; warn: number; fail: number }> = {};

  for (const entry of entries) {
    let result: CatalogCheckResult;

    if (entry.measurability === "direct" && entry.rule) {
      result = evaluateDirectCheck(entry, page);
    } else if (entry.measurability === "heuristic") {
      result = {
        id: entry.id,
        status: "pending",
        category: entry.category,
        impact: entry.impact,
        measurability: entry.measurability,
        message: entry.checkDescription,
        recommendation: entry.recommendation,
        leakReference: entry.leakAttribute,
      };
    } else {
      result = {
        id: entry.id,
        status: "skip",
        category: entry.category,
        impact: entry.impact,
        measurability: entry.measurability,
        message: entry.checkDescription,
        recommendation: entry.recommendation,
        leakReference: entry.leakAttribute,
      };
    }

    results.push(result);

    // Aggregate by category
    if (!byCategory[entry.category]) {
      byCategory[entry.category] = { pass: 0, warn: 0, fail: 0, skip: 0 };
    }
    byCategory[entry.category][result.status === "pending" ? "skip" : result.status]++;

    // Aggregate by impact
    if (result.status !== "skip" && result.status !== "pending") {
      if (!byImpact[entry.impact]) {
        byImpact[entry.impact] = { pass: 0, warn: 0, fail: 0 };
      }
      byImpact[entry.impact][result.status]++;
    }
  }

  const evaluated = results.filter((r) => r.status !== "skip" && r.status !== "pending").length;
  const skipped = results.filter((r) => r.status === "skip" || r.status === "pending").length;

  // Calculate overall score (weighted by impact)
  const impactWeights = { critical: 4, high: 3, medium: 2, low: 1, unknown: 1 };
  let weightedSum = 0;
  let weightedMax = 0;

  for (const r of results) {
    if (r.status === "skip" || r.status === "pending") continue;
    const weight = impactWeights[r.impact] || 1;
    weightedMax += weight * 100;
    if (r.status === "pass") weightedSum += weight * 100;
    else if (r.status === "warn") weightedSum += weight * 50;
  }

  const overallScore = weightedMax > 0 ? Math.round(weightedSum / weightedMax * 100) : 0;

  return {
    totalChecks: entries.length,
    evaluated,
    skipped,
    results,
    byCategory,
    byImpact,
    overallScore,
  };
}

function evaluateDirectCheck(entry: CatalogEntry, page: ParsedPageData): CatalogCheckResult {
  const rule = entry.rule!;
  const value = page[rule.field];

  let status: CheckStatus = "skip";

  switch (rule.operator) {
    case "exists":
      status = value !== undefined && value !== null && value !== "" ? "pass" : "fail";
      break;
    case "gte":
      if (typeof value === "number" && rule.thresholds) {
        const { pass, fail } = rule.thresholds as { pass: number; warn: number; fail: number };
        status = value >= pass ? "pass" : value >= fail ? "warn" : "fail";
      }
      break;
    case "lte":
      if (typeof value === "number" && rule.thresholds) {
        const { pass, fail } = rule.thresholds as { pass: number; warn: number; fail: number };
        status = value <= pass ? "pass" : value <= fail ? "warn" : "fail";
      }
      break;
    case "contains":
      status = typeof value === "string" && value.length > 0 ? "pass" : "fail";
      break;
    default:
      status = "skip";
  }

  return {
    id: entry.id,
    status,
    category: entry.category,
    impact: entry.impact,
    measurability: entry.measurability,
    message: entry.checkDescription,
    recommendation: status === "pass" ? "" : entry.recommendation,
    leakReference: entry.leakAttribute,
    value,
  };
}
