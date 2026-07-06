import { CheckResult, ParsedPage } from '../types';

export function runHreflangChecks(page: ParsedPage): CheckResult[] {
  const checks: CheckResult[] = [];

  checks.push(checkHreflangPresence(page));
  checks.push(checkHreflangSelfReference(page));
  checks.push(checkHreflangXDefault(page));

  return checks;
}

function checkHreflangPresence(page: ParsedPage): CheckResult {
  if (page.hreflang.length === 0) {
    return {
      factor: 'Hreflang-Tags',
      status: 'warn',
      value: 'Keine',
      recommendation: 'Keine Hreflang-Tags gefunden. Wenn die Seite in mehreren Sprachen/Regionen existiert, setze Hreflang f\u00fcr korrekte Internationalisierung.',
      leakAttribute: 'indexing.hreflang',
    };
  }

  const langs = page.hreflang.map(h => h.lang);
  return {
    factor: 'Hreflang-Tags',
    status: 'pass',
    value: `${page.hreflang.length} Sprachen: ${langs.join(', ')}`,
    recommendation: 'Hreflang-Tags vorhanden f\u00fcr internationale Ausrichtung.',
    leakAttribute: 'indexing.hreflang',
  };
}

function checkHreflangSelfReference(page: ParsedPage): CheckResult {
  if (page.hreflang.length === 0) {
    return {
      factor: 'Hreflang Self-Referenz',
      status: 'pass',
      value: 'N/A (keine Hreflangs)',
      recommendation: 'Keine Hreflang-Tags vorhanden \u2013 Self-Referenz nicht relevant.',
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
      factor: 'Hreflang Self-Referenz',
      status: 'fail',
      value: 'Fehlend',
      recommendation: 'Jede Seite mit Hreflang muss sich selbst referenzieren (Self-Referencing). Ohne dies kann Google die Hreflang-Konfiguration ignorieren.',
      leakAttribute: 'indexing.hreflangSelfRef',
    };
  }

  return {
    factor: 'Hreflang Self-Referenz',
    status: 'pass',
    value: 'Vorhanden',
    recommendation: 'Self-referencing Hreflang korrekt implementiert.',
    leakAttribute: 'indexing.hreflangSelfRef',
  };
}

function checkHreflangXDefault(page: ParsedPage): CheckResult {
  if (page.hreflang.length === 0) {
    return {
      factor: 'x-default Hreflang',
      status: 'pass',
      value: 'N/A',
      recommendation: 'Keine Hreflang-Tags \u2013 x-default nicht relevant.',
      leakAttribute: 'indexing.hreflangXDefault',
    };
  }

  const hasXDefault = page.hreflang.some(h => h.lang === 'x-default');

  if (!hasXDefault) {
    return {
      factor: 'x-default Hreflang',
      status: 'warn',
      value: 'Fehlend',
      recommendation: 'Kein x-default Hreflang gesetzt. Dieses Tag teilt Google mit, welche Version f\u00fcr Nutzer ohne passende Sprachversion angezeigt werden soll.',
      leakAttribute: 'indexing.hreflangXDefault',
    };
  }

  return {
    factor: 'x-default Hreflang',
    status: 'pass',
    value: 'Gesetzt',
    recommendation: 'x-default Fallback korrekt konfiguriert.',
    leakAttribute: 'indexing.hreflangXDefault',
  };
}
