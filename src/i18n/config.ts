export const locales = ["de", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "de";

export const LOCALE_COOKIE = "locale";

/** BCP-47-Tags für Intl / toLocaleString */
export const intlLocales: Record<Locale, string> = {
  de: "de-DE",
  en: "en-GB",
};

export const localeLabels: Record<Locale, string> = {
  de: "Deutsch",
  en: "English",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

export type Messages<T> = Record<Locale, T>;

/**
 * Definiert die Texte eines Bereichs für alle Sprachen.
 * Die Struktur von `de` ist maßgeblich – fehlt in `en` ein Schlüssel, meldet TypeScript einen Fehler.
 */
export function defineMessages<T>(messages: { de: T; en: NoInfer<T> }): Messages<T> {
  return messages;
}
