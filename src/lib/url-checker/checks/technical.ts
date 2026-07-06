import { CheckResult, ParsedPage } from '../types';

export function runTechnicalChecks(page: ParsedPage): CheckResult[] {
  const checks: CheckResult[] = [];

  // 1. Canonical tag
  checks.push(checkCanonical(page));

  // 2. Robots meta
  checks.push(checkRobotsMeta(page));

  // 3. Viewport meta (mobile)
  checks.push(checkViewport(page));

  // 4. HTTPS
  checks.push(checkHttps(page));

  // 5. HTML size / DOM complexity
  checks.push(checkHtmlSize(page));

  // 6. Redirect chains
  checks.push(checkRedirects(page));

  return checks;
}

function checkCanonical(page: ParsedPage): CheckResult {
  if (!page.canonical) {
    return {
      factor: 'Canonical-Tag',
      status: 'fail',
      value: null,
      recommendation: 'Kein Canonical-Tag gefunden. Setze einen self-referencing Canonical, um Duplicate Content zu vermeiden.',
      leakAttribute: 'indexing.canonicalUrl',
    };
  }

  const canonicalUrl = page.canonical.startsWith('http') ? page.canonical : new URL(page.canonical, page.url).href;
  const isSelfReferencing = canonicalUrl === page.url || canonicalUrl === page.url.replace(/\/$/, '') || canonicalUrl + '/' === page.url;

  if (!isSelfReferencing) {
    return {
      factor: 'Canonical-Tag',
      status: 'warn',
      value: page.canonical,
      recommendation: `Canonical verweist auf eine andere URL (${page.canonical}). Stelle sicher, dass dies beabsichtigt ist.`,
      leakAttribute: 'indexing.canonicalUrl',
    };
  }

  return {
    factor: 'Canonical-Tag',
    status: 'pass',
    value: page.canonical,
    recommendation: 'Self-referencing Canonical korrekt gesetzt.',
    leakAttribute: 'indexing.canonicalUrl',
  };
}

function checkRobotsMeta(page: ParsedPage): CheckResult {
  if (!page.robotsMeta) {
    return {
      factor: 'Robots-Meta',
      status: 'pass',
      value: 'nicht gesetzt (Standard: index, follow)',
      recommendation: 'Kein Robots-Meta-Tag gesetzt \u2013 Seite ist standardm\u00e4\u00dfig indexierbar.',
      leakAttribute: 'indexing.robotsMeta',
    };
  }

  const hasNoindex = page.robotsMeta.includes('noindex');
  const hasNofollow = page.robotsMeta.includes('nofollow');

  if (hasNoindex) {
    return {
      factor: 'Robots-Meta',
      status: 'fail',
      value: page.robotsMeta,
      recommendation: 'Seite ist auf noindex gesetzt und wird nicht indexiert. Entferne noindex, wenn die Seite ranken soll.',
      leakAttribute: 'indexing.robotsMeta',
    };
  }

  if (hasNofollow) {
    return {
      factor: 'Robots-Meta',
      status: 'warn',
      value: page.robotsMeta,
      recommendation: 'nofollow verhindert, dass Google den Links auf dieser Seite folgt. Das kann die interne Verlinkungsstruktur schw\u00e4chen.',
      leakAttribute: 'indexing.robotsMeta',
    };
  }

  return {
    factor: 'Robots-Meta',
    status: 'pass',
    value: page.robotsMeta,
    recommendation: 'Robots-Meta erlaubt Indexierung und Link-Following.',
    leakAttribute: 'indexing.robotsMeta',
  };
}

