import { defineMessages } from "@/i18n/config";

export const urlCheckerEntityTopicalityMessages = defineMessages({
  de: {
    schemaMarkup: {
      factor: "Strukturierte Daten (JSON-LD)",
      noneValue: "Kein Schema",
      missing:
        "Kein JSON-LD/Schema.org Markup gefunden. Strukturierte Daten helfen Google, Entitäten und Beziehungen (WebRef) zu erkennen und Rich Snippets zu generieren.",
      found: (types: string) =>
        `Schema.org Typen gefunden: ${types}. Google nutzt diese für Entity-Erkennung und Rich Results.`,
    },
    openGraph: {
      factor: "Open Graph Tags",
      noneValue: "Keine OG-Tags",
      none: "Keine Open Graph Tags gefunden. OG-Tags verbessern die Darstellung beim Teilen und signalisieren strukturierte Seiteninformationen.",
      presentValue: (present: number) => `${present}/4 vorhanden`,
      missing: (missing: string) =>
        `Fehlende OG-Tags: ${missing}. Vervollständige die Tags für optimale Social-Sharing-Darstellung.`,
      ok: "Alle wichtigen Open Graph Tags sind gesetzt.",
    },
    schemaTypes: {
      factor: "Rich-Result-fähige Schemas",
      noneValue: "Keine",
      none: "Kein Rich-Result-fähiges Schema gefunden. Typen wie Article, FAQ, Product oder HowTo ermöglichen Rich Snippets in den SERPs.",
      notRichResult: (types: string) =>
        `Vorhandene Schemas (${types}) sind keine typischen Rich-Result-Typen. Erwäge Article, FAQ, Product oder HowTo.`,
      ok: (types: string) => `Rich-Result-fähige Schemas vorhanden: ${types}.`,
    },
  },
  en: {
    schemaMarkup: {
      factor: "Structured data (JSON-LD)",
      noneValue: "No schema",
      missing:
        "No JSON-LD/schema.org markup found. Structured data helps Google recognise entities and relationships (WebRef) and generate rich snippets.",
      found: (types: string) =>
        `Schema.org types found: ${types}. Google uses these for entity recognition and rich results.`,
    },
    openGraph: {
      factor: "Open Graph tags",
      noneValue: "No OG tags",
      none: "No Open Graph tags found. OG tags improve how the page appears when shared and signal structured page information.",
      presentValue: (present: number) => `${present}/4 present`,
      missing: (missing: string) =>
        `Missing OG tags: ${missing}. Complete the tags for optimal social sharing display.`,
      ok: "All important Open Graph tags are set.",
    },
    schemaTypes: {
      factor: "Rich-result-eligible schemas",
      noneValue: "None",
      none: "No rich-result-eligible schema found. Types such as Article, FAQ, Product or HowTo enable rich snippets in the SERPs.",
      notRichResult: (types: string) =>
        `Existing schemas (${types}) are not typical rich result types. Consider Article, FAQ, Product or HowTo.`,
      ok: (types: string) => `Rich-result-eligible schemas present: ${types}.`,
    },
  },
});
