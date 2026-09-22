"use client";

import { UrlCleanupNav } from "@/components/url-cleanup/UrlCleanupNav";

export default function UrlCleanupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">URL Cleanup</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Sitemap-Inventar, Dimensionen overlayen, Kill-Liste mit Konfidenzscore.
        </p>
      </div>
      <UrlCleanupNav />
      {children}
    </div>
  );
}
