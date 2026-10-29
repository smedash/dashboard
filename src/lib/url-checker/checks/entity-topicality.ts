import type { Locale } from '@/i18n/config';
import { urlCheckerEntityTopicalityMessages } from '@/i18n/messages/url-checker/entity-topicality';
import { CheckResult, ParsedPage } from '../types';

type Messages = (typeof urlCheckerEntityTopicalityMessages)[Locale];

export function runEntityTopicalityChecks(page: ParsedPage, locale: Locale): CheckResult[] {
  const t = urlCheckerEntityTopicalityMessages[locale];
  const checks: CheckResult[] = [];

  checks.push(checkSchemaMarkup(page, t));
  checks.push(checkOpenGraph(page, t));
  checks.push(checkSchemaTypes(page, t));

  return checks;
}

function checkSchemaMarkup(page: ParsedPage, t: Messages): CheckResult {
  if (page.schemas.length === 0) {
    return {
      factor: t.schemaMarkup.factor,
      status: 'fail',
      value: t.schemaMarkup.noneValue,
      recommendation: t.schemaMarkup.missing,
      leakAttribute: 'webref.entityAnnotations',
    };
  }

  const types = page.schemas.map(s => s.type);

  return {
    factor: t.schemaMarkup.factor,
    status: 'pass',
    value: types.join(', '),
    recommendation: t.schemaMarkup.found(types.join(', ')),
    leakAttribute: 'webref.entityAnnotations',
  };
}

function checkOpenGraph(page: ParsedPage, t: Messages): CheckResult {
  const required = ['og:title', 'og:description', 'og:image', 'og:type'];
  const present = required.filter(key => page.openGraph[key]);
  const missing = required.filter(key => !page.openGraph[key]);

  if (present.length === 0) {
    return {
      factor: t.openGraph.factor,
      status: 'fail',
      value: t.openGraph.noneValue,
      recommendation: t.openGraph.none,
      leakAttribute: 'socialMeta.openGraph',
    };
  }

  if (missing.length > 0) {
    return {
      factor: t.openGraph.factor,
      status: 'warn',
      value: t.openGraph.presentValue(present.length),
      recommendation: t.openGraph.missing(missing.join(', ')),
      leakAttribute: 'socialMeta.openGraph',
    };
  }

  return {
    factor: t.openGraph.factor,
    status: 'pass',
    value: t.openGraph.presentValue(present.length),
    recommendation: t.openGraph.ok,
    leakAttribute: 'socialMeta.openGraph',
  };
}

function checkSchemaTypes(page: ParsedPage, t: Messages): CheckResult {
  const valuableTypes = ['Article', 'NewsArticle', 'BlogPosting', 'Product', 'FAQPage', 'HowTo', 'Recipe', 'LocalBusiness', 'Organization', 'Person', 'Event', 'Review', 'BreadcrumbList', 'VideoObject'];

  if (page.schemas.length === 0) {
    return {
      factor: t.schemaTypes.factor,
      status: 'warn',
      value: t.schemaTypes.noneValue,
      recommendation: t.schemaTypes.none,
      leakAttribute: 'webref.schemaType',
    };
  }

  const types = page.schemas.map(s => s.type);
  const flatTypes = types.flatMap(type => Array.isArray(type) ? type : [type]);
  const found = flatTypes.filter(type => valuableTypes.some(vt => type.includes(vt)));

  if (found.length === 0) {
    return {
      factor: t.schemaTypes.factor,
      status: 'warn',
      value: flatTypes.join(', '),
      recommendation: t.schemaTypes.notRichResult(flatTypes.join(', ')),
      leakAttribute: 'webref.schemaType',
    };
  }

  return {
    factor: t.schemaTypes.factor,
    status: 'pass',
    value: found.join(', '),
    recommendation: t.schemaTypes.ok(found.join(', ')),
    leakAttribute: 'webref.schemaType',
  };
}
