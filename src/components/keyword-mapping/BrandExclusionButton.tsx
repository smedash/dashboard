"use client";

import { useState } from "react";
import { useMessages } from "@/i18n/I18nProvider";
import { seoHelperKeywordMappingMessages } from "@/i18n/messages/seo-helper-keyword-mapping";
import { Modal, Notice, Spinner, apiFetch, buttonPrimary, buttonSecondary, inputClass } from "./ui";

export function BrandExclusionButton({ editable, onSaved }: { editable: boolean; onSaved?: (text: string) => void }) {
  const t = useMessages(seoHelperKeywordMappingMessages);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const show = async () => {
    setOpen(true);
    setText(null);
    setError(null);
    try {
      const res = await apiFetch<{ excludedBrands: string[] }>("/api/seo-helper/keyword-mapping/settings");
      setText(res.excludedBrands.join("\n"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ excludedBrands: string[]; excluded: number; restored: number }>("/api/seo-helper/keyword-mapping/settings", {
        method: "PUT",
        body: JSON.stringify({ excludedBrands: (text ?? "").split("\n") }),
      });
      setOpen(false);
      onSaved?.(t.brands.saved(res.excludedBrands.length, res.excluded, res.restored));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className={buttonSecondary} title={t.brands.hint} onClick={() => void show()}>
        {t.brands.button}
      </button>
      {open && (
        <Modal
          title={t.brands.title}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className={buttonSecondary} onClick={() => setOpen(false)}>
                {t.cancel}
              </button>
              {editable && (
                <button className={buttonPrimary} disabled={busy || text === null} onClick={() => void save()}>
                  {busy && <Spinner />}
                  {t.save}
                </button>
              )}
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">{t.brands.intro}</p>
            {text === null && !error ? (
              <div className="flex items-center gap-2 text-slate-500">
                <Spinner /> {t.loading}
              </div>
            ) : (
              <textarea
                className={`${inputClass} font-mono`}
                rows={14}
                autoFocus
                readOnly={!editable}
                value={text ?? ""}
                placeholder={t.brands.placeholder}
                onChange={(e) => setText(e.target.value)}
              />
            )}
            {busy && <p className="text-xs text-slate-500">{t.brands.applying}</p>}
            {error && <Notice kind="error">{error}</Notice>}
          </div>
        </Modal>
      )}
    </>
  );
}
