"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { intlLocales, LOCALE_COOKIE, type Locale, type Messages } from "./config";

interface I18nContextValue {
  locale: Locale;
  /** BCP-47-Tag für `toLocaleString`, `Intl.NumberFormat` usw. */
  intlLocale: string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      setLocaleState(next);
      router.refresh();
    },
    [router]
  );

  return (
    <I18nContext.Provider value={{ locale, intlLocale: intlLocales[locale], setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useLocale(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useLocale must be used within I18nProvider");
  return ctx;
}

/** Liefert die Texte eines Bereichs in der aktiven Sprache. */
export function useMessages<T>(messages: Messages<T>): T {
  return messages[useLocale().locale];
}
