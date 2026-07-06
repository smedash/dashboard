import { CheckResult, ParsedPage } from '../types';

export function runKeywordRelevanceChecks(page: ParsedPage): CheckResult[] {
  if (!page.keyword) return [];

  const keyword = page.keyword.toLowerCase();
  const checks: CheckResult[] = [];

  checks.push(checkKeywordInTitle(page, keyword));
  checks.push(checkKeywordInH1(page, keyword));
  checks.push(checkKeywordInMetaDescription(page, keyword));
  checks.push(checkKeywordInFirstParagraph(page, keyword));
  checks.push(checkKeywordInUrl(page, keyword));
  checks.push(checkKeywordDensity(page, keyword));

  return checks;
}

function checkKeywordInTitle(page: ParsedPage, keyword: string): CheckResult {
  const title = page.title.toLowerCase();

  if (!title.includes(keyword)) {
    return {
      factor: 'Keyword im Title',
      status: 'fail',
      value: `"${page.keyword}" nicht im Title`,
      recommendation: `Das Fokus-Keyword "${page.keyword}" fehlt im Title-Tag. Google gewichtet Keywords im Title besonders stark (originalTitleHardTokenCount).`,
      leakAttribute: 'titleMatch.keywordPresence',
    };
  }

  const position = title.indexOf(keyword);
  if (position > 30) {
    return {
      factor: 'Keyword im Title',
      status: 'warn',
      value: `Position ${position + 1}`,
      recommendation: `Keyword erst ab Zeichen ${position + 1} im Title. Platziere es möglichst weit vorne für stärkere Relevanz.`,
      leakAttribute: 'titleMatch.keywordPresence',
    };
  }

  return {
    factor: 'Keyword im Title',
    status: 'pass',
    value: `Position ${position + 1}`,
    recommendation: 'Fokus-Keyword ist prominent im Title platziert.',
    leakAttribute: 'titleMatch.keywordPresence',
  };
}

function checkKeywordInH1(page: ParsedPage, keyword: string): CheckResult {
  const h1s = page.headings.filter(h => h.level === 1);

  if (h1s.length === 0) {
    return {
      factor: 'Keyword in H1',
      status: 'fail',
      value: 'Keine H1',
      recommendation: 'Keine H1 vorhanden \u2013 kann Keyword nicht pr\u00fcfen.',
      leakAttribute: 'headings.keywordH1Match',
    };
  }

  const h1Text = h1s.map(h => h.text.toLowerCase()).join(' ');
  if (!h1Text.includes(keyword)) {
    return {
      factor: 'Keyword in H1',
      status: 'fail',
      value: `"${page.keyword}" nicht in H1`,
      recommendation: `Das Fokus-Keyword fehlt in der H1. Die H1 sollte das Hauptthema der Seite klar benennen.`,
      leakAttribute: 'headings.keywordH1Match',
    };
  }

  return {
    factor: 'Keyword in H1',
    status: 'pass',
    value: 'Enthalten',
    recommendation: 'Fokus-Keyword ist in der H1 vorhanden.',
    leakAttribute: 'headings.keywordH1Match',
  };
}

function checkKeywordInMetaDescription(page: ParsedPage, keyword: string): CheckResult {
  if (!page.metaDescription) {
    return {
      factor: 'Keyword in Meta-Description',
      status: 'fail',
      value: 'Keine Meta-Desc',
      recommendation: 'Keine Meta-Description vorhanden.',
      leakAttribute: 'snippet.keywordMatch',
    };
  }

  const desc = page.metaDescription.toLowerCase();
  if (!desc.includes(keyword)) {
    return {
      factor: 'Keyword in Meta-Description',
      status: 'warn',
      value: `"${page.keyword}" nicht enthalten`,
      recommendation: `Das Keyword fehlt in der Meta-Description. Google bolded Keyword-Matches im Snippet, was die CTR erh\u00f6ht.`,
      leakAttribute: 'snippet.keywordMatch',
    };
  }

  return {
    factor: 'Keyword in Meta-Description',
    status: 'pass',
    value: 'Enthalten',
    recommendation: 'Keyword ist in der Meta-Description \u2013 wird im SERP-Snippet hervorgehoben.',
    leakAttribute: 'snippet.keywordMatch',
  };
}

