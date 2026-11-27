"use client";

import { useState } from "react";
import { useMessages } from "@/i18n/I18nProvider";
import { seoHelperKeywordMappingMessages } from "@/i18n/messages/seo-helper-keyword-mapping";
import { Modal, Notice, Spinner, apiFetch, buttonPrimary, buttonSecondary } from "./ui";

type BlockedTopic = { key: string; topic: string; createdAt: string };

export function TopicBlocklistButton({
  projectId,
  editable,
  onRestored,
}: {
  projectId: string;
  editable: boolean;
  onRestored?: (text: string) => void;
}) {
  const t = useMessages(seoHelperKeywordMappingMessages);
  const tb = t.gapsTab.block;
  const [open, setOpen] = useState(false);
  const [topics, setTopics] = useState<BlockedTopic[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const show = async () => {
    setOpen(true);
    setTopics(null);
    setSelected(new Set());
    setError(null);
    try {
      const res = await apiFetch<{ topics: BlockedTopic[] }>(`/api/seo-helper/keyword-mapping/projects/${projectId}/topic-blocklist`);
      setTopics(res.topics);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
    }
  };

  const restore = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/seo-helper/keyword-mapping/projects/${projectId}/topic-blocklist`, {
        method: "DELETE",
        body: JSON.stringify({ keys: [...selected] }),
      });
      setOpen(false);
      onRestored?.(tb.restored(selected.size));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (key: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });

  return (
    <>
      <button className={buttonSecondary} title={tb.listHint} onClick={() => void show()}>
        {tb.listButton}
      </button>
      {open && (
        <Modal
          title={tb.listTitle}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className={buttonSecondary} onClick={() => setOpen(false)}>
                {tb.close}
              </button>
              {editable && (
                <button className={buttonPrimary} disabled={busy || selected.size === 0} onClick={() => void restore()}>
                  {busy && <Spinner />}
                  {tb.restore(selected.size)}
                </button>
              )}
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">{tb.listIntro}</p>
            {error && <Notice kind="error">{error}</Notice>}
            {topics === null && !error && (
              <div className="flex items-center gap-2 text-slate-500">
                <Spinner /> {t.loading}
              </div>
            )}
            {topics?.length === 0 && <p className="py-6 text-center text-sm text-slate-500">{tb.listEmpty}</p>}
            {topics && topics.length > 0 && (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/60 border-y border-slate-100 dark:border-slate-700/60">
                {topics.map((b) => (
                  <li key={b.key}>
                    <label className="flex items-center gap-2 py-1.5 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!editable}
                        checked={selected.has(b.key)}
                        onChange={(e) => toggle(b.key, e.target.checked)}
                      />
                      {b.topic}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
