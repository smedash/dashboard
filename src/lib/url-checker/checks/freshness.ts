import { CheckResult, ParsedPage } from '../types';

export function runFreshnessChecks(page: ParsedPage): CheckResult[] {
  const checks: CheckResult[] = [];

  checks.push(checkPublishedDate(page));
  checks.push(checkModifiedDate(page));
  checks.push(checkLastModifiedHeader(page));

  return checks;
}

function checkPublishedDate(page: ParsedPage): CheckResult {
  if (!page.dates.published) {
    return {
      factor: 'Ver\u00f6ffentlichungsdatum',
      status: 'warn',
      value: null,
      recommendation: 'Kein datePublished in Schema oder Meta-Tags gefunden. Google\'s FreshnessTwiddler nutzt Datumsangaben zur Freshness-Bewertung.',
      leakAttribute: 'freshnessTwiddler.datePublished',
    };
  }

  const pubDate = new Date(page.dates.published);
  if (isNaN(pubDate.getTime())) {
    return {
      factor: 'Ver\u00f6ffentlichungsdatum',
      status: 'warn',
      value: page.dates.published,
      recommendation: 'Datumsformat nicht parsebar. Verwende ISO 8601 (YYYY-MM-DD) f\u00fcr eindeutige Interpretation.',
      leakAttribute: 'freshnessTwiddler.datePublished',
    };
  }

  const ageInDays = Math.floor((Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24));

  if (ageInDays > 730) {
    return {
      factor: 'Ver\u00f6ffentlichungsdatum',
      status: 'warn',
      value: `${page.dates.published} (${ageInDays} Tage alt)`,
      recommendation: `Content ist \u00fcber 2 Jahre alt. F\u00fcr zeitkritische Themen empfiehlt sich ein regelm\u00e4\u00dfiges Update (LastSignificantUpdate-Signal).`,
      leakAttribute: 'freshnessTwiddler.datePublished',
    };
  }

  return {
    factor: 'Ver\u00f6ffentlichungsdatum',
    status: 'pass',
    value: page.dates.published,
    recommendation: 'Ver\u00f6ffentlichungsdatum vorhanden und aktuell.',
    leakAttribute: 'freshnessTwiddler.datePublished',
  };
}

function checkModifiedDate(page: ParsedPage): CheckResult {
  if (!page.dates.modified) {
    return {
      factor: '\u00c4nderungsdatum (dateModified)',
      status: 'warn',
      value: null,
      recommendation: 'Kein dateModified gefunden. Google nutzt LastSignificantUpdate um zu erkennen, ob Content aktualisiert wurde. Setze dateModified bei echten Inhalts\u00e4nderungen.',
      leakAttribute: 'lastSignificantUpdate',
    };
  }

  const modDate = new Date(page.dates.modified);
  if (isNaN(modDate.getTime())) {
    return {
      factor: '\u00c4nderungsdatum (dateModified)',
      status: 'warn',
      value: page.dates.modified,
      recommendation: 'Datumsformat nicht parsebar. Verwende ISO 8601.',
      leakAttribute: 'lastSignificantUpdate',
    };
  }

  const ageInDays = Math.floor((Date.now() - modDate.getTime()) / (1000 * 60 * 60 * 24));

  if (ageInDays > 365) {
    return {
      factor: '\u00c4nderungsdatum (dateModified)',
      status: 'warn',
      value: `${page.dates.modified} (${ageInDays} Tage seit letzter \u00c4nderung)`,
      recommendation: 'Letzte \u00c4nderung ist \u00fcber 1 Jahr her. Regelm\u00e4\u00dfige Updates (mindestens quartalsweise) senden positive Freshness-Signale.',
      leakAttribute: 'lastSignificantUpdate',
    };
  }

  return {
    factor: '\u00c4nderungsdatum (dateModified)',
    status: 'pass',
    value: page.dates.modified,
    recommendation: 'Content wurde k\u00fcrzlich aktualisiert \u2013 gutes Freshness-Signal.',
    leakAttribute: 'lastSignificantUpdate',
  };
}

function checkLastModifiedHeader(page: ParsedPage): CheckResult {
  if (!page.dates.lastModifiedHeader) {
    return {
      factor: 'Last-Modified Header',
      status: 'warn',
      value: null,
      recommendation: 'Kein Last-Modified HTTP-Header gesetzt. Dieser hilft Googlebot beim effizienten Crawling (Conditional GET).',
      leakAttribute: 'crawl.lastModifiedHeader',
    };
  }

  return {
    factor: 'Last-Modified Header',
    status: 'pass',
    value: page.dates.lastModifiedHeader,
    recommendation: 'Last-Modified Header vorhanden \u2013 unterst\u00fctzt effizientes Crawling.',
    leakAttribute: 'crawl.lastModifiedHeader',
  };
}
