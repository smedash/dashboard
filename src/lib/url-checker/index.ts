import { ParsedPage, UrlCheckResult, CategoryResult, CheckResult } from './types';
import { parseHtml } from './parser';
import { runTechnicalChecks } from './checks/technical';
import { runContentQualityChecks } from './checks/content-quality';
import { runEntityTopicalityChecks } from './checks/entity-topicality';
import { runFreshnessChecks } from './checks/freshness';
import { runAuthorityTrustChecks } from './checks/authority-trust';
import { runUserExperienceChecks } from './checks/user-experience';
import { runKeywordRelevanceChecks } from './checks/keyword-relevance';
import { runHreflangChecks } from './checks/hreflang';
import { runSpamRiskChecks } from './checks/spam-risk';
import { runCatalogChecks } from './catalog-bridge';
import { calculateCategoryScore, calculateOverallScore } from './scorer';

export { parseHtml } from './parser';
export type { UrlCheckResult, ParsedPage } from './types';
export { runCatalogEvaluation } from './catalog-bridge';

export function runAllChecks(page: ParsedPage): UrlCheckResult {
  const categories: CategoryResult[] = [
    {
      name: 'Technical / Indexing',
      leakReference: 'Mustang, DocJoiner, FreshDocs',
      checks: runTechnicalChecks(page),
      score: 0,
    },
    {
      name: 'Content Quality',
      leakReference: 'NSR, QualityBoost, Panda/BabyPanda',
      checks: runContentQualityChecks(page),
      score: 0,
    },
    {
      name: 'Entity & Topicality',
      leakReference: 'WebRef, Pianno, TopicEmbeddings',
      checks: runEntityTopicalityChecks(page),
      score: 0,
    },
    {
      name: 'Freshness',
      leakReference: 'FreshnessTwiddler, LastSignificantUpdate',
      checks: runFreshnessChecks(page),
      score: 0,
    },
    {
      name: 'Authority & Trust',
      leakReference: 'NSR, SpamBrain, PageRank',
      checks: runAuthorityTrustChecks(page),
      score: 0,
    },
    {
      name: 'User Experience',
      leakReference: 'NavBoost, ClutterScore',
      checks: runUserExperienceChecks(page),
      score: 0,
    },
    {
      name: 'Hreflang & i18n',
      leakReference: 'indexing.hreflang, i18nBucket',
      checks: runHreflangChecks(page),
      score: 0,
    },
    {
      name: 'Spam-Risiko',
      leakReference: 'SpamBrain, spamrank, exactMatchDomainDemotion',
      checks: runSpamRiskChecks(page),
      score: 0,
    },
  ];

  // Add keyword category if keyword provided
  if (page.keyword) {
    const keywordChecks = runKeywordRelevanceChecks(page);
    if (keywordChecks.length > 0) {
      categories.unshift({
        name: 'Keyword-Relevanz',
        leakReference: 'termFrequency, titleMatch, WebRef topicality',
        checks: keywordChecks,
        score: 0,
      });
    }
  }

  // Run catalog-based checks and merge into existing/new categories
  const catalogCategories = runCatalogChecks(page);
  mergeCatalogResults(categories, catalogCategories);

  for (const category of categories) {
    category.score = calculateCategoryScore(category.checks);
  }

  const overallScore = calculateOverallScore(categories);

  return {
    url: page.url,
    overallScore,
    categories,
    keyword: page.keyword,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Merge catalog results into the main category list.
 * If a catalog category matches an existing one, its checks are appended (deduplicated).
 * Otherwise a new category is added.
 */
function mergeCatalogResults(
  existing: CategoryResult[],
  catalogResults: CategoryResult[]
): void {
  const existingFactors = new Set<string>();
  for (const cat of existing) {
    for (const check of cat.checks) {
      existingFactors.add(`${cat.name}::${check.leakAttribute}`);
    }
  }

  for (const catalogCat of catalogResults) {
    const match = existing.find((e) => e.name === catalogCat.name);

    const newChecks = catalogCat.checks.filter(
      (c) => !existingFactors.has(`${catalogCat.name}::${c.leakAttribute}`)
    );

    if (newChecks.length === 0) continue;

    if (match) {
      match.checks.push(...newChecks);
      if (!match.leakReference.includes("Katalog")) {
        match.leakReference += ` + Katalog (${newChecks.length})`;
      }
    } else {
      existing.push({
        name: catalogCat.name,
        leakReference: catalogCat.leakReference,
        checks: newChecks,
        score: 0,
      });
    }
  }
}

export function analyzeUrl(
  html: string,
  url: string,
  statusCode: number,
  redirectChain: string[],
  lastModifiedHeader: string | null,
  keyword?: string
): UrlCheckResult {
  const page = parseHtml(html, url, statusCode, redirectChain, lastModifiedHeader);
  if (keyword) {
    page.keyword = keyword;
  }
  return runAllChecks(page);
}
