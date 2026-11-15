"use client";

import { useEffect, useRef, useState } from "react";
import { useMessages } from "@/i18n/I18nProvider";
import { seoHelperKeywordMappingMessages } from "@/i18n/messages/seo-helper-keyword-mapping";
import { Modal, Notice, Spinner, apiFetch, buttonDanger, buttonPrimary, buttonSecondary } from "@/components/keyword-mapping/ui";

interface Preview {
  totalUrls: number;
  skippedNoKeyword: number;
  skippedDone: number;
  pending: number;
  resumable: number;
  newJobs: number;
  credits: number | null;
  projects: { name: string; count: number }[];
}

const STARTED_DELAY_MS = 3_000;
const WAITING_DELAY_MS = 10_000;
const MAX_SAME_FAILURES = 5;

interface Step {
  done: boolean;
  phase: "analyzed" | "started" | "waiting" | "rateLimited" | "done";
  retryAfterMs?: number;
  total: number;
  succeeded: number;
  failed: number;
  waiting: number;
  remaining: number;
  current: {
    projectName: string;
    url: string;
    keyword: string;
    outcome: "succeeded" | "failed" | "waiting" | "started";
    coverageScore: number | null;
    error: string | null;
  } | null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function TopicGapBatchButton({ projectId, onActivity }: { projectId?: string; onActivity?: () => void }) {
  const t = useMessages(seoHelperKeywordMappingMessages);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={buttonSecondary} onClick={() => setOpen(true)}>
        {t.batch.button}
      </button>
      {open && (
        <TopicGapBatchDialog
          projectId={projectId}
          onActivity={onActivity}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function TopicGapBatchDialog({
  projectId,
  onClose,
  onActivity,
}: {
  projectId?: string;
  onClose: () => void;
  onActivity?: () => void;
}) {
  const t = useMessages(seoHelperKeywordMappingMessages);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [force, setForce] = useState(false);
  const [refreshTopics, setRefreshTopics] = useState(false);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aborted, setAborted] = useState<string | null>(null);
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
    if (projectId) params.set("projectId", projectId);
    if (force) params.set("force", "1");
    if (refreshTopics) params.set("refreshTopics", "1");
    apiFetch<Preview>(`/api/seo-helper/keyword-mapping/topic-gap/batch?${params}`)
      .then((res) => {
        if (!cancel) setPreview(res);
      })
      .catch((e: unknown) => {
        if (!cancel) setError(e instanceof Error ? e.message : t.errorGeneric);
      });
    return () => {
      cancel = true;
    };
  }, [projectId, force, refreshTopics, running, t.errorGeneric]);

  const close = () => {
    stopRef.current = true;
    onClose();
  };

  const start = async () => {
    stopRef.current = false;
    setRunning(true);
    setError(null);
    setAborted(null);
    const startedAt = new Date().toISOString();
    let lastFailure: string | null = null;
    let sameFailures = 0;
    try {
      while (!stopRef.current) {
        const next = await apiFetch<Step>("/api/seo-helper/keyword-mapping/topic-gap/batch", {
          method: "POST",
          body: JSON.stringify({ projectId: projectId ?? null, force, refreshTopics, startedAt }),
        });
        if (!mountedRef.current || stopRef.current) break;
        setStep(next);
        const outcome = next.current?.outcome;
        if (outcome === "succeeded" || outcome === "failed") onActivity?.();
        if (next.done) break;

        if (outcome === "failed") {
          const failure = next.current?.error ?? "";
          sameFailures = failure === lastFailure ? sameFailures + 1 : 1;
          lastFailure = failure;
          if (sameFailures >= MAX_SAME_FAILURES) {
            setAborted(t.batch.abortedRepeated(MAX_SAME_FAILURES, failure));
            break;
          }
        } else if (outcome === "succeeded") {
          sameFailures = 0;
          lastFailure = null;
        }

        const delay =
          next.phase === "rateLimited"
            ? next.retryAfterMs ?? 30_000
            : next.phase === "waiting"
              ? WAITING_DELAY_MS
              : next.phase === "started"
                ? STARTED_DELAY_MS
                : 300;
        await sleep(delay);
      }
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : t.errorGeneric);
    } finally {
      if (mountedRef.current) {
        setRunning(false);
        onActivity?.();
      }
    }
  };

