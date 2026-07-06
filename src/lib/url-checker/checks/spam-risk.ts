import { CheckResult, ParsedPage } from '../types';

export function runSpamRiskChecks(page: ParsedPage): CheckResult[] {
  const checks: CheckResult[] = [];

  checks.push(checkExactMatchDomain(page));
  checks.push(checkThinContent(page));
  checks.push(checkLinkSpamSignals(page));
  checks.push(checkCloakingIndicators(page));

  return checks;
}

function checkExactMatchDomain(page: ParsedPage): CheckResult {
  const url = new URL(page.url);
  const domain = url.hostname.replace(/^www\./, '');
  const parts = domain.split('.');
  const sld = parts[0]; // second-level domain

  // Check if domain looks like an exact-match keyword domain
  const hyphenCount = (sld.match(/-/g) || []).length;
  const isLikelyEMD = hyphenCount >= 2 && sld.length > 15;

  if (isLikelyEMD) {
    return {
      factor: 'Exact-Match-Domain (EMD)',
      status: 'warn',
      value: domain,
      recommendation: `Domain "${domain}" sieht nach einer Exact-Match-Domain aus. Google's exactMatchDomainDemotion kann solche Domains abstrafen.`,
      leakAttribute: 'exactMatchDomainDemotion',
    };
  }

  return {
    factor: 'Exact-Match-Domain (EMD)',
    status: 'pass',
    value: domain,
    recommendation: 'Keine auff\u00e4llige Exact-Match-Domain erkannt.',
    leakAttribute: 'exactMatchDomainDemotion',
  };
}

function checkThinContent(page: ParsedPage): CheckResult {
  const textToHtmlRatio = page.textContent.length / Math.max(page.htmlSize, 1);

  if (page.wordCount < 100 && page.htmlSize > 10000) {
    return {
      factor: 'Thin Content Risiko',
      status: 'fail',
      value: `${page.wordCount} W\u00f6rter, Ratio: ${Math.round(textToHtmlRatio * 100)}%`,
      recommendation: 'Sehr wenig sichtbarer Text im Verh\u00e4ltnis zum HTML. SpamBrain erkennt Thin Content Patterns die auf automatisch generierte oder manipulative Seiten hindeuten.',
      leakAttribute: 'spamBrain.thinContent',
    };
  }

  if (textToHtmlRatio < 0.05 && page.htmlSize > 20000) {
    return {
      factor: 'Thin Content Risiko',
      status: 'warn',
      value: `Text/HTML-Ratio: ${Math.round(textToHtmlRatio * 100)}%`,
      recommendation: 'Niedriges Text-zu-HTML-Verh\u00e4ltnis. Viel Code/Markup im Verh\u00e4ltnis zum sichtbaren Inhalt kann ein negatives Signal sein.',
      leakAttribute: 'spamBrain.thinContent',
    };
  }

  return {
    factor: 'Thin Content Risiko',
    status: 'pass',
    value: `Text/HTML-Ratio: ${Math.round(textToHtmlRatio * 100)}%`,
    recommendation: 'Gesundes Text-zu-HTML-Verh\u00e4ltnis.',
    leakAttribute: 'spamBrain.thinContent',
  };
}

function checkLinkSpamSignals(page: ParsedPage): CheckResult {
  const externalLinks = page.externalLinks;
  if (externalLinks.length === 0) {
    return {
      factor: 'Link-Spam-Signale',
      status: 'pass',
      value: 'Keine externen Links',
      recommendation: 'Keine externen Links \u2013 kein Link-Spam-Risiko.',
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
      factor: 'Link-Spam-Signale',
      status: 'fail',
      value: `${suspiciousLinks.length} verd\u00e4chtige Links`,
      recommendation: `${suspiciousLinks.length} Links zu potentiell spam-relevanten Domains erkannt. Google's spamrank bewertet ausgehende Links zu bekannten Spam-Seiten.`,
      leakAttribute: 'spamrank.outboundLinks',
    };
  }

  if (externalToInternalRatio > 3 && externalLinks.length > 20) {
    return {
      factor: 'Link-Spam-Signale',
      status: 'warn',
      value: `${externalLinks.length} extern vs ${page.internalLinks.length} intern`,
      recommendation: 'Unnat\u00fcrlich viele externe Links im Verh\u00e4ltnis zu internen. Das kann als Link-Selling-Signal gewertet werden.',
      leakAttribute: 'spamrank.outboundLinks',
    };
  }

  return {
    factor: 'Link-Spam-Signale',
    status: 'pass',
    value: `${externalLinks.length} extern, Ratio ok`,
    recommendation: 'Keine Link-Spam-Signale erkannt.',
    leakAttribute: 'spamrank.outboundLinks',
  };
}

function checkCloakingIndicators(page: ParsedPage): CheckResult {
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
      factor: 'Cloaking-Indikatoren',
      status: 'fail',
      value: `${cloakingSignals} Signale`,
      recommendation: 'Mehrere Cloaking-verdächtige Muster erkannt (UA-Sniffing, JS-Redirects, versteckte Elemente). SpamBrain erkennt Cloaking als schweren Verstoß.',
      leakAttribute: 'spamBrain.cloaking',
    };
  }

  if (cloakingSignals === 1) {
    return {
      factor: 'Cloaking-Indikatoren',
      status: 'warn',
      value: '1 Signal',
      recommendation: 'Ein potentielles Cloaking-Signal erkannt. Stelle sicher, dass alle Inhalte für Googlebot und Nutzer identisch sind.',
      leakAttribute: 'spamBrain.cloaking',
    };
  }

  return {
    factor: 'Cloaking-Indikatoren',
    status: 'pass',
    value: 'Keine',
    recommendation: 'Keine Cloaking-Indikatoren gefunden.',
    leakAttribute: 'spamBrain.cloaking',
  };
}
