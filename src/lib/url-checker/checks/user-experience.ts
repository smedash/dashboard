import type { Locale } from '@/i18n/config';
import { urlCheckerUserExperienceMessages } from '@/i18n/messages/url-checker/user-experience';
import { CheckResult, ParsedPage } from '../types';

type Texts = (typeof urlCheckerUserExperienceMessages)[Locale];

export function runUserExperienceChecks(page: ParsedPage, locale: Locale): CheckResult[] {
  const t = urlCheckerUserExperienceMessages[locale];
  const checks: CheckResult[] = [];

  checks.push(checkResourceCount(page, t));
  checks.push(checkRenderBlockingScripts(page, t));
  checks.push(checkContentAboveFold(page, t));

  return checks;
}

function checkResourceCount(page: ParsedPage, t: Texts): CheckResult {
  const jsCount = page.scripts.filter(s => s.src).length;
  const cssCount = page.stylesheets.length;
  const total = jsCount + cssCount;

  if (total > 50) {
    return {
      factor: t.resources.factor,
      status: 'fail',
      value: `${jsCount} JS, ${cssCount} CSS`,
      recommendation: t.resources.failRecommendation(total),
      leakAttribute: 'nsr.clutterScore',
    };
  }

  if (total > 25) {
    return {
      factor: t.resources.factor,
      status: 'warn',
      value: `${jsCount} JS, ${cssCount} CSS`,
      recommendation: t.resources.warnRecommendation(total),
      leakAttribute: 'nsr.clutterScore',
    };
  }

  return {
    factor: t.resources.factor,
    status: 'pass',
    value: `${jsCount} JS, ${cssCount} CSS`,
    recommendation: t.resources.passRecommendation,
    leakAttribute: 'nsr.clutterScore',
  };
}

function checkRenderBlockingScripts(page: ParsedPage, t: Texts): CheckResult {
  const blockingScripts = page.scripts.filter(s => s.src && !s.isAsync && !s.isDefer);

  if (blockingScripts.length > 5) {
    return {
      factor: t.renderBlocking.factor,
      status: 'fail',
      value: t.renderBlocking.blockingValue(blockingScripts.length),
      recommendation: t.renderBlocking.failRecommendation(blockingScripts.length),
      leakAttribute: 'navBoost.renderBlocking',
    };
  }

  if (blockingScripts.length > 2) {
    return {
      factor: t.renderBlocking.factor,
      status: 'warn',
      value: t.renderBlocking.blockingValue(blockingScripts.length),
      recommendation: t.renderBlocking.warnRecommendation(blockingScripts.length),
      leakAttribute: 'navBoost.renderBlocking',
    };
  }

  return {
    factor: t.renderBlocking.factor,
    status: 'pass',
    value: blockingScripts.length === 0 ? t.renderBlocking.noneValue : `${blockingScripts.length}`,
    recommendation: t.renderBlocking.passRecommendation,
    leakAttribute: 'navBoost.renderBlocking',
  };
}

function checkContentAboveFold(page: ParsedPage, t: Texts): CheckResult {
  // Heuristic: check if meaningful content appears early in the HTML
  const headSection = page.textContent.slice(0, 500);
  const words = headSection.split(/\s+/).filter(w => w.length > 3);

  if (words.length < 10) {
    return {
      factor: t.aboveFold.factor,
      status: 'warn',
      value: t.aboveFold.wordsValue(words.length),
      recommendation: t.aboveFold.warnRecommendation,
      leakAttribute: 'navBoost.aboveFoldContent',
    };
  }

  return {
    factor: t.aboveFold.factor,
    status: 'pass',
    value: t.aboveFold.passValue,
    recommendation: t.aboveFold.passRecommendation,
    leakAttribute: 'navBoost.aboveFoldContent',
  };
}
