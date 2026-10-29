import type { Locale } from '@/i18n/config';
import { urlCheckerAuthorityTrustMessages } from '@/i18n/messages/url-checker/authority-trust';
import { CheckResult, ParsedPage } from '../types';

type Texts = (typeof urlCheckerAuthorityTrustMessages)[Locale];

export function runAuthorityTrustChecks(page: ParsedPage, locale: Locale): CheckResult[] {
  const t = urlCheckerAuthorityTrustMessages[locale];
  const checks: CheckResult[] = [];

  checks.push(checkHttpsSecurity(page, t));
  checks.push(checkNofollowRatio(page, t));
  checks.push(checkHiddenContent(page, t));
  checks.push(checkRedirectIntegrity(page, t));

  return checks;
}

function checkHttpsSecurity(page: ParsedPage, t: Texts): CheckResult {
  if (!page.isHttps) {
    return {
      factor: t.https.factor,
      status: 'fail',
      value: 'HTTP',
      recommendation: t.https.failRecommendation,
      leakAttribute: 'nsr.trustSignal',
    };
  }

  return {
    factor: t.https.factor,
    status: 'pass',
    value: t.https.passValue,
    recommendation: t.https.passRecommendation,
    leakAttribute: 'nsr.trustSignal',
  };
}

function checkNofollowRatio(page: ParsedPage, t: Texts): CheckResult {
  const externalLinks = page.externalLinks;
  if (externalLinks.length === 0) {
    return {
      factor: t.nofollow.factor,
      status: 'pass',
      value: t.nofollow.noLinksValue,
      recommendation: t.nofollow.noLinksRecommendation,
      leakAttribute: 'anchors.nofollowRatio',
    };
  }

  const nofollowLinks = externalLinks.filter(l => l.rel && l.rel.includes('nofollow'));
  const ratio = nofollowLinks.length / externalLinks.length;

  if (ratio > 0.9 && externalLinks.length > 5) {
    return {
      factor: t.nofollow.factor,
      status: 'warn',
      value: `${nofollowLinks.length}/${externalLinks.length} nofollow`,
      recommendation: t.nofollow.tooManyRecommendation,
      leakAttribute: 'anchors.nofollowRatio',
    };
  }

  if (ratio < 0.1 && externalLinks.length > 10) {
    return {
      factor: t.nofollow.factor,
      status: 'warn',
      value: `${nofollowLinks.length}/${externalLinks.length} nofollow`,
      recommendation: t.nofollow.tooFewRecommendation,
      leakAttribute: 'anchors.nofollowRatio',
    };
  }

  return {
    factor: t.nofollow.factor,
    status: 'pass',
    value: `${nofollowLinks.length}/${externalLinks.length} nofollow`,
    recommendation: t.nofollow.passRecommendation,
    leakAttribute: 'anchors.nofollowRatio',
  };
}

function checkHiddenContent(page: ParsedPage, t: Texts): CheckResult {
  if (page.hiddenTextRatio > 0.1) {
    return {
      factor: t.hiddenContent.factor,
      status: 'fail',
      value: t.hiddenContent.hiddenValue(Math.round(page.hiddenTextRatio * 100)),
      recommendation: t.hiddenContent.failRecommendation,
      leakAttribute: 'spamBrain.hiddenText',
    };
  }

  if (page.hiddenTextRatio > 0.05) {
    return {
      factor: t.hiddenContent.factor,
      status: 'warn',
      value: t.hiddenContent.hiddenValue(Math.round(page.hiddenTextRatio * 100)),
      recommendation: t.hiddenContent.warnRecommendation,
      leakAttribute: 'spamBrain.hiddenText',
    };
  }

  return {
    factor: t.hiddenContent.factor,
    status: 'pass',
    value: t.hiddenContent.passValue,
    recommendation: t.hiddenContent.passRecommendation,
    leakAttribute: 'spamBrain.hiddenText',
  };
}

function checkRedirectIntegrity(page: ParsedPage, t: Texts): CheckResult {
  if (page.redirectChain.length > 2) {
    return {
      factor: t.redirect.factor,
      status: 'fail',
      value: t.redirect.hopsValue(page.redirectChain.length),
      recommendation: t.redirect.failRecommendation,
      leakAttribute: 'pagerank.redirectLoss',
    };
  }

  if (page.redirectChain.length > 0) {
    return {
      factor: t.redirect.factor,
      status: 'warn',
      value: t.redirect.redirectsValue(page.redirectChain.length),
      recommendation: t.redirect.warnRecommendation,
      leakAttribute: 'pagerank.redirectLoss',
    };
  }

  return {
    factor: t.redirect.factor,
    status: 'pass',
    value: t.redirect.passValue,
    recommendation: t.redirect.passRecommendation,
    leakAttribute: 'pagerank.redirectLoss',
  };
}
