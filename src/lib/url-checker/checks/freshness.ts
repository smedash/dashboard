import type { Locale } from '@/i18n/config';
import { urlCheckerFreshnessMessages } from '@/i18n/messages/url-checker/freshness';
import { CheckResult, ParsedPage } from '../types';

type Messages = (typeof urlCheckerFreshnessMessages)[Locale];

export function runFreshnessChecks(page: ParsedPage, locale: Locale): CheckResult[] {
  const t = urlCheckerFreshnessMessages[locale];
  const checks: CheckResult[] = [];

  checks.push(checkPublishedDate(page, t));
  checks.push(checkModifiedDate(page, t));
  checks.push(checkLastModifiedHeader(page, t));

  return checks;
}

function checkPublishedDate(page: ParsedPage, t: Messages): CheckResult {
  if (!page.dates.published) {
    return {
      factor: t.published.factor,
      status: 'warn',
      value: null,
      recommendation: t.published.missing,
      leakAttribute: 'freshnessTwiddler.datePublished',
    };
  }

  const pubDate = new Date(page.dates.published);
  if (isNaN(pubDate.getTime())) {
    return {
      factor: t.published.factor,
      status: 'warn',
      value: page.dates.published,
      recommendation: t.published.unparsable,
      leakAttribute: 'freshnessTwiddler.datePublished',
    };
  }

  const ageInDays = Math.floor((Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24));

  if (ageInDays > 730) {
    return {
      factor: t.published.factor,
      status: 'warn',
      value: t.published.ageValue(page.dates.published, ageInDays),
      recommendation: t.published.old,
      leakAttribute: 'freshnessTwiddler.datePublished',
    };
  }

  return {
    factor: t.published.factor,
    status: 'pass',
    value: page.dates.published,
    recommendation: t.published.ok,
    leakAttribute: 'freshnessTwiddler.datePublished',
  };
}

function checkModifiedDate(page: ParsedPage, t: Messages): CheckResult {
  if (!page.dates.modified) {
    return {
      factor: t.modified.factor,
      status: 'warn',
      value: null,
      recommendation: t.modified.missing,
      leakAttribute: 'lastSignificantUpdate',
    };
  }

  const modDate = new Date(page.dates.modified);
  if (isNaN(modDate.getTime())) {
    return {
      factor: t.modified.factor,
      status: 'warn',
      value: page.dates.modified,
      recommendation: t.modified.unparsable,
      leakAttribute: 'lastSignificantUpdate',
    };
  }

  const ageInDays = Math.floor((Date.now() - modDate.getTime()) / (1000 * 60 * 60 * 24));

  if (ageInDays > 365) {
    return {
      factor: t.modified.factor,
      status: 'warn',
      value: t.modified.ageValue(page.dates.modified, ageInDays),
      recommendation: t.modified.old,
      leakAttribute: 'lastSignificantUpdate',
    };
  }

  return {
    factor: t.modified.factor,
    status: 'pass',
    value: page.dates.modified,
    recommendation: t.modified.ok,
    leakAttribute: 'lastSignificantUpdate',
  };
}

function checkLastModifiedHeader(page: ParsedPage, t: Messages): CheckResult {
  if (!page.dates.lastModifiedHeader) {
    return {
      factor: t.lastModifiedHeader.factor,
      status: 'warn',
      value: null,
      recommendation: t.lastModifiedHeader.missing,
      leakAttribute: 'crawl.lastModifiedHeader',
    };
  }

  return {
    factor: t.lastModifiedHeader.factor,
    status: 'pass',
    value: page.dates.lastModifiedHeader,
    recommendation: t.lastModifiedHeader.ok,
    leakAttribute: 'crawl.lastModifiedHeader',
  };
}
