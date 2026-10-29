import type { Locale } from '@/i18n/config';
import { urlCheckerHreflangMessages } from '@/i18n/messages/url-checker/hreflang';
import { CheckResult, ParsedPage } from '../types';

type Texts = (typeof urlCheckerHreflangMessages)[Locale];

export function runHreflangChecks(page: ParsedPage, locale: Locale): CheckResult[] {
  const t = urlCheckerHreflangMessages[locale];
  const checks: CheckResult[] = [];

  checks.push(checkHreflangPresence(page, t));
  checks.push(checkHreflangSelfReference(page, t));
  checks.push(checkHreflangXDefault(page, t));

  return checks;
}

function checkHreflangPresence(page: ParsedPage, t: Texts): CheckResult {
  if (page.hreflang.length === 0) {
    return {
      factor: t.presence.factor,
      status: 'warn',
      value: t.presence.noneValue,
      recommendation: t.presence.noneRecommendation,
      leakAttribute: 'indexing.hreflang',
    };
  }

  const langs = page.hreflang.map(h => h.lang);
  return {
    factor: t.presence.factor,
    status: 'pass',
    value: t.presence.languagesValue(page.hreflang.length, langs.join(', ')),
    recommendation: t.presence.passRecommendation,
    leakAttribute: 'indexing.hreflang',
  };
}

function checkHreflangSelfReference(page: ParsedPage, t: Texts): CheckResult {
  if (page.hreflang.length === 0) {
    return {
      factor: t.selfReference.factor,
      status: 'pass',
      value: t.selfReference.notApplicableValue,
      recommendation: t.selfReference.notApplicableRecommendation,
      leakAttribute: 'indexing.hreflangSelfRef',
    };
  }

  const currentUrl = page.url.replace(/\/$/, '');
  const hasSelfRef = page.hreflang.some(h => {
    const hrefNorm = h.href.replace(/\/$/, '');
    return hrefNorm === currentUrl;
  });

  if (!hasSelfRef) {
    return {
      factor: t.selfReference.factor,
      status: 'fail',
      value: t.missingValue,
      recommendation: t.selfReference.failRecommendation,
      leakAttribute: 'indexing.hreflangSelfRef',
    };
  }

  return {
    factor: t.selfReference.factor,
    status: 'pass',
    value: t.selfReference.passValue,
    recommendation: t.selfReference.passRecommendation,
    leakAttribute: 'indexing.hreflangSelfRef',
  };
}

function checkHreflangXDefault(page: ParsedPage, t: Texts): CheckResult {
  if (page.hreflang.length === 0) {
    return {
      factor: t.xDefault.factor,
      status: 'pass',
      value: t.xDefault.notApplicableValue,
      recommendation: t.xDefault.notApplicableRecommendation,
      leakAttribute: 'indexing.hreflangXDefault',
    };
  }

  const hasXDefault = page.hreflang.some(h => h.lang === 'x-default');

  if (!hasXDefault) {
    return {
      factor: t.xDefault.factor,
      status: 'warn',
      value: t.missingValue,
      recommendation: t.xDefault.warnRecommendation,
      leakAttribute: 'indexing.hreflangXDefault',
    };
  }

  return {
    factor: t.xDefault.factor,
    status: 'pass',
    value: t.xDefault.passValue,
    recommendation: t.xDefault.passRecommendation,
    leakAttribute: 'indexing.hreflangXDefault',
  };
}
