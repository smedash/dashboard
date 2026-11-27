"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMessages } from "@/i18n/I18nProvider";
import { seoHelperKeywordMappingMessages } from "@/i18n/messages/seo-helper-keyword-mapping";
import type { TopicArticleSuggestion } from "@/lib/keyword-map/shared";
import { Modal, Notice, Spinner, apiFetch, buttonPrimary, buttonSecondary } from "./ui";

const LOADING_STEP_MS = 3000;

/** Vorkommen des Topics in einer Gap-Analyse (`index` = Position in `results`); gespeichert wird am ersten */
export interface TopicSuggestionOccurrence {
  urlId: string;
  gapId: string;
  index: number;
}

export function TopicSuggestionsModal({
  projectId,
  topic,
  occurrences,
  plannedDate,
  onSaved,
  onClose,
}: {
  projectId: string;
  topic: string;
  occurrences: TopicSuggestionOccurrence[];
  plannedDate: string;
  onSaved: (articleId: string) => void;
  onClose: () => void;
}) {
  const t = useMessages(seoHelperKeywordMappingMessages).gapsTab.suggest;
  const [result, setResult] = useState<{ suggestions: TopicArticleSuggestion[]; existingCount: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState<Set<number>>(new Set());

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(new Set());
    try {
      setResult(
        await apiFetch(`/api/seo-helper/keyword-mapping/projects/${projectId}/topic-gaps/suggestions`, {
          method: "POST",
          body: JSON.stringify({ occurrences: occurrences.map((o) => ({ gapId: o.gapId, index: o.index })) }),
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [projectId, occurrences]);

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void generate();
  }, [generate]);

  useEffect(() => {
    if (!loading) return;
    setLoadingStep(0);
    const timer = setInterval(() => setLoadingStep((s) => Math.min(s + 1, t.loading.length - 1)), LOADING_STEP_MS);
    return () => clearInterval(timer);
  }, [loading, t.loading.length]);

  const save = async (index: number, suggestion: TopicArticleSuggestion) => {
    const target = occurrences[0];
    setSaving((prev) => new Set(prev).add(index));
    setError(null);
    try {
      const res = await apiFetch<{ article: { id: string } }>(`/api/seo-helper/keyword-mapping/urls/${target.urlId}/topic-gap/editorial`, {
        method: "POST",
        body: JSON.stringify({
          gapId: target.gapId,
          index: target.index,
          plannedDate,
          title: suggestion.title,
          suggestionReason: suggestion.reason,
        }),
      });
      setSaved((prev) => new Set(prev).add(index));
      onSaved(res.article.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  return (
    <Modal
      title={`${t.title}: ${topic}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button className={buttonSecondary} disabled={loading} onClick={() => void generate()}>
            {t.regenerate}
          </button>
          <button className={buttonPrimary} onClick={onClose}>
            {t.done}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-3">
          <Notice kind="error">{error}</Notice>
        </div>
      )}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-4 text-sm text-slate-600 dark:text-slate-400">
          <Spinner className="w-8 h-8 text-teal-600" />
          {t.loading[loadingStep]}
        </div>
      )}
      {result && (
        <>
          <div className="flex items-center gap-2 mb-2 text-xs text-slate-400 dark:text-slate-500">
            <span>{t.meta(result.existingCount, result.suggestions.length)}</span>
            {saved.size > 0 && <span className="ml-auto font-medium text-emerald-600 dark:text-emerald-400">{t.savedCount(saved.size)}</span>}
          </div>
          {result.suggestions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">{t.empty}</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700/60 border-y border-slate-100 dark:border-slate-700/60">
              {result.suggestions.map((s, i) => {
                const isSaved = saved.has(i);
                const isSaving = saving.has(i);
                return (
                  <li key={i} className="flex items-start gap-3 py-3">
                    <span className="w-5 mt-0.5 shrink-0 text-right text-xs font-bold text-teal-500">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{s.title}</p>
                      {s.reason && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{s.reason}</p>}
                    </div>
                    <button
                      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isSaved
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 cursor-default"
                          : "bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-700 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-teal-900/30 dark:hover:text-teal-300"
                      }`}
                      disabled={isSaved || isSaving}
                      title={isSaved ? t.alreadySaved : t.saveHint}
                      onClick={() => void save(i, s)}
                    >
                      {isSaving && <Spinner className="w-3.5 h-3.5" />}
                      {isSaved ? `✓ ${t.saved}` : isSaving ? t.saving : `+ ${t.save}`}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Modal>
  );
}
