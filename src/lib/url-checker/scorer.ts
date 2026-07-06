import { CategoryResult, CheckResult } from './types';

const CATEGORY_WEIGHTS: Record<string, number> = {
  'Keyword-Relevanz': 0.15,
  'Technical / Indexing': 0.15,
  'Content Quality': 0.22,
  'Entity & Topicality': 0.10,
  'Freshness': 0.08,
  'Authority & Trust': 0.12,
  'User Experience': 0.08,
  'Hreflang & i18n': 0.04,
  'Spam-Risiko': 0.03,
  'Structured Data': 0.06,
  'Media & Visuals': 0.05,
  'Page Structure': 0.05,
  'Local & Geo': 0.03,
};

const STATUS_SCORES = {
  pass: 100,
  warn: 50,
  fail: 0,
} as const;

export function calculateCategoryScore(checks: CheckResult[]): number {
  if (checks.length === 0) return 0;
  const total = checks.reduce((sum, check) => sum + STATUS_SCORES[check.status], 0);
  return Math.round(total / checks.length);
}

export function calculateOverallScore(categories: CategoryResult[]): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const category of categories) {
    const w = CATEGORY_WEIGHTS[category.name] ?? 0.05;
    weightedSum += category.score * w;
    totalWeight += w;
  }

  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}
