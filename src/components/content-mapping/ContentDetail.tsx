"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useMessages } from "@/i18n/I18nProvider";
import { seoHelperContentMappingMessages } from "@/i18n/messages/seo-helper-content-mapping";
import { Notice, Spinner, apiFetch, buttonSecondary } from "@/components/keyword-mapping/ui";
import type { ContentDetailDto } from "./types";

export function ContentDetail({
  inventoryId,
  editable,
  onRecrawled,
}: {
  inventoryId: string;
  editable: boolean;
  onRecrawled?: () => void;
}) {
  const t = useMessages(seoHelperContentMappingMessages);
  const { intlLocale } = useLocale();
  const [content, setContent] = useState<ContentDetailDto | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [recrawling, setRecrawling] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const load = useCallback(
    () =>
      apiFetch<{ content: ContentDetailDto | null }>(`/api/seo-helper/content-mapping/${inventoryId}`)
        .then((res) => {
          setContent(res.content);
          setOpenSections(new Set(res.content?.sections.slice(0, 1).map((s) => s.id) ?? []));
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : t.errorGeneric)),
    [inventoryId, t.errorGeneric]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const recrawl = async () => {
    setRecrawling(true);
    setError(null);
    try {
      await apiFetch("/api/seo-helper/content-mapping/crawl", {
        method: "POST",
        body: JSON.stringify({ inventoryId }),
      });
      await load();
      onRecrawled?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
    } finally {
      setRecrawling(false);
    }
  };

  const toggleSection = (id: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (content === undefined && !error) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> {t.loading}
      </div>
    );
  }

  const recrawlButton = editable && (
    <button type="button" className={buttonSecondary} disabled={recrawling} onClick={() => void recrawl()}>
      {recrawling && <Spinner />}
      {recrawling ? t.detail.recrawling : t.detail.recrawl}
    </button>
  );

  if (!content) {
    return (
      <div className="space-y-3">
        {error && <Notice kind="error">{error}</Notice>}
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500">{t.detail.notCrawled}</p>
          {recrawlButton}
        </div>
      </div>
    );
  }

  const allOpen = content.sections.length > 0 && openSections.size === content.sections.length;
  const meta: Array<[string, string | null]> = [
    [t.detail.metaDescription, content.metaDescription],
    [t.detail.canonical, content.canonical],
    [t.detail.robots, content.robots],
    [t.detail.lang, content.lang],
    [t.detail.finalUrl, content.finalUrl],
    [t.detail.fetchedVia, content.fetchedVia],
  ];

  return (
    <div className="space-y-4 text-sm">
      {error && <Notice kind="error">{error}</Notice>}
      {content.error && <Notice kind="error">{content.error}</Notice>}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900 dark:text-white">{content.title || t.none}</div>
          {content.h1 && <div className="text-slate-600 dark:text-slate-300">H1: {content.h1}</div>}
          <div className="text-xs text-slate-500 mt-1">
            {t.detail.words(content.wordCount)} · {content.sectionCount} {t.detail.sections}
            {content.crawledAt && ` · ${new Date(content.crawledAt).toLocaleString(intlLocale)}`}
          </div>
        </div>
        {recrawlButton}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{t.detail.meta}</h4>
            <dl className="space-y-1">
              {meta.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="text-slate-700 dark:text-slate-200 break-words">{value || t.none}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{t.detail.outline}</h4>
            <ul className="space-y-0.5 max-h-80 overflow-y-auto">
              {(content.headings ?? []).map((h, i) => (
                <li
                  key={i}
                  className="text-slate-700 dark:text-slate-200"
                  style={{ paddingLeft: `${Math.max(0, h.level - 1) * 12}px` }}
                >
                  <span className="text-xs text-slate-400 mr-1">H{h.level}</span>
                  {h.text}
                </li>
              ))}
              {(content.headings ?? []).length === 0 && <li className="text-slate-500">{t.none}</li>}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t.detail.sections}</h4>
            {content.sections.length > 0 && (
              <button
                type="button"
                className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                onClick={() => setOpenSections(allOpen ? new Set() : new Set(content.sections.map((s) => s.id)))}
              >
                {allOpen ? t.detail.collapseAll : t.detail.expandAll}
              </button>
            )}
          </div>
          {content.sections.length === 0 ? (
            <p className="text-slate-500">{t.detail.noSections}</p>
          ) : (
            <div className="space-y-2">
              {content.sections.map((s) => {
                const isOpen = openSections.has(s.id);
                return (
                  <div
                    key={s.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-700"
                    style={{ marginLeft: `${Math.max(0, s.level - 2) * 16}px` }}
                  >
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      onClick={() => toggleSection(s.id)}
                    >
                      <svg
                        className={`w-3 h-3 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-xs text-slate-400">{s.level > 0 ? `H${s.level}` : ""}</span>
                      <span className="flex-1 font-medium text-slate-800 dark:text-slate-100 truncate">
                        {s.heading || t.detail.intro}
                      </span>
                      <span className="text-xs text-slate-500 shrink-0">{t.detail.words(s.wordCount)}</span>
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 pt-1 whitespace-pre-line text-slate-700 dark:text-slate-300 leading-relaxed">
                        {s.headingPath.length > 1 && (
                          <div className="text-xs text-slate-400 mb-1">{s.headingPath.join(" > ")}</div>
                        )}
                        {s.text}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