function checkKeywordInFirstParagraph(page: ParsedPage, keyword: string): CheckResult {
  const firstChunk = page.textContent.toLowerCase().slice(0, 500);

  if (!firstChunk.includes(keyword)) {
    return {
      factor: 'Keyword im ersten Absatz',
      status: 'warn',
      value: 'Nicht in den ersten 500 Zeichen',
      recommendation: `Das Keyword erscheint nicht fr\u00fch im Content. Google wertet fr\u00fche Erw\u00e4hnung als Relevanz-Signal (termFrequency/proximity).`,
      leakAttribute: 'termFrequency.earlyMention',
    };
  }

  const position = firstChunk.indexOf(keyword);
  return {
    factor: 'Keyword im ersten Absatz',
    status: 'pass',
    value: `Nach ${position} Zeichen`,
    recommendation: 'Keyword wird fr\u00fch im Content erw\u00e4hnt \u2013 starkes Relevanz-Signal.',
    leakAttribute: 'termFrequency.earlyMention',
  };
}

function checkKeywordInUrl(page: ParsedPage, keyword: string): CheckResult {
  const urlPath = new URL(page.url).pathname.toLowerCase();
  const keywordSlug = keyword.replace(/\s+/g, '-').replace(/[^a-z0-9\-äöüß]/g, '');
  const keywordParts = keyword.split(/\s+/);

  const urlContainsKeyword = urlPath.includes(keywordSlug) ||
    keywordParts.every(part => urlPath.includes(part));

  if (!urlContainsKeyword) {
    return {
      factor: 'Keyword in URL',
      status: 'warn',
      value: 'Nicht in URL-Pfad',
      recommendation: 'Das Keyword ist nicht im URL-Pfad enthalten. Eine sprechende URL mit Keyword st\u00e4rkt das Relevanz-Signal.',
      leakAttribute: 'url.keywordMatch',
    };
  }

  return {
    factor: 'Keyword in URL',
    status: 'pass',
    value: 'In URL enthalten',
    recommendation: 'Keyword ist im URL-Pfad \u2013 gutes Signal f\u00fcr Suchrelevanz.',
    leakAttribute: 'url.keywordMatch',
  };
}

function checkKeywordDensity(page: ParsedPage, keyword: string): CheckResult {
  const text = page.textContent.toLowerCase();
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) {
    return {
      factor: 'Keyword-Dichte (TF)',
      status: 'warn',
      value: null,
      recommendation: 'Nicht genug Text f\u00fcr Analyse.',
      leakAttribute: 'termFrequency.keywordDensity',
    };
  }

  const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const matches = text.match(regex) || [];
  const count = matches.length;
  const density = (count / words.length) * 100;
  const densityRounded = Math.round(density * 10) / 10;

  if (count === 0) {
    return {
      factor: 'Keyword-Dichte (TF)',
      status: 'fail',
      value: '0 Vorkommen',
      recommendation: `Das Keyword "${page.keyword}" kommt im Text nicht vor. Es muss nat\u00fcrlich im Content erw\u00e4hnt werden.`,
      leakAttribute: 'termFrequency.keywordDensity',
    };
  }

  if (density > 3) {
    return {
      factor: 'Keyword-Dichte (TF)',
      status: 'warn',
      value: `${count}x (${densityRounded}%)`,
      recommendation: `Keyword-Dichte von ${densityRounded}% ist hoch. Google's keywordStuffingScore k\u00f6nnte anschlagen. Optimal: 1\u20132%.`,
      leakAttribute: 'termFrequency.keywordDensity',
    };
  }

  if (density < 0.5 && words.length > 300) {
    return {
      factor: 'Keyword-Dichte (TF)',
      status: 'warn',
      value: `${count}x (${densityRounded}%)`,
      recommendation: `Nur ${count} Erw\u00e4hnungen bei ${words.length} W\u00f6rtern (${densityRounded}%). Erh\u00f6he leicht oder nutze semantische Varianten.`,
      leakAttribute: 'termFrequency.keywordDensity',
    };
  }

  return {
    factor: 'Keyword-Dichte (TF)',
    status: 'pass',
    value: `${count}x (${densityRounded}%)`,
    recommendation: 'Keyword-Dichte ist im optimalen Bereich.',
    leakAttribute: 'termFrequency.keywordDensity',
  };
}
