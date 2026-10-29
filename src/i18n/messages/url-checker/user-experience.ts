import { defineMessages } from "@/i18n/config";

export const urlCheckerUserExperienceMessages = defineMessages({
  de: {
    resources: {
      factor: "Ressourcen-Anzahl (Clutter)",
      failRecommendation: (total: number) =>
        `${total} externe Ressourcen geladen. Google's clutterScore bestraft Seiten mit vielen ablenkenden/bremsenden Ressourcen. Bündle und reduziere.`,
      warnRecommendation: (total: number) =>
        `${total} Ressourcen geladen. Prüfe ob alle nötig sind – weniger Ressourcen = schnelleres Rendering = bessere UX-Signale (NavBoost).`,
      passRecommendation: "Moderate Ressourcen-Anzahl – gutes Zeichen für schnelles Rendering.",
    },
    renderBlocking: {
      factor: "Render-blockierende Skripte",
      blockingValue: (n: number) => `${n} blockierend`,
      failRecommendation: (n: number) =>
        `${n} Skripte ohne async/defer blockieren das Rendering. Dies verzögert den First Paint und erhöht die Absprungrate (NavBoost-Signal).`,
      warnRecommendation: (n: number) =>
        `${n} render-blockierende Skripte. Füge async oder defer hinzu für schnelleres Laden.`,
      noneValue: "Keine",
      passRecommendation: "Skripte sind gut optimiert (async/defer).",
    },
    aboveFold: {
      factor: "Content Above-the-Fold",
      wordsValue: (n: number) => `${n} Wörter im oberen Bereich`,
      warnRecommendation:
        "Wenig sichtbarer Content im oberen Seitenbereich. Nutzer (und NavBoost) bewerten, ob sofort relevanter Inhalt sichtbar ist.",
      passValue: "Ausreichend",
      passRecommendation:
        "Content ist früh im Dokument verfügbar – gutes Signal für schnelle Nutzerzufriedenheit.",
    },
  },
  en: {
    resources: {
      factor: "Resource count (clutter)",
      failRecommendation: (total: number) =>
        `${total} external resources loaded. Google's clutterScore penalises pages with many distracting/slowing resources. Bundle and reduce them.`,
      warnRecommendation: (total: number) =>
        `${total} resources loaded. Check whether all are needed – fewer resources = faster rendering = better UX signals (NavBoost).`,
      passRecommendation: "Moderate number of resources – a good sign for fast rendering.",
    },
    renderBlocking: {
      factor: "Render-blocking scripts",
      blockingValue: (n: number) => `${n} blocking`,
      failRecommendation: (n: number) =>
        `${n} scripts without async/defer block rendering. This delays first paint and increases the bounce rate (NavBoost signal).`,
      warnRecommendation: (n: number) =>
        `${n} render-blocking scripts. Add async or defer for faster loading.`,
      noneValue: "None",
      passRecommendation: "Scripts are well optimised (async/defer).",
    },
    aboveFold: {
      factor: "Above-the-fold content",
      wordsValue: (n: number) => `${n} words in the top section`,
      warnRecommendation:
        "Little visible content at the top of the page. Users (and NavBoost) judge whether relevant content is visible immediately.",
      passValue: "Sufficient",
      passRecommendation:
        "Content is available early in the document – a good signal for quick user satisfaction.",
    },
  },
});
