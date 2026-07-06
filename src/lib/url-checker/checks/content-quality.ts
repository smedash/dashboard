import { CheckResult, ParsedPage } from '../types';

export function runContentQualityChecks(page: ParsedPage): CheckResult[] {
  const checks: CheckResult[] = [];

  checks.push(checkTitle(page));
  checks.push(checkMetaDescription(page));
  checks.push(checkH1(page));
  checks.push(checkHeadingHierarchy(page));
  checks.push(checkWordCount(page));
  checks.push(checkKeywordStuffing(page));
  checks.push(checkImageAlts(page));
  checks.push(checkLinkRatio(page));

  return checks;
}

function checkTitle(page: ParsedPage): CheckResult {
  if (!page.title) {
    return {
      factor: 'Title-Tag',
      status: 'fail',
      value: null,
      recommendation: 'Kein Title-Tag gefunden. Der Title ist einer der wichtigsten On-Page-Faktoren.',
      leakAttribute: 'originalTitleHardTokenCount',
    };
  }

  const length = page.title.length;

  if (length < 30) {
    return {
      factor: 'Title-Tag',
      status: 'warn',
      value: `${length} Zeichen`,
      recommendation: `Title ist zu kurz (${length} Zeichen). Optimal sind 50\u201360 Zeichen f\u00fcr maximale SERP-Sichtbarkeit.`,
      leakAttribute: 'originalTitleHardTokenCount',
    };
  }

  if (length > 60) {
    return {
      factor: 'Title-Tag',
      status: 'warn',
      value: `${length} Zeichen`,
      recommendation: `Title ist zu lang (${length} Zeichen) und wird in den SERPs abgeschnitten. Optimal: 50\u201360 Zeichen.`,
      leakAttribute: 'originalTitleHardTokenCount',
    };
  }

  return {
    factor: 'Title-Tag',
    status: 'pass',
    value: `${length} Zeichen`,
    recommendation: 'Title-L\u00e4nge ist optimal.',
    leakAttribute: 'originalTitleHardTokenCount',
  };
}

function checkMetaDescription(page: ParsedPage): CheckResult {
  if (!page.metaDescription) {
    return {
      factor: 'Meta-Description',
      status: 'fail',
      value: null,
      recommendation: 'Keine Meta-Description vorhanden. Google nutzt sie h\u00e4ufig als Snippet \u2013 eine gute Description erh\u00f6ht die CTR.',
      leakAttribute: 'snippet.metaDescription',
    };
  }

  const length = page.metaDescription.length;

  if (length < 70) {
    return {
      factor: 'Meta-Description',
      status: 'warn',
      value: `${length} Zeichen`,
      recommendation: `Meta-Description ist kurz (${length} Zeichen). Nutze 120\u2013155 Zeichen f\u00fcr optimale SERP-Darstellung.`,
      leakAttribute: 'snippet.metaDescription',
    };
  }

  if (length > 160) {
    return {
      factor: 'Meta-Description',
      status: 'warn',
      value: `${length} Zeichen`,
      recommendation: `Meta-Description ist zu lang (${length} Zeichen) und wird abgeschnitten. Optimal: 120\u2013155 Zeichen.`,
      leakAttribute: 'snippet.metaDescription',
    };
  }

  return {
    factor: 'Meta-Description',
    status: 'pass',
    value: `${length} Zeichen`,
    recommendation: 'Meta-Description hat eine gute L\u00e4nge.',
    leakAttribute: 'snippet.metaDescription',
  };
}

function checkH1(page: ParsedPage): CheckResult {
  const h1s = page.headings.filter(h => h.level === 1);

  if (h1s.length === 0) {
    return {
      factor: 'H1-\u00dcberschrift',
      status: 'fail',
      value: 'Keine H1',
      recommendation: 'Keine H1-\u00dcberschrift gefunden. Jede Seite braucht genau eine H1 als Haupt\u00fcberschrift.',
      leakAttribute: 'headings.h1Count',
    };
  }

  if (h1s.length > 1) {
    return {
      factor: 'H1-\u00dcberschrift',
      status: 'warn',
      value: `${h1s.length} H1-Tags`,
      recommendation: `${h1s.length} H1-Tags gefunden. Verwende nur eine H1 pro Seite f\u00fcr klare Hierarchie.`,
      leakAttribute: 'headings.h1Count',
    };
  }

  return {
    factor: 'H1-\u00dcberschrift',
    status: 'pass',
    value: h1s[0].text.slice(0, 80),
    recommendation: 'Genau eine H1-\u00dcberschrift vorhanden.',
    leakAttribute: 'headings.h1Count',
  };
}

