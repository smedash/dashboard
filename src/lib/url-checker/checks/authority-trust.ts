import { CheckResult, ParsedPage } from '../types';

export function runAuthorityTrustChecks(page: ParsedPage): CheckResult[] {
  const checks: CheckResult[] = [];

  checks.push(checkHttpsSecurity(page));
  checks.push(checkNofollowRatio(page));
  checks.push(checkHiddenContent(page));
  checks.push(checkRedirectIntegrity(page));

  return checks;
}

function checkHttpsSecurity(page: ParsedPage): CheckResult {
  if (!page.isHttps) {
    return {
      factor: 'HTTPS-Vertrauen',
      status: 'fail',
      value: 'HTTP',
      recommendation: 'Kein HTTPS. Dies ist ein negatives Trust-Signal in Google\'s NSR-Framework. Migriere zu HTTPS.',
      leakAttribute: 'nsr.trustSignal',
    };
  }

  return {
    factor: 'HTTPS-Vertrauen',
    status: 'pass',
    value: 'HTTPS aktiv',
    recommendation: 'HTTPS ist aktiv \u2013 positives Trust-Signal.',
    leakAttribute: 'nsr.trustSignal',
  };
}

function checkNofollowRatio(page: ParsedPage): CheckResult {
  const externalLinks = page.externalLinks;
  if (externalLinks.length === 0) {
    return {
      factor: 'Externe Links & Nofollow',
      status: 'pass',
      value: 'Keine externen Links',
      recommendation: 'Keine externen Links vorhanden. F\u00fcr Informationsseiten k\u00f6nnen qualitative externe Quellen Vertrauen st\u00e4rken.',
      leakAttribute: 'anchors.nofollowRatio',
    };
  }

  const nofollowLinks = externalLinks.filter(l => l.rel && l.rel.includes('nofollow'));
  const ratio = nofollowLinks.length / externalLinks.length;

  if (ratio > 0.9 && externalLinks.length > 5) {
    return {
      factor: 'Externe Links & Nofollow',
      status: 'warn',
      value: `${nofollowLinks.length}/${externalLinks.length} nofollow`,
      recommendation: 'Fast alle externen Links sind nofollow. Ein nat\u00fcrliches Linkprofil enth\u00e4lt auch dofollow-Links zu vertrauensw\u00fcrdigen Quellen.',
      leakAttribute: 'anchors.nofollowRatio',
    };
  }

  if (ratio < 0.1 && externalLinks.length > 10) {
    return {
      factor: 'Externe Links & Nofollow',
      status: 'warn',
      value: `${nofollowLinks.length}/${externalLinks.length} nofollow`,
      recommendation: 'Kaum nofollow bei externen Links. Setze nofollow f\u00fcr Werbung, Affiliate und nutzergenerierte Links.',
      leakAttribute: 'anchors.nofollowRatio',
    };
  }

  return {
    factor: 'Externe Links & Nofollow',
    status: 'pass',
    value: `${nofollowLinks.length}/${externalLinks.length} nofollow`,
    recommendation: 'Ausgewogene Nofollow-Verteilung bei externen Links.',
    leakAttribute: 'anchors.nofollowRatio',
  };
}

function checkHiddenContent(page: ParsedPage): CheckResult {
  if (page.hiddenTextRatio > 0.1) {
    return {
      factor: 'Versteckte Inhalte',
      status: 'fail',
      value: `${Math.round(page.hiddenTextRatio * 100)}% versteckt`,
      recommendation: 'Hoher Anteil versteckter Elemente (display:none, visibility:hidden). SpamBrain erkennt Hidden-Text-Techniken als Manipulationsversuch.',
      leakAttribute: 'spamBrain.hiddenText',
    };
  }

  if (page.hiddenTextRatio > 0.05) {
    return {
      factor: 'Versteckte Inhalte',
      status: 'warn',
      value: `${Math.round(page.hiddenTextRatio * 100)}% versteckt`,
      recommendation: 'Einige versteckte Elemente erkannt. Stelle sicher, dass dies f\u00fcr UX-Zwecke ist (Akkordeons, Men\u00fcs) und nicht zur Manipulation.',
      leakAttribute: 'spamBrain.hiddenText',
    };
  }

  return {
    factor: 'Versteckte Inhalte',
    status: 'pass',
    value: 'Minimal',
    recommendation: 'Kein auff\u00e4lliger versteckter Content erkannt.',
    leakAttribute: 'spamBrain.hiddenText',
  };
}

function checkRedirectIntegrity(page: ParsedPage): CheckResult {
  if (page.redirectChain.length > 2) {
    return {
      factor: 'Redirect-Integrit\u00e4t',
      status: 'fail',
      value: `${page.redirectChain.length} Hops`,
      recommendation: 'Mehrere Redirects in der Kette. Jeder Redirect kann PageRank-Verlust bedeuten und Crawl-Budget verschwenden.',
      leakAttribute: 'pagerank.redirectLoss',
    };
  }

  if (page.redirectChain.length > 0) {
    return {
      factor: 'Redirect-Integrit\u00e4t',
      status: 'warn',
      value: `${page.redirectChain.length} Redirect(s)`,
      recommendation: 'Redirect erkannt. Verlinke m\u00f6glichst direkt auf die Ziel-URL.',
      leakAttribute: 'pagerank.redirectLoss',
    };
  }

  return {
    factor: 'Redirect-Integrit\u00e4t',
    status: 'pass',
    value: 'Direkt',
    recommendation: 'Kein Redirect \u2013 direkte Erreichbarkeit.',
    leakAttribute: 'pagerank.redirectLoss',
  };
}