  const doneCount = step ? step.succeeded + step.failed : 0;
  const total = step?.total ?? preview?.pending ?? 0;
  const percent = total > 0 ? Math.min(100, Math.round((doneCount / total) * 100)) : 0;
  const creditsShort = preview?.credits !== null && preview !== null && preview.newJobs > preview.credits;
  const finished = (step?.done === true || aborted !== null) && !running;

  return (
    <Modal title={projectId ? t.batch.titleProject : t.batch.title} onClose={close} footer={
      finished ? (
        <button type="button" className={buttonPrimary} onClick={close}>
          {t.close}
        </button>
      ) : running ? (
        <button type="button" className={buttonDanger} onClick={() => { stopRef.current = true; }}>
          {t.batch.stop}
        </button>
      ) : (
        <>
          <button type="button" className={buttonSecondary} onClick={close}>
            {t.cancel}
          </button>
          <button
            type="button"
            className={buttonPrimary}
            disabled={!preview || preview.pending === 0 || creditsShort || running}
            onClick={() => void start()}
          >
            {t.batch.start}
          </button>
        </>
      )
    }>
      <div className="space-y-4">
        {!step && <p className="text-sm text-slate-600 dark:text-slate-300">{t.batch.hint}</p>}
        {error && <Notice kind="error">{error}</Notice>}

        {step ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {running && <Spinner className="w-4 h-4 inline mr-2" />}
                {t.batch.running(doneCount, total)}
              </span>
              <span className="text-slate-500">{percent} %</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div className="h-full bg-teal-500 transition-all" style={{ width: `${percent}%` }} />
            </div>
            {step.current && (
              <div className="text-sm">
                <div className="truncate text-slate-800 dark:text-slate-100">{step.current.url}</div>
                <div className="text-slate-500">{t.batch.current(step.current.projectName, step.current.keyword)}</div>
                {step.current.outcome === "succeeded" && step.current.coverageScore !== null && (
                  <div className="text-emerald-700 dark:text-emerald-300">{t.batch.coverage(step.current.coverageScore)}</div>
                )}
                {step.current.outcome === "failed" && step.current.error && (
                  <div className="text-red-600 dark:text-red-400">{step.current.error}</div>
                )}
                {running && step.phase === "waiting" && <div className="text-slate-500">{t.batch.waiting}</div>}
                {running && step.phase === "started" && <div className="text-slate-500">{t.batch.startedGraphs}</div>}
                {running && step.phase === "rateLimited" && (
                  <div className="text-amber-600 dark:text-amber-400">
                    {t.batch.rateLimited(Math.round((step.retryAfterMs ?? 30_000) / 1000))}
                  </div>
                )}
              </div>
            )}
            {aborted && !running && <Notice kind="error">{aborted}</Notice>}
            {finished && !aborted && (
              <Notice kind={step.failed > 0 && step.succeeded === 0 ? "error" : "success"}>
                {t.batch.done(step.succeeded, step.failed, step.waiting)}
              </Notice>
            )}
            {running && <p className="text-xs text-slate-500">{t.batch.keepOpen}</p>}
          </div>
        ) : preview ? (
          <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            {preview.pending === 0 ? (
              <Notice kind="info">{t.batch.nothing}</Notice>
            ) : (
              <>
                <div>{t.batch.urls(preview.pending)}</div>
                {preview.resumable > 0 && <div className="text-slate-500">{t.batch.resumable(preview.resumable)}</div>}
                <div className="text-slate-500">{t.batch.skippedDone(preview.skippedDone)}</div>
                <div className="text-slate-500">{t.batch.skippedNoKeyword(preview.skippedNoKeyword)}</div>
                <div>{t.batch.newJobs(preview.newJobs)}</div>
                {preview.credits !== null && <div>{t.batch.credits(preview.credits)}</div>}
                {creditsShort && preview.credits !== null && (
                  <Notice kind="warning">{t.batch.creditsShort(preview.newJobs, preview.credits)}</Notice>
                )}
                <ul className="space-y-1 text-slate-500">
                  {preview.projects.map((project) => (
                    <li key={project.name}>
                      {project.name}: {project.count}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={force} onChange={(e) => setForce(e.target.checked)} />
              <span>{t.batch.force}</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={refreshTopics} onChange={(e) => setRefreshTopics(e.target.checked)} />
              <span>{t.batch.refreshTopics}</span>
            </label>
            <p className="text-xs text-slate-500">{t.batch.keepOpen}</p>
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