function checkHeadingHierarchy(page: ParsedPage): CheckResult {
  if (page.headings.length === 0) {
    return {
      factor: 'Heading-Hierarchie',
      status: 'fail',
      value: '0 Headings',
      recommendation: 'Keine Headings gefunden. Nutze H1\u2013H6 f\u00fcr eine klare Content-Struktur.',
      leakAttribute: 'headings.structure',
    };
  }

  let hasSkips = false;
  let prevLevel = 0;
  for (const h of page.headings) {
    if (prevLevel > 0 && h.level > prevLevel + 1) {
      hasSkips = true;
      break;
    }
    prevLevel = h.level;
  }

  const totalHeadings = page.headings.length;
  const h2Count = page.headings.filter(h => h.level === 2).length;

  if (hasSkips) {
    return {
      factor: 'Heading-Hierarchie',
      status: 'warn',
      value: `${totalHeadings} Headings (Ebenen \u00fcbersprungen)`,
      recommendation: 'Heading-Ebenen werden \u00fcbersprungen (z.B. H1 \u2192 H3). Halte die Hierarchie l\u00fcckenlos.',
      leakAttribute: 'headings.structure',
    };
  }

  if (h2Count < 2 && page.wordCount > 300) {
    return {
      factor: 'Heading-Hierarchie',
      status: 'warn',
      value: `${totalHeadings} Headings (nur ${h2Count} H2)`,
      recommendation: 'Wenige Zwischen\u00fcberschriften. Mehr H2/H3 verbessern Lesbarkeit und Snippet-Chancen.',
      leakAttribute: 'headings.structure',
    };
  }

  return {
    factor: 'Heading-Hierarchie',
    status: 'pass',
    value: `${totalHeadings} Headings`,
    recommendation: 'Heading-Struktur ist sauber und hierarchisch.',
    leakAttribute: 'headings.structure',
  };
}

function checkWordCount(page: ParsedPage): CheckResult {
  const wc = page.wordCount;

  if (wc < 300) {
    return {
      factor: 'Wortanzahl',
      status: 'fail',
      value: wc,
      recommendation: `Nur ${wc} W\u00f6rter. Thin Content wird von QualityBoost/Panda abgestraft. Top-10-Ergebnisse haben durchschnittlich ~1.447 W\u00f6rter.`,
      leakAttribute: 'qualityBoost.contentLength',
    };
  }

  if (wc < 800) {
    return {
      factor: 'Wortanzahl',
      status: 'warn',
      value: wc,
      recommendation: `${wc} W\u00f6rter \u2013 f\u00fcr informative Inhalte oft zu wenig. Pr\u00fcfe, ob das Thema mehr Tiefe verdient.`,
      leakAttribute: 'qualityBoost.contentLength',
    };
  }

  return {
    factor: 'Wortanzahl',
    status: 'pass',
    value: wc,
    recommendation: 'Ausreichend Content f\u00fcr thematische Tiefe.',
    leakAttribute: 'qualityBoost.contentLength',
  };
}

