"use client";

import { UrlCleanupNav } from "@/components/url-cleanup/UrlCleanupNav";
import { useMessages } from "@/i18n/I18nProvider";
import { urlCleanupMessages } from "@/i18n/messages/url-cleanup";

export default function UrlCleanupLayout({ children }: { children: React.ReactNode }) {
  const t = useMessages(urlCleanupMessages);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.layout.title}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t.layout.subtitle}
        </p>
      </div>
      <UrlCleanupNav />
      {children}
    </div>
  );
}
