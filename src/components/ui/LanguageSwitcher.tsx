"use client";

import { locales, localeLabels } from "@/i18n/config";
import { useLocale, useMessages } from "@/i18n/I18nProvider";
import { commonMessages } from "@/i18n/messages/common";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const t = useMessages(commonMessages);

  return (
    <div
      role="group"
      aria-label={t.language}
      className="flex items-center rounded-lg border border-slate-200 dark:border-slate-600 p-0.5"
    >
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => l !== locale && setLocale(l)}
          aria-pressed={l === locale}
          title={localeLabels[l]}
          className={`px-2.5 py-1 text-xs font-semibold uppercase rounded-md transition-colors ${
            l === locale
              ? "bg-blue-600 text-white"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
