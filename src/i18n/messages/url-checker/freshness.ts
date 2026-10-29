import { defineMessages } from "@/i18n/config";

export const urlCheckerFreshnessMessages = defineMessages({
  de: {
    published: {
      factor: "Veröffentlichungsdatum",
      missing:
        "Kein datePublished in Schema oder Meta-Tags gefunden. Google's FreshnessTwiddler nutzt Datumsangaben zur Freshness-Bewertung.",
      unparsable: "Datumsformat nicht parsebar. Verwende ISO 8601 (YYYY-MM-DD) für eindeutige Interpretation.",
      ageValue: (date: string, days: number) => `${date} (${days} Tage alt)`,
      old: "Content ist über 2 Jahre alt. Für zeitkritische Themen empfiehlt sich ein regelmäßiges Update (LastSignificantUpdate-Signal).",
      ok: "Veröffentlichungsdatum vorhanden und aktuell.",
    },
    modified: {
      factor: "Änderungsdatum (dateModified)",
      missing:
        "Kein dateModified gefunden. Google nutzt LastSignificantUpdate um zu erkennen, ob Content aktualisiert wurde. Setze dateModified bei echten Inhaltsänderungen.",
      unparsable: "Datumsformat nicht parsebar. Verwende ISO 8601.",
      ageValue: (date: string, days: number) => `${date} (${days} Tage seit letzter Änderung)`,
      old: "Letzte Änderung ist über 1 Jahr her. Regelmäßige Updates (mindestens quartalsweise) senden positive Freshness-Signale.",
      ok: "Content wurde kürzlich aktualisiert – gutes Freshness-Signal.",
    },
    lastModifiedHeader: {
      factor: "Last-Modified Header",
      missing:
        "Kein Last-Modified HTTP-Header gesetzt. Dieser hilft Googlebot beim effizienten Crawling (Conditional GET).",
      ok: "Last-Modified Header vorhanden – unterstützt effizientes Crawling.",
    },
  },
  en: {
    published: {
      factor: "Publication date",
      missing:
        "No datePublished found in schema or meta tags. Google's FreshnessTwiddler uses dates to assess freshness.",
      unparsable: "Date format cannot be parsed. Use ISO 8601 (YYYY-MM-DD) for unambiguous interpretation.",
      ageValue: (date: string, days: number) => `${date} (${days} days old)`,
      old: "Content is more than 2 years old. For time-sensitive topics, regular updates are recommended (LastSignificantUpdate signal).",
      ok: "Publication date present and current.",
    },
    modified: {
      factor: "Modification date (dateModified)",
      missing:
        "No dateModified found. Google uses LastSignificantUpdate to detect whether content has been updated. Set dateModified when content actually changes.",
      unparsable: "Date format cannot be parsed. Use ISO 8601.",
      ageValue: (date: string, days: number) => `${date} (${days} days since last change)`,
      old: "Last change was more than 1 year ago. Regular updates (at least quarterly) send positive freshness signals.",
      ok: "Content was updated recently – good freshness signal.",
    },
    lastModifiedHeader: {
      factor: "Last-Modified header",
      missing:
        "No Last-Modified HTTP header set. It helps Googlebot crawl efficiently (conditional GET).",
      ok: "Last-Modified header present – supports efficient crawling.",
    },
  },
});
