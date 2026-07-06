import { CheckResult, ParsedPage } from '../types';

export function runEntityTopicalityChecks(page: ParsedPage): CheckResult[] {
  const checks: CheckResult[] = [];

  checks.push(checkSchemaMarkup(page));
  checks.push(checkOpenGraph(page));
  checks.push(checkSchemaTypes(page));

  return checks;
}

function checkSchemaMarkup(page: ParsedPage): CheckResult {
  if (page.schemas.length === 0) {
    return {
      factor: 'Strukturierte Daten (JSON-LD)',
      status: 'fail',
      value: 'Kein Schema',
      recommendation: 'Kein JSON-LD/Schema.org Markup gefunden. Strukturierte Daten helfen Google, Entit\u00e4ten und Beziehungen (WebRef) zu erkennen und Rich Snippets zu generieren.',
      leakAttribute: 'webref.entityAnnotations',
    };
  }

  const types = page.schemas.map(s => s.type);

  return {
    factor: 'Strukturierte Daten (JSON-LD)',
    status: 'pass',
    value: types.join(', '),
    recommendation: `Schema.org Typen gefunden: ${types.join(', ')}. Google nutzt diese f\u00fcr Entity-Erkennung und Rich Results.`,
    leakAttribute: 'webref.entityAnnotations',
  };
}

function checkOpenGraph(page: ParsedPage): CheckResult {
  const required = ['og:title', 'og:description', 'og:image', 'og:type'];
  const present = required.filter(key => page.openGraph[key]);
  const missing = required.filter(key => !page.openGraph[key]);

  if (present.length === 0) {
    return {
      factor: 'Open Graph Tags',
      status: 'fail',
      value: 'Keine OG-Tags',
      recommendation: 'Keine Open Graph Tags gefunden. OG-Tags verbessern die Darstellung beim Teilen und signalisieren strukturierte Seiteninformationen.',
      leakAttribute: 'socialMeta.openGraph',
    };
  }

  if (missing.length > 0) {
    return {
      factor: 'Open Graph Tags',
      status: 'warn',
      value: `${present.length}/4 vorhanden`,
      recommendation: `Fehlende OG-Tags: ${missing.join(', ')}. Vervollst\u00e4ndige die Tags f\u00fcr optimale Social-Sharing-Darstellung.`,
      leakAttribute: 'socialMeta.openGraph',
    };
  }

  return {
    factor: 'Open Graph Tags',
    status: 'pass',
    value: `${present.length}/4 vorhanden`,
    recommendation: 'Alle wichtigen Open Graph Tags sind gesetzt.',
    leakAttribute: 'socialMeta.openGraph',
  };
}

function checkSchemaTypes(page: ParsedPage): CheckResult {
  const valuableTypes = ['Article', 'NewsArticle', 'BlogPosting', 'Product', 'FAQPage', 'HowTo', 'Recipe', 'LocalBusiness', 'Organization', 'Person', 'Event', 'Review', 'BreadcrumbList', 'VideoObject'];

  if (page.schemas.length === 0) {
    return {
      factor: 'Rich-Result-f\u00e4hige Schemas',
      status: 'warn',
      value: 'Keine',
      recommendation: 'Kein Rich-Result-f\u00e4higes Schema gefunden. Typen wie Article, FAQ, Product oder HowTo erm\u00f6glichen Rich Snippets in den SERPs.',
      leakAttribute: 'webref.schemaType',
    };
  }

  const types = page.schemas.map(s => s.type);
  const flatTypes = types.flatMap(t => Array.isArray(t) ? t : [t]);
  const found = flatTypes.filter(t => valuableTypes.some(vt => t.includes(vt)));

  if (found.length === 0) {
    return {
      factor: 'Rich-Result-f\u00e4hige Schemas',
      status: 'warn',
      value: flatTypes.join(', '),
      recommendation: `Vorhandene Schemas (${flatTypes.join(', ')}) sind keine typischen Rich-Result-Typen. Erw\u00e4ge Article, FAQ, Product oder HowTo.`,
      leakAttribute: 'webref.schemaType',
    };
  }

  return {
    factor: 'Rich-Result-f\u00e4hige Schemas',
    status: 'pass',
    value: found.join(', '),
    recommendation: `Rich-Result-f\u00e4hige Schemas vorhanden: ${found.join(', ')}.`,
    leakAttribute: 'webref.schemaType',
  };
}
