import type { Locale } from '@/i18n/config';
import { urlCheckerContentQualityMessages } from '@/i18n/messages/url-checker/content-quality';
import { CheckResult, ParsedPage } from '../types';

type Messages = (typeof urlCheckerContentQualityMessages)[Locale];

export function runContentQualityChecks(page: ParsedPage, locale: Locale): CheckResult[] {
  const t = urlCheckerContentQualityMessages[locale];
  const checks: CheckResult[] = [];

  checks.push(checkTitle(page, t));
  checks.push(checkMetaDescription(page, t));
  checks.push(checkH1(page, t));
  checks.push(checkHeadingHierarchy(page, t));
  checks.push(checkWordCount(page, t));
  checks.push(checkKeywordStuffing(page, t));
  checks.push(checkImageAlts(page, t));
  checks.push(checkLinkRatio(page, t));

  return checks;
}

function checkTitle(page: ParsedPage, t: Messages): CheckResult {
  if (!page.title) {
    return {
      factor: t.title.factor,
      status: 'fail',
      value: null,
      recommendation: t.title.missing,
      leakAttribute: 'originalTitleHardTokenCount',
    };
  }

  const length = page.title.length;

  if (length < 30) {
    return {
      factor: t.title.factor,
      status: 'warn',
      value: t.charsValue(length),
      recommendation: t.title.tooShort(length),
      leakAttribute: 'originalTitleHardTokenCount',
    };
  }

  if (length > 60) {
    return {
      factor: t.title.factor,
      status: 'warn',
      value: t.charsValue(length),
      recommendation: t.title.tooLong(length),
      leakAttribute: 'originalTitleHardTokenCount',
    };
  }

  return {
    factor: t.title.factor,
    status: 'pass',
    value: t.charsValue(length),
    recommendation: t.title.ok,
    leakAttribute: 'originalTitleHardTokenCount',
  };
}

function checkMetaDescription(page: ParsedPage, t: Messages): CheckResult {
  if (!page.metaDescription) {
    return {
      factor: t.metaDescription.factor,
      status: 'fail',
      value: null,
      recommendation: t.metaDescription.missing,
      leakAttribute: 'snippet.metaDescription',
    };
  }

  const length = page.metaDescription.length;

  if (length < 70) {
    return {
      factor: t.metaDescription.factor,
      status: 'warn',
      value: t.charsValue(length),
      recommendation: t.metaDescription.tooShort(length),
      leakAttribute: 'snippet.metaDescription',
    };
  }

  if (length > 160) {
    return {
      factor: t.metaDescription.factor,
      status: 'warn',
      value: t.charsValue(length),
      recommendation: t.metaDescription.tooLong(length),
      leakAttribute: 'snippet.metaDescription',
    };
  }

  return {
    factor: t.metaDescription.factor,
    status: 'pass',
    value: t.charsValue(length),
    recommendation: t.metaDescription.ok,
    leakAttribute: 'snippet.metaDescription',
  };
}

function checkH1(page: ParsedPage, t: Messages): CheckResult {
  const h1s = page.headings.filter(h => h.level === 1);

  if (h1s.length === 0) {
    return {
      factor: t.h1.factor,
      status: 'fail',
      value: t.h1.noneValue,
      recommendation: t.h1.missing,
      leakAttribute: 'headings.h1Count',
    };
  }

  if (h1s.length > 1) {
    return {
      factor: t.h1.factor,
      status: 'warn',
      value: t.h1.multipleValue(h1s.length),
      recommendation: t.h1.multiple(h1s.length),
      leakAttribute: 'headings.h1Count',
    };
  }

  return {
    factor: t.h1.factor,
    status: 'pass',
    value: h1s[0].text.slice(0, 80),
    recommendation: t.h1.ok,
    leakAttribute: 'headings.h1Count',
  };
}

function checkHeadingHierarchy(page: ParsedPage, t: Messages): CheckResult {
  if (page.headings.length === 0) {
    return {
      factor: t.headings.factor,
      status: 'fail',
      value: t.headings.noneValue,
      recommendation: t.headings.missing,
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
      factor: t.headings.factor,
      status: 'warn',
      value: t.headings.skipsValue(totalHeadings),
      recommendation: t.headings.skips,
      leakAttribute: 'headings.structure',
    };
  }

  if (h2Count < 2 && page.wordCount > 300) {
    return {
      factor: t.headings.factor,
      status: 'warn',
      value: t.headings.fewH2Value(totalHeadings, h2Count),
      recommendation: t.headings.fewH2,
      leakAttribute: 'headings.structure',
    };
  }

  return {
    factor: t.headings.factor,
    status: 'pass',
    value: t.headings.countValue(totalHeadings),
    recommendation: t.headings.ok,
    leakAttribute: 'headings.structure',
  };
}

