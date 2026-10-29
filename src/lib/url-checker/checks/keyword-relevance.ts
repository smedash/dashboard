import type { Locale } from '@/i18n/config';
import { urlCheckerKeywordRelevanceMessages } from '@/i18n/messages/url-checker/keyword-relevance';
import { CheckResult, ParsedPage } from '../types';

type Texts = (typeof urlCheckerKeywordRelevanceMessages)[Locale];

export function runKeywordRelevanceChecks(page: ParsedPage, locale: Locale): CheckResult[] {
  if (!page.keyword) return [];

  const t = urlCheckerKeywordRelevanceMessages[locale];
  const keyword = page.keyword.toLowerCase();
  const checks: CheckResult[] = [];

  checks.push(checkKeywordInTitle(page, keyword, t));
  checks.push(checkKeywordInH1(page, keyword, t));
  checks.push(checkKeywordInMetaDescription(page, keyword, t));
  checks.push(checkKeywordInFirstParagraph(page, keyword, t));
  checks.push(checkKeywordInUrl(page, keyword, t));
  checks.push(checkKeywordDensity(page, keyword, t));

  return checks;
}

function checkKeywordInTitle(page: ParsedPage, keyword: string, t: Texts): CheckResult {
  const title = page.title.toLowerCase();

  if (!title.includes(keyword)) {
    return {
      factor: t.title.factor,
      status: 'fail',
      value: t.title.missingValue(page.keyword ?? ''),
      recommendation: t.title.missingRecommendation(page.keyword ?? ''),
      leakAttribute: 'titleMatch.keywordPresence',
    };
  }

  const position = title.indexOf(keyword);
  if (position > 30) {
    return {
      factor: t.title.factor,
      status: 'warn',
      value: t.positionValue(position + 1),
      recommendation: t.title.lateRecommendation(position + 1),
      leakAttribute: 'titleMatch.keywordPresence',
    };
  }

  return {
    factor: t.title.factor,
    status: 'pass',
    value: t.positionValue(position + 1),
    recommendation: t.title.passRecommendation,
    leakAttribute: 'titleMatch.keywordPresence',
  };
}

function checkKeywordInH1(page: ParsedPage, keyword: string, t: Texts): CheckResult {
  const h1s = page.headings.filter(h => h.level === 1);

  if (h1s.length === 0) {
    return {
      factor: t.h1.factor,
      status: 'fail',
      value: t.h1.noH1Value,
      recommendation: t.h1.noH1Recommendation,
      leakAttribute: 'headings.keywordH1Match',
    };
  }

  const h1Text = h1s.map(h => h.text.toLowerCase()).join(' ');
  if (!h1Text.includes(keyword)) {
    return {
      factor: t.h1.factor,
      status: 'fail',
      value: t.h1.missingValue(page.keyword ?? ''),
      recommendation: t.h1.missingRecommendation,
      leakAttribute: 'headings.keywordH1Match',
    };
  }

  return {
    factor: t.h1.factor,
    status: 'pass',
    value: t.containedValue,
    recommendation: t.h1.passRecommendation,
    leakAttribute: 'headings.keywordH1Match',
  };
}

function checkKeywordInMetaDescription(page: ParsedPage, keyword: string, t: Texts): CheckResult {
  if (!page.metaDescription) {
    return {
      factor: t.metaDescription.factor,
      status: 'fail',
      value: t.metaDescription.noDescValue,
      recommendation: t.metaDescription.noDescRecommendation,
      leakAttribute: 'snippet.keywordMatch',
    };
  }

  const desc = page.metaDescription.toLowerCase();
  if (!desc.includes(keyword)) {
    return {
      factor: t.metaDescription.factor,
      status: 'warn',
      value: t.metaDescription.missingValue(page.keyword ?? ''),
      recommendation: t.metaDescription.missingRecommendation,
      leakAttribute: 'snippet.keywordMatch',
    };
  }

  return {
    factor: t.metaDescription.factor,
    status: 'pass',
    value: t.containedValue,
    recommendation: t.metaDescription.passRecommendation,
    leakAttribute: 'snippet.keywordMatch',
  };
}

function checkKeywordInFirstParagraph(page: ParsedPage, keyword: string, t: Texts): CheckResult {
  const firstChunk = page.textContent.toLowerCase().slice(0, 500);

  if (!firstChunk.includes(keyword)) {
    return {
      factor: t.firstParagraph.factor,
      status: 'warn',
      value: t.firstParagraph.missingValue,
      recommendation: t.firstParagraph.missingRecommendation,
      leakAttribute: 'termFrequency.earlyMention',
    };
  }

  const position = firstChunk.indexOf(keyword);
  return {
    factor: t.firstParagraph.factor,
    status: 'pass',
    value: t.firstParagraph.positionValue(position),
    recommendation: t.firstParagraph.passRecommendation,
    leakAttribute: 'termFrequency.earlyMention',
  };
}

function checkKeywordInUrl(page: ParsedPage, keyword: string, t: Texts): CheckResult {
  const urlPath = new URL(page.url).pathname.toLowerCase();
  const keywordSlug = keyword.replace(/\s+/g, '-').replace(/[^a-z0-9\-äöüß]/g, '');
  const keywordParts = keyword.split(/\s+/);

  const urlContainsKeyword = urlPath.includes(keywordSlug) ||
    keywordParts.every(part => urlPath.includes(part));

  if (!urlContainsKeyword) {
    return {
      factor: t.url.factor,
      status: 'warn',
      value: t.url.missingValue,
      recommendation: t.url.missingRecommendation,
      leakAttribute: 'url.keywordMatch',
    };
  }

  return {
    factor: t.url.factor,
    status: 'pass',
    value: t.url.passValue,
    recommendation: t.url.passRecommendation,
    leakAttribute: 'url.keywordMatch',
  };
}

function checkKeywordDensity(page: ParsedPage, keyword: string, t: Texts): CheckResult {
  const text = page.textContent.toLowerCase();
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) {
    return {
      factor: t.density.factor,
      status: 'warn',
      value: null,
      recommendation: t.density.noTextRecommendation,
      leakAttribute: 'termFrequency.keywordDensity',
    };
  }

  const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const matches = text.match(regex) || [];
  const count = matches.length;
  const density = (count / words.length) * 100;
  const densityRounded = Math.round(density * 10) / 10;

  if (count === 0) {
    return {
      factor: t.density.factor,
      status: 'fail',
      value: t.density.zeroValue,
      recommendation: t.density.zeroRecommendation(page.keyword ?? ''),
      leakAttribute: 'termFrequency.keywordDensity',
    };
  }

  if (density > 3) {
    return {
      factor: t.density.factor,
      status: 'warn',
      value: `${count}x (${densityRounded}%)`,
      recommendation: t.density.highRecommendation(densityRounded),
      leakAttribute: 'termFrequency.keywordDensity',
    };
  }

  if (density < 0.5 && words.length > 300) {
    return {
      factor: t.density.factor,
      status: 'warn',
      value: `${count}x (${densityRounded}%)`,
      recommendation: t.density.lowRecommendation(count, words.length, densityRounded),
      leakAttribute: 'termFrequency.keywordDensity',
    };
  }

  return {
    factor: t.density.factor,
    status: 'pass',
    value: `${count}x (${densityRounded}%)`,
    recommendation: t.density.passRecommendation,
    leakAttribute: 'termFrequency.keywordDensity',
  };
}