function checkViewport(page: ParsedPage): CheckResult {
  if (!page.viewport) {
    return {
      factor: 'Viewport-Meta (Mobile)',
      status: 'fail',
      value: null,
      recommendation: 'Kein Viewport-Meta-Tag gefunden. Mobile-First-Indexing erfordert ein responsives Layout mit viewport-Tag.',
      leakAttribute: 'rendering.mobileViewport',
    };
  }

  if (!page.viewport.includes('width=device-width')) {
    return {
      factor: 'Viewport-Meta (Mobile)',
      status: 'warn',
      value: page.viewport,
      recommendation: 'Viewport-Tag ist gesetzt, aber enth\u00e4lt nicht "width=device-width". Optimiere f\u00fcr mobile Ger\u00e4te.',
      leakAttribute: 'rendering.mobileViewport',
    };
  }

  return {
    factor: 'Viewport-Meta (Mobile)',
    status: 'pass',
    value: page.viewport,
    recommendation: 'Viewport korrekt f\u00fcr Mobile-First-Indexing konfiguriert.',
    leakAttribute: 'rendering.mobileViewport',
  };
}

function checkHttps(page: ParsedPage): CheckResult {
  if (!page.isHttps) {
    return {
      factor: 'HTTPS',
      status: 'fail',
      value: 'HTTP',
      recommendation: 'Die Seite verwendet kein HTTPS. Google bevorzugt verschl\u00fcsselte Seiten als Vertrauenssignal.',
      leakAttribute: 'security.isHttps',
    };
  }

  return {
    factor: 'HTTPS',
    status: 'pass',
    value: 'HTTPS',
    recommendation: 'Seite nutzt HTTPS \u2013 Vertrauenssignal erf\u00fcllt.',
    leakAttribute: 'security.isHttps',
  };
}

function checkHtmlSize(page: ParsedPage): CheckResult {
  const sizeKb = Math.round(page.htmlSize / 1024);

  if (sizeKb > 500) {
    return {
      factor: 'HTML-Gr\u00f6\u00dfe',
      status: 'fail',
      value: `${sizeKb} KB`,
      recommendation: `HTML ist ${sizeKb} KB gro\u00df (empfohlen: < 200 KB). Gro\u00dfe Dokumente verlangsamen Crawling und Rendering.`,
      leakAttribute: 'indexing.rawSize',
    };
  }

  if (sizeKb > 200) {
    return {
      factor: 'HTML-Gr\u00f6\u00dfe',
      status: 'warn',
      value: `${sizeKb} KB`,
      recommendation: `HTML ist ${sizeKb} KB. Versuche unter 200 KB zu bleiben f\u00fcr schnelleres Crawling.`,
      leakAttribute: 'indexing.rawSize',
    };
  }

  return {
    factor: 'HTML-Gr\u00f6\u00dfe',
    status: 'pass',
    value: `${sizeKb} KB`,
    recommendation: 'HTML-Gr\u00f6\u00dfe ist optimal f\u00fcr schnelles Crawling.',
    leakAttribute: 'indexing.rawSize',
  };
}

function checkRedirects(page: ParsedPage): CheckResult {
  const chainLength = page.redirectChain.length;

  if (chainLength > 3) {
    return {
      factor: 'Redirect-Ketten',
      status: 'fail',
      value: `${chainLength} Weiterleitungen`,
      recommendation: `${chainLength} Redirects in der Kette. Google folgt maximal 5 Redirects, aber jeder kostet Crawl-Budget.`,
      leakAttribute: 'indexing.redirectChain',
    };
  }

  if (chainLength > 1) {
    return {
      factor: 'Redirect-Ketten',
      status: 'warn',
      value: `${chainLength} Weiterleitungen`,
      recommendation: `${chainLength} Redirects erkannt. Versuche, direkte URLs ohne Weiterleitungen zu verwenden.`,
      leakAttribute: 'indexing.redirectChain',
    };
  }

  return {
    factor: 'Redirect-Ketten',
    status: 'pass',
    value: chainLength === 0 ? 'Keine' : '1 Weiterleitung',
    recommendation: 'Keine problematischen Redirect-Ketten.',
    leakAttribute: 'indexing.redirectChain',
  };
}