function checkWordCount(page: ParsedPage, t: Messages): CheckResult {
  const wc = page.wordCount;

  if (wc < 300) {
    return {
      factor: t.wordCount.factor,
      status: 'fail',
      value: wc,
      recommendation: t.wordCount.thin(wc),
      leakAttribute: 'qualityBoost.contentLength',
    };
  }

  if (wc < 800) {
    return {
      factor: t.wordCount.factor,
      status: 'warn',
      value: wc,
      recommendation: t.wordCount.low(wc),
      leakAttribute: 'qualityBoost.contentLength',
    };
  }

  return {
    factor: t.wordCount.factor,
    status: 'pass',
    value: wc,
    recommendation: t.wordCount.ok,
    leakAttribute: 'qualityBoost.contentLength',
  };
}

function checkKeywordStuffing(page: ParsedPage, t: Messages): CheckResult {
  const text = page.textContent.toLowerCase();
  const words = text.split(/\s+/).filter(w => w.length > 3);
  if (words.length === 0) {
    return {
      factor: t.keywordStuffing.factor,
      status: 'pass',
      value: null,
      recommendation: t.keywordStuffing.noText,
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
      factor: t.keywordStuffing.factor,
      status: 'fail',
      value: `"${stuffedWord}" = ${densityPercent}%`,
      recommendation: t.keywordStuffing.stuffed(stuffedWord, densityPercent),
      leakAttribute: 'keywordStuffingScore',
    };
  }

  if (maxDensity > 0.03) {
    return {
      factor: t.keywordStuffing.factor,
      status: 'warn',
      value: `"${stuffedWord}" = ${densityPercent}%`,
      recommendation: t.keywordStuffing.borderline(stuffedWord, densityPercent),
      leakAttribute: 'keywordStuffingScore',
    };
  }

  return {
    factor: t.keywordStuffing.factor,
    status: 'pass',
    value: t.keywordStuffing.maxDensityValue(densityPercent),
    recommendation: t.keywordStuffing.ok,
    leakAttribute: 'keywordStuffingScore',
  };
}

function checkImageAlts(page: ParsedPage, t: Messages): CheckResult {
  if (page.images.length === 0) {
    return {
      factor: t.imageAlts.factor,
      status: 'warn',
      value: t.imageAlts.noImagesValue,
      recommendation: t.imageAlts.noImages,
      leakAttribute: 'imageData.altText',
    };
  }

  const withoutAlt = page.images.filter(img => !img.alt || img.alt.trim() === '');
  const ratio = withoutAlt.length / page.images.length;

  if (ratio > 0.5) {
    return {
      factor: t.imageAlts.factor,
      status: 'fail',
      value: t.imageAlts.withoutAltValue(withoutAlt.length, page.images.length),
      recommendation: t.imageAlts.manyMissing(withoutAlt.length, page.images.length),
      leakAttribute: 'imageData.altText',
    };
  }

  if (ratio > 0.2) {
    return {
      factor: t.imageAlts.factor,
      status: 'warn',
      value: t.imageAlts.withoutAltValue(withoutAlt.length, page.images.length),
      recommendation: t.imageAlts.someMissing(withoutAlt.length),
      leakAttribute: 'imageData.altText',
    };
  }

  return {
    factor: t.imageAlts.factor,
    status: 'pass',
    value: t.imageAlts.withAltValue(page.images.length - withoutAlt.length, page.images.length),
    recommendation: t.imageAlts.ok,
    leakAttribute: 'imageData.altText',
  };
}

function checkLinkRatio(page: ParsedPage, t: Messages): CheckResult {
  const internalCount = page.internalLinks.length;
  const externalCount = page.externalLinks.length;
  const total = internalCount + externalCount;

  if (total === 0) {
    return {
      factor: t.links.factor,
      status: 'fail',
      value: t.links.noneValue,
      recommendation: t.links.none,
      leakAttribute: 'anchors.linkCount',
    };
  }

  if (internalCount < 3) {
    return {
      factor: t.links.factor,
      status: 'warn',
      value: t.links.countValue(internalCount, externalCount),
      recommendation: t.links.fewInternal(internalCount),
      leakAttribute: 'anchors.linkCount',
    };
  }

  return {
    factor: t.links.factor,
    status: 'pass',
    value: t.links.countValue(internalCount, externalCount),
    recommendation: t.links.ok,
    leakAttribute: 'anchors.linkCount',
  };
}
