import type { Locale } from '@/i18n/config';
import { urlCheckerTechnicalMessages } from '@/i18n/messages/url-checker/technical';
import { CheckResult, ParsedPage } from '../types';

type Messages = (typeof urlCheckerTechnicalMessages)[Locale];

export function runTechnicalChecks(page: ParsedPage, locale: Locale): CheckResult[] {
  const t = urlCheckerTechnicalMessages[locale];
  const checks: CheckResult[] = [];

  // 1. Canonical tag
  checks.push(checkCanonical(page, t));

  // 2. Robots meta
  checks.push(checkRobotsMeta(page, t));

  // 3. Viewport meta (mobile)
  checks.push(checkViewport(page, t));

  // 4. HTTPS
  checks.push(checkHttps(page, t));

  // 5. HTML size / DOM complexity
  checks.push(checkHtmlSize(page, t));

  // 6. Redirect chains
  checks.push(checkRedirects(page, t));

  return checks;
}

function checkCanonical(page: ParsedPage, t: Messages): CheckResult {
  if (!page.canonical) {
    return {
      factor: t.canonical.factor,
      status: 'fail',
      value: null,
      recommendation: t.canonical.missing,
      leakAttribute: 'indexing.canonicalUrl',
    };
  }

  const canonicalUrl = page.canonical.startsWith('http') ? page.canonical : new URL(page.canonical, page.url).href;
  const isSelfReferencing = canonicalUrl === page.url || canonicalUrl === page.url.replace(/\/$/, '') || canonicalUrl + '/' === page.url;

  if (!isSelfReferencing) {
    return {
      factor: t.canonical.factor,
      status: 'warn',
      value: page.canonical,
      recommendation: t.canonical.otherUrl(page.canonical),
      leakAttribute: 'indexing.canonicalUrl',
    };
  }

  return {
    factor: t.canonical.factor,
    status: 'pass',
    value: page.canonical,
    recommendation: t.canonical.ok,
    leakAttribute: 'indexing.canonicalUrl',
  };
}

function checkRobotsMeta(page: ParsedPage, t: Messages): CheckResult {
  if (!page.robotsMeta) {
    return {
      factor: t.robots.factor,
      status: 'pass',
      value: t.robots.notSetValue,
      recommendation: t.robots.notSet,
      leakAttribute: 'indexing.robotsMeta',
    };
  }

  const hasNoindex = page.robotsMeta.includes('noindex');
  const hasNofollow = page.robotsMeta.includes('nofollow');

  if (hasNoindex) {
    return {
      factor: t.robots.factor,
      status: 'fail',
      value: page.robotsMeta,
      recommendation: t.robots.noindex,
      leakAttribute: 'indexing.robotsMeta',
    };
  }

  if (hasNofollow) {
    return {
      factor: t.robots.factor,
      status: 'warn',
      value: page.robotsMeta,
      recommendation: t.robots.nofollow,
      leakAttribute: 'indexing.robotsMeta',
    };
  }

  return {
    factor: t.robots.factor,
    status: 'pass',
    value: page.robotsMeta,
    recommendation: t.robots.ok,
    leakAttribute: 'indexing.robotsMeta',
  };
}

function checkViewport(page: ParsedPage, t: Messages): CheckResult {
  if (!page.viewport) {
    return {
      factor: t.viewport.factor,
      status: 'fail',
      value: null,
      recommendation: t.viewport.missing,
      leakAttribute: 'rendering.mobileViewport',
    };
  }

  if (!page.viewport.includes('width=device-width')) {
    return {
      factor: t.viewport.factor,
      status: 'warn',
      value: page.viewport,
      recommendation: t.viewport.noDeviceWidth,
      leakAttribute: 'rendering.mobileViewport',
    };
  }

  return {
    factor: t.viewport.factor,
    status: 'pass',
    value: page.viewport,
    recommendation: t.viewport.ok,
    leakAttribute: 'rendering.mobileViewport',
  };
}

function checkHttps(page: ParsedPage, t: Messages): CheckResult {
  if (!page.isHttps) {
    return {
      factor: t.https.factor,
      status: 'fail',
      value: 'HTTP',
      recommendation: t.https.missing,
      leakAttribute: 'security.isHttps',
    };
  }

  return {
    factor: t.https.factor,
    status: 'pass',
    value: 'HTTPS',
    recommendation: t.https.ok,
    leakAttribute: 'security.isHttps',
  };
}

function checkHtmlSize(page: ParsedPage, t: Messages): CheckResult {
  const sizeKb = Math.round(page.htmlSize / 1024);

  if (sizeKb > 500) {
    return {
      factor: t.htmlSize.factor,
      status: 'fail',
      value: `${sizeKb} KB`,
      recommendation: t.htmlSize.tooLarge(sizeKb),
      leakAttribute: 'indexing.rawSize',
    };
  }

  if (sizeKb > 200) {
    return {
      factor: t.htmlSize.factor,
      status: 'warn',
      value: `${sizeKb} KB`,
      recommendation: t.htmlSize.large(sizeKb),
      leakAttribute: 'indexing.rawSize',
    };
  }

  return {
    factor: t.htmlSize.factor,
    status: 'pass',
    value: `${sizeKb} KB`,
    recommendation: t.htmlSize.ok,
    leakAttribute: 'indexing.rawSize',
  };
}

function checkRedirects(page: ParsedPage, t: Messages): CheckResult {
  const chainLength = page.redirectChain.length;

  if (chainLength > 3) {
    return {
      factor: t.redirects.factor,
      status: 'fail',
      value: t.redirects.countValue(chainLength),
      recommendation: t.redirects.tooMany(chainLength),
      leakAttribute: 'indexing.redirectChain',
    };
  }

  if (chainLength > 1) {
    return {
      factor: t.redirects.factor,
      status: 'warn',
      value: t.redirects.countValue(chainLength),
      recommendation: t.redirects.some(chainLength),
      leakAttribute: 'indexing.redirectChain',
    };
  }

  return {
    factor: t.redirects.factor,
    status: 'pass',
    value: chainLength === 0 ? t.redirects.noneValue : t.redirects.oneValue,
    recommendation: t.redirects.ok,
    leakAttribute: 'indexing.redirectChain',
  };
}
