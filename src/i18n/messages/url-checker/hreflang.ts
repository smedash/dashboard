import { defineMessages } from "@/i18n/config";

export const urlCheckerHreflangMessages = defineMessages({
  de: {
    missingValue: "Fehlend",
    presence: {
      factor: "Hreflang-Tags",
      noneValue: "Keine",
      noneRecommendation:
        "Keine Hreflang-Tags gefunden. Wenn die Seite in mehreren Sprachen/Regionen existiert, setze Hreflang für korrekte Internationalisierung.",
      languagesValue: (count: number, langs: string) => `${count} Sprachen: ${langs}`,
      passRecommendation: "Hreflang-Tags vorhanden für internationale Ausrichtung.",
    },
    selfReference: {
      factor: "Hreflang Self-Referenz",
      notApplicableValue: "N/A (keine Hreflangs)",
      notApplicableRecommendation:
        "Keine Hreflang-Tags vorhanden – Self-Referenz nicht relevant.",
      failRecommendation:
        "Jede Seite mit Hreflang muss sich selbst referenzieren (Self-Referencing). Ohne dies kann Google die Hreflang-Konfiguration ignorieren.",
      passValue: "Vorhanden",
      passRecommendation: "Self-referencing Hreflang korrekt implementiert.",
    },
    xDefault: {
      factor: "x-default Hreflang",
      notApplicableValue: "N/A",
      notApplicableRecommendation: "Keine Hreflang-Tags – x-default nicht relevant.",
      warnRecommendation:
        "Kein x-default Hreflang gesetzt. Dieses Tag teilt Google mit, welche Version für Nutzer ohne passende Sprachversion angezeigt werden soll.",
      passValue: "Gesetzt",
      passRecommendation: "x-default Fallback korrekt konfiguriert.",
    },
  },
  en: {
    missingValue: "Missing",
    presence: {
      factor: "Hreflang tags",
      noneValue: "None",
      noneRecommendation:
        "No hreflang tags found. If the page exists in several languages/regions, set hreflang for correct internationalisation.",
      languagesValue: (count: number, langs: string) => `${count} languages: ${langs}`,
      passRecommendation: "Hreflang tags present for international targeting.",
    },
    selfReference: {
      factor: "Hreflang self-reference",
      notApplicableValue: "N/A (no hreflangs)",
      notApplicableRecommendation:
        "No hreflang tags present – self-reference not relevant.",
      failRecommendation:
        "Every page with hreflang must reference itself (self-referencing). Without it, Google may ignore the hreflang configuration.",
      passValue: "Present",
      passRecommendation: "Self-referencing hreflang implemented correctly.",
    },
    xDefault: {
      factor: "x-default hreflang",
      notApplicableValue: "N/A",
      notApplicableRecommendation: "No hreflang tags – x-default not relevant.",
      warnRecommendation:
        "No x-default hreflang set. This tag tells Google which version to show to users without a matching language version.",
      passValue: "Set",
      passRecommendation: "x-default fallback configured correctly.",
    },
  },
});
