"use client";

import { useEffect, useRef, useState } from "react";
import { useMessages } from "@/i18n/I18nProvider";
import { seoHelperContentMappingMessages } from "@/i18n/messages/seo-helper-content-mapping";
import { Modal, Notice, Spinner, apiFetch, buttonDanger, buttonPrimary, buttonSecondary } from "@/components/keyword-mapping/ui";

interface Scope {
  q: string;
  country: string;
  language: string;
  section: string;
}

interface Step {
  done: boolean;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  remaining: number;
  errors: Array<{ url: string; error: string }>;
}

interface Totals {
  succeeded: number;
  failed: number;
  skipped: number;
  remaining: number;
}

export function CrawlBatchButton({ scope, onActivity }: { scope: Scope; onActivity?: () => void }) {
  const t = useMessages(seoHelperContentMappingMessages);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonPrimary} onClick={() => setOpen(true)}>
        {t.crawl.button}
      </button>
      {open && <CrawlDialog scope={scope} onActivity={onActivity} onClose={() => setOpen(false)} />}
    </>
  );
}

function CrawlDialog({ scope, onClose, onActivity }: { scope: Scope; onClose: () => void; onActivity?: () => void }) {
  const t = useMessages(seoHelperContentMappingMessages);
  const [pending, setPending] = useState<number | null>(null);
  const [force, setForce] = useState(false);
  const [running, setRunning] = useState(false);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [errors, setErrors] = useState<Array<{ url: string; error: string }>>([]);
  const [finished, setFinished] = useState<"done" | "stopped" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (running) return;
    let cancel = false;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(scope)) if (v) params.set(k, v);
    if (force) params.set("force", "1");
    apiFetch<{ pending: number }>(`/api/seo-helper/content-mapping/crawl?${params}`)
      .then((res) => {
        if (!cancel) setPending(res.pending);
      })
      .catch((e: unknown) => {
        if (!cancel) setError(e instanceof Error ? e.message : t.errorGeneric);
      });
    return () => {
      cancel = true;
    };
  }, [scope, force, running, t.errorGeneric]);

  const close = () => {
    stopRef.current = true;
    onClose();
  };

  const start = async () => {
    stopRef.current = false;
    setRunning(true);
    setError(null);
    setFinished(null);
    setErrors([]);
    const startedAt = new Date().toISOString();
    const acc: Totals = { succeeded: 0, failed: 0, skipped: 0, remaining: pending ?? 0 };
    setTotals({ ...acc });
    try {
      while (!stopRef.current) {
        const step = await apiFetch<Step>("/api/seo-helper/content-mapping/crawl", {
          method: "POST",
          body: JSON.stringify({ force, startedAt, scope }),
        });
        if (!mountedRef.current) return;
        acc.succeeded += step.succeeded;
        acc.failed += step.failed;
        acc.skipped += step.skipped;
        acc.remaining = step.remaining;
        setTotals({ ...acc });
        if (step.errors.length) setErrors((prev) => [...step.errors, ...prev].slice(0, 10));
        if (step.processed > 0) onActivity?.();
        if (step.done || step.processed === 0) {
          setFinished("done");
          return;
        }
      }
      setFinished("stopped");
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : t.errorGeneric);
    } finally {
      if (mountedRef.current) {
        setRunning(false);
        onActivity?.();
      }
    }
  };

  const doneCount = totals ? totals.succeeded + totals.failed + totals.skipped : 0;
  const total = totals ? doneCount + totals.remaining : pending ?? 0;
  const percent = total > 0 ? Math.min(100, Math.round((doneCount / total) * 100)) : 0;

  return (
    <Modal
      title={t.crawl.title}
      onClose={close}
      footer={
        running ? (
          <button type="button" className={buttonDanger} onClick={() => { stopRef.current = true; }}>
            {t.crawl.stop}
          </button>
        ) : (
          <>
            <button type="button" className={buttonSecondary} onClick={close}>
              {finished ? t.close : t.cancel}
            </button>
            {finished !== "done" && (
              <button type="button" className={buttonPrimary} disabled={!pending} onClick={() => void start()}>
                {t.crawl.start}
              </button>
            )}
          </>
        )
      }
    >
      <div className="space-y-4 text-sm">
        {!totals && <p className="text-slate-600 dark:text-slate-300">{t.crawl.hint}</p>}
        {error && <Notice kind="error">{error}</Notice>}

        {totals ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {running && <Spinner className="w-4 h-4 inline mr-2" />}
                {t.crawl.running(doneCount, total)}
              </span>
              <span className="text-slate-500">{percent} %</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div className="h-full bg-teal-500 transition-all" style={{ width: `${percent}%` }} />
            </div>
            {finished === "done" && (
              <Notice kind={totals.failed > 0 && totals.succeeded === 0 ? "error" : "success"}>
                {t.crawl.done(totals.succeeded, totals.failed, totals.skipped)}
              </Notice>
            )}
            {finished === "stopped" && <Notice kind="info">{t.crawl.stopped}</Notice>}
            {errors.length > 0 && (
              <div>
                <div className="font-medium text-slate-700 dark:text-slate-200 mb-1">{t.crawl.lastErrors}</div>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {errors.map((e, i) => (
                    <li key={`${e.url}-${i}`} className="text-xs">
                      <div className="truncate text-slate-700 dark:text-slate-200">{e.url}</div>
                      <div className="text-red-600 dark:text-red-400">{e.error}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {running && <p className="text-xs text-slate-500">{t.crawl.keepOpen}</p>}
          </div>
        ) : pending !== null ? (
          <div className="space-y-3 text-slate-700 dark:text-slate-200">
            {pending === 0 ? <Notice kind="info">{t.crawl.nothing}</Notice> : <div>{t.crawl.pending(pending)}</div>}
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={force} onChange={(e) => setForce(e.target.checked)} />
              <span>{t.crawl.force}</span>
            </label>
            <p className="text-xs text-slate-500">{t.crawl.keepOpen}</p>
          </div>
        ) : (
          !error && (
            <div className="flex items-center gap-2 text-slate-500">
              <Spinner /> {t.loading}
            </div>
          )
        )}
      </div>
    </Modal>
  );
}
