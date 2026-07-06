import { CheckResult, ParsedPage } from '../types';

export function runUserExperienceChecks(page: ParsedPage): CheckResult[] {
  const checks: CheckResult[] = [];

  checks.push(checkResourceCount(page));
  checks.push(checkRenderBlockingScripts(page));
  checks.push(checkContentAboveFold(page));

  return checks;
}

function checkResourceCount(page: ParsedPage): CheckResult {
  const jsCount = page.scripts.filter(s => s.src).length;
  const cssCount = page.stylesheets.length;
  const total = jsCount + cssCount;

  if (total > 50) {
    return {
      factor: 'Ressourcen-Anzahl (Clutter)',
      status: 'fail',
      value: `${jsCount} JS, ${cssCount} CSS`,
      recommendation: `${total} externe Ressourcen geladen. Google's clutterScore bestraft Seiten mit vielen ablenkenden/bremsenden Ressourcen. B\u00fcndle und reduziere.`,
      leakAttribute: 'nsr.clutterScore',
    };
  }

  if (total > 25) {
    return {
      factor: 'Ressourcen-Anzahl (Clutter)',
      status: 'warn',
      value: `${jsCount} JS, ${cssCount} CSS`,
      recommendation: `${total} Ressourcen geladen. Pr\u00fcfe ob alle n\u00f6tig sind \u2013 weniger Ressourcen = schnelleres Rendering = bessere UX-Signale (NavBoost).`,
      leakAttribute: 'nsr.clutterScore',
    };
  }

  return {
    factor: 'Ressourcen-Anzahl (Clutter)',
    status: 'pass',
    value: `${jsCount} JS, ${cssCount} CSS`,
    recommendation: 'Moderate Ressourcen-Anzahl \u2013 gutes Zeichen f\u00fcr schnelles Rendering.',
    leakAttribute: 'nsr.clutterScore',
  };
}

function checkRenderBlockingScripts(page: ParsedPage): CheckResult {
  const blockingScripts = page.scripts.filter(s => s.src && !s.isAsync && !s.isDefer);

  if (blockingScripts.length > 5) {
    return {
      factor: 'Render-blockierende Skripte',
      status: 'fail',
      value: `${blockingScripts.length} blockierend`,
      recommendation: `${blockingScripts.length} Skripte ohne async/defer blockieren das Rendering. Dies verz\u00f6gert den First Paint und erh\u00f6ht die Absprungrate (NavBoost-Signal).`,
      leakAttribute: 'navBoost.renderBlocking',
    };
  }

  if (blockingScripts.length > 2) {
    return {
      factor: 'Render-blockierende Skripte',
      status: 'warn',
      value: `${blockingScripts.length} blockierend`,
      recommendation: `${blockingScripts.length} render-blockierende Skripte. F\u00fcge async oder defer hinzu f\u00fcr schnelleres Laden.`,
      leakAttribute: 'navBoost.renderBlocking',
    };
  }

  return {
    factor: 'Render-blockierende Skripte',
    status: 'pass',
    value: blockingScripts.length === 0 ? 'Keine' : `${blockingScripts.length}`,
    recommendation: 'Skripte sind gut optimiert (async/defer).',
    leakAttribute: 'navBoost.renderBlocking',
  };
}

function checkContentAboveFold(page: ParsedPage): CheckResult {
  // Heuristic: check if meaningful content appears early in the HTML
  const headSection = page.textContent.slice(0, 500);
  const words = headSection.split(/\s+/).filter(w => w.length > 3);

  if (words.length < 10) {
    return {
      factor: 'Content Above-the-Fold',
      status: 'warn',
      value: `${words.length} W\u00f6rter im oberen Bereich`,
      recommendation: 'Wenig sichtbarer Content im oberen Seitenbereich. Nutzer (und NavBoost) bewerten, ob sofort relevanter Inhalt sichtbar ist.',
      leakAttribute: 'navBoost.aboveFoldContent',
    };
  }

  return {
    factor: 'Content Above-the-Fold',
    status: 'pass',
    value: 'Ausreichend',
    recommendation: 'Content ist fr\u00fch im Dokument verf\u00fcgbar \u2013 gutes Signal f\u00fcr schnelle Nutzerzufriedenheit.',
    leakAttribute: 'navBoost.aboveFoldContent',
  };
}