function checkKeywordStuffing(page: ParsedPage): CheckResult {
  const text = page.textContent.toLowerCase();
  const words = text.split(/\s+/).filter(w => w.length > 3);
  if (words.length === 0) {
    return {
      factor: 'Keyword-Stuffing',
      status: 'pass',
      value: null,
      recommendation: 'Keine Analyse m\u00f6glich (zu wenig Text).',
      leakAttribute: 'keywordStuffingScore',
    };
  }

  // Count word frequencies
  const freq: Record<string, number> = {};
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1;
  }

  // Find most repeated non-stopword
  const stopwords = new Set(['dass', 'eine', 'einer', 'eines', 'einem', 'einen', 'diese', 'dieser', 'dieses', 'diesem', 'diesen', 'nicht', 'sich', 'auch', 'noch', 'aber', 'oder', 'wenn', 'wird', 'sind', 'sein', 'haben', 'werden', 'kann', 'nach', 'mehr', 'dann', 'with', 'this', 'that', 'from', 'they', 'been', 'have', 'their', 'which', 'will', 'would', 'there', 'what', 'about', 'when', 'make', 'like', 'been', 'than', 'them', 'some', 'could', 'into', 'other', 'your', 'just', 'only', 'also', 'very', 'über', 'durch', 'unter', 'zwischen']);

  let maxDensity = 0;
  let stuffedWord = '';
  for (const [word, count] of Object.entries(freq)) {
    if (stopwords.has(word)) continue;
    const density = count / words.length;
    if (density > maxDensity) {
      maxDensity = density;
      stuffedWord = word;
    }
  }

  const densityPercent = Math.round(maxDensity * 1000) / 10;

  if (maxDensity > 0.04) {
    return {
      factor: 'Keyword-Stuffing',
      status: 'fail',
      value: `"${stuffedWord}" = ${densityPercent}%`,
      recommendation: `Das Wort "${stuffedWord}" erscheint mit ${densityPercent}% Dichte \u2013 Google's keywordStuffingScore w\u00fcrde hier anschlagen. Reduziere auf < 3%.`,
      leakAttribute: 'keywordStuffingScore',
    };
  }

  if (maxDensity > 0.03) {
    return {
      factor: 'Keyword-Stuffing',
      status: 'warn',
      value: `"${stuffedWord}" = ${densityPercent}%`,
      recommendation: `"${stuffedWord}" hat ${densityPercent}% Dichte. Am Grenzwert \u2013 verwende mehr Synonyme und semantische Varianten.`,
      leakAttribute: 'keywordStuffingScore',
    };
  }

  return {
    factor: 'Keyword-Stuffing',
    status: 'pass',
    value: `Max. Dichte: ${densityPercent}%`,
    recommendation: 'Keine auff\u00e4llige Keyword-\u00dcberoptimierung erkannt.',
    leakAttribute: 'keywordStuffingScore',
  };
}

function checkImageAlts(page: ParsedPage): CheckResult {
  if (page.images.length === 0) {
    return {
      factor: 'Bild-Alt-Texte',
      status: 'warn',
      value: '0 Bilder',
      recommendation: 'Keine Bilder gefunden. Bilder mit Alt-Text verbessern Relevanz und Zug\u00e4nglichkeit.',
      leakAttribute: 'imageData.altText',
    };
  }

  const withoutAlt = page.images.filter(img => !img.alt || img.alt.trim() === '');
  const ratio = withoutAlt.length / page.images.length;

  if (ratio > 0.5) {
    return {
      factor: 'Bild-Alt-Texte',
      status: 'fail',
      value: `${withoutAlt.length}/${page.images.length} ohne Alt`,
      recommendation: `${withoutAlt.length} von ${page.images.length} Bildern haben keinen Alt-Text. Google nutzt Alt-Texte zur Bild-Indexierung und Relevanz-Bewertung.`,
      leakAttribute: 'imageData.altText',
    };
  }

  if (ratio > 0.2) {
    return {
      factor: 'Bild-Alt-Texte',
      status: 'warn',
      value: `${withoutAlt.length}/${page.images.length} ohne Alt`,
      recommendation: `${withoutAlt.length} Bilder ohne Alt-Text. Erg\u00e4nze beschreibende Alt-Attribute f\u00fcr bessere Indexierung.`,
      leakAttribute: 'imageData.altText',
    };
  }

  return {
    factor: 'Bild-Alt-Texte',
    status: 'pass',
    value: `${page.images.length - withoutAlt.length}/${page.images.length} mit Alt`,
    recommendation: 'Die meisten Bilder haben Alt-Texte.',
    leakAttribute: 'imageData.altText',
  };
}

function checkLinkRatio(page: ParsedPage): CheckResult {
  const internalCount = page.internalLinks.length;
  const externalCount = page.externalLinks.length;
  const total = internalCount + externalCount;

  if (total === 0) {
    return {
      factor: 'Link-Struktur',
      status: 'fail',
      value: '0 Links',
      recommendation: 'Keine Links gefunden. Interne Verlinkung ist essenziell f\u00fcr Crawlability und PageRank-Verteilung.',
      leakAttribute: 'anchors.linkCount',
    };
  }

  if (internalCount < 3) {
    return {
      factor: 'Link-Struktur',
      status: 'warn',
      value: `${internalCount} intern, ${externalCount} extern`,
      recommendation: `Nur ${internalCount} interne Links. Mehr interne Verlinkung st\u00e4rkt die thematische Autorit\u00e4t und erleichtert das Crawling.`,
      leakAttribute: 'anchors.linkCount',
    };
  }

  return {
    factor: 'Link-Struktur',
    status: 'pass',
    value: `${internalCount} intern, ${externalCount} extern`,
    recommendation: 'Gute Mischung aus internen und externen Links.',
    leakAttribute: 'anchors.linkCount',
  };
}
