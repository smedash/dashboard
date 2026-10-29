import type { Locale } from '@/i18n/config';
import { urlCheckerSpamRiskMessages } from '@/i18n/messages/url-checker/spam-risk';
import { CheckResult, ParsedPage } from '../types';

type Texts = (typeof urlCheckerSpamRiskMessages)[Locale];

export function runSpamRiskChecks(page: ParsedPage, locale: Locale): CheckResult[] {
  const t = urlCheckerSpamRiskMessages[locale];
  const checks: CheckResult[] = [];

  checks.push(checkExactMatchDomain(page, t));
  checks.push(checkThinContent(page, t));
  checks.push(checkLinkSpamSignals(page, t));
  checks.push(checkCloakingIndicators(page, t));

  return checks;
}

function checkExactMatchDomain(page: ParsedPage, t: Texts): CheckResult {
  const url = new URL(page.url);
  const domain = url.hostname.replace(/^www\./, '');
  const parts = domain.split('.');
  const sld = parts[0]; // second-level domain

  // Check if domain looks like an exact-match keyword domain
  const hyphenCount = (sld.match(/-/g) || []).length;
  const isLikelyEMD = hyphenCount >= 2 && sld.length > 15;

  if (isLikelyEMD) {
    return {
      factor: t.exactMatchDomain.factor,
      status: 'warn',
      value: domain,
      recommendation: t.exactMatchDomain.warnRecommendation(domain),
      leakAttribute: 'exactMatchDomainDemotion',
    };
  }

  return {
    factor: t.exactMatchDomain.factor,
    status: 'pass',
    value: domain,
    recommendation: t.exactMatchDomain.passRecommendation,
    leakAttribute: 'exactMatchDomainDemotion',
  };
}

function checkThinContent(page: ParsedPage, t: Texts): CheckResult {
  const textToHtmlRatio = page.textContent.length / Math.max(page.htmlSize, 1);

  if (page.wordCount < 100 && page.htmlSize > 10000) {
    return {
      factor: t.thinContent.factor,
      status: 'fail',
      value: t.thinContent.wordsRatioValue(page.wordCount, Math.round(textToHtmlRatio * 100)),
      recommendation: t.thinContent.failRecommendation,
      leakAttribute: 'spamBrain.thinContent',
    };
  }

  if (textToHtmlRatio < 0.05 && page.htmlSize > 20000) {
    return {
      factor: t.thinContent.factor,
      status: 'warn',
      value: t.thinContent.ratioValue(Math.round(textToHtmlRatio * 100)),
      recommendation: t.thinContent.warnRecommendation,
      leakAttribute: 'spamBrain.thinContent',
    };
  }

  return {
    factor: t.thinContent.factor,
    status: 'pass',
    value: t.thinContent.ratioValue(Math.round(textToHtmlRatio * 100)),
    recommendation: t.thinContent.passRecommendation,
    leakAttribute: 'spamBrain.thinContent',
  };
}

function checkLinkSpamSignals(page: ParsedPage, t: Texts): CheckResult {
  const externalLinks = page.externalLinks;
  if (externalLinks.length === 0) {
    return {
      factor: t.linkSpam.factor,
      status: 'pass',
      value: t.linkSpam.noLinksValue,
      recommendation: t.linkSpam.noLinksRecommendation,
      leakAttribute: 'spamrank.outboundLinks',
    };
  }

  // Check for suspicious patterns
  const suspiciousPatterns = ['casino', 'loan', 'pharma', 'viagra', 'crypto', 'forex', 'bet', 'slot'];
  const suspiciousLinks = externalLinks.filter(l =>
    suspiciousPatterns.some(p => l.href.toLowerCase().includes(p) || l.text.toLowerCase().includes(p))
  );

  // Check for excessive external links
  const externalToInternalRatio = externalLinks.length / Math.max(page.internalLinks.length, 1);

  if (suspiciousLinks.length > 0) {
    return {
      factor: t.linkSpam.factor,
      status: 'fail',
      value: t.linkSpam.suspiciousValue(suspiciousLinks.length),
      recommendation: t.linkSpam.suspiciousRecommendation(suspiciousLinks.length),
      leakAttribute: 'spamrank.outboundLinks',
    };
  }

  if (externalToInternalRatio > 3 && externalLinks.length > 20) {
    return {
      factor: t.linkSpam.factor,
      status: 'warn',
      value: t.linkSpam.ratioValue(externalLinks.length, page.internalLinks.length),
      recommendation: t.linkSpam.ratioRecommendation,
      leakAttribute: 'spamrank.outboundLinks',
    };
  }

  return {
    factor: t.linkSpam.factor,
    status: 'pass',
    value: t.linkSpam.passValue(externalLinks.length),
    recommendation: t.linkSpam.passRecommendation,
    leakAttribute: 'spamrank.outboundLinks',
  };
}

function checkCloakingIndicators(page: ParsedPage, t: Texts): CheckResult {
  // Check for common cloaking indicators in HTML
  let cloakingSignals = 0;

  // User-agent sniffing in scripts
  const uaSniffing = page.textContent.match(/navigator\.userAgent/gi) || [];
  if (uaSniffing.length > 2) cloakingSignals++;

  // Excessive redirects via JS
  const jsRedirects = page.textContent.match(/window\.location|document\.location|location\.href/gi) || [];
  if (jsRedirects.length > 3) cloakingSignals++;

  // Hidden iframes
  const hiddenIframes = page.hiddenTextRatio > 0.15;
  if (hiddenIframes) cloakingSignals++;

  if (cloakingSignals >= 2) {
    return {
      factor: t.cloaking.factor,
      status: 'fail',
      value: t.cloaking.signalsValue(cloakingSignals),
      recommendation: t.cloaking.failRecommendation,
      leakAttribute: 'spamBrain.cloaking',
    };
  }

  if (cloakingSignals === 1) {
    return {
      factor: t.cloaking.factor,
      status: 'warn',
      value: t.cloaking.oneSignalValue,
      recommendation: t.cloaking.warnRecommendation,
      leakAttribute: 'spamBrain.cloaking',
    };
  }

  return {
    factor: t.cloaking.factor,
    status: 'pass',
    value: t.cloaking.noneValue,
    recommendation: t.cloaking.passRecommendation,
    leakAttribute: 'spamBrain.cloaking',
  };
}
