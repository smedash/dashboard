"use client";

import { useCallback, useEffect, useState } from "react";
import { useMessages } from "@/i18n/I18nProvider";
import { seoHelperKeywordMappingMessages } from "@/i18n/messages/seo-helper-keyword-mapping";
import { Modal, Notice, Spinner, apiFetch, buttonPrimary, buttonSecondary, inputClass } from "./ui";

interface PreviewResponse {
  sheet: string | null;
  mappingSheets: string[];
  headerRow: number | null;
  columns: Array<{ header: string; group: string | null; field: string | null }>;
  rowCount: number;
  withFocus: number;
  withSubs: number;
  newUrls: number;
  existingUrls: number;
  projectUrlCount: number;
  sample: Array<{ url: string; h1: string | null; focusKeyword: string | null; subKeywords: string[]; pageType: string | null }>;
  warnings: string[];
}

export function ImportDialog({
  projectId,
  initialFile,
  onClose,
  onImported,
}: {
  projectId: string;
  initialFile?: File | null;
  onClose: () => void;
  onImported: (message: string) => void;
}) {
  const t = useMessages(seoHelperKeywordMappingMessages);
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [sheet, setSheet] = useState<string>("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (isPreview: boolean, chosenSheet: string) => {
      if (!file) return null;
      const form = new FormData();
      form.append("file", file);
      form.append("preview", String(isPreview));
      form.append("mode", mode);
      if (chosenSheet) form.append("sheet", chosenSheet);
      return apiFetch<PreviewResponse & { created: number; updated: number }>(
        `/api/seo-helper/keyword-mapping/projects/${projectId}/import`,
        { method: "POST", body: form }
      );
    },
    [file, mode, projectId]
  );

  const loadPreview = useCallback(
    async (chosenSheet: string) => {
      setBusy("preview");
      setError(null);
      try {
        const res = await send(true, chosenSheet);
        if (res) {
          setPreview(res);
          setSheet(res.sheet ?? "");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t.errorGeneric);
        setPreview(null);
      } finally {
        setBusy(null);
      }
    },
    [send, t.errorGeneric]
  );

  useEffect(() => {
    if (file) void loadPreview("");
    // Nur bei neuer Datei neu analysieren
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const runImport = async () => {
    setBusy("import");
    setError(null);
    try {
      const res = await send(false, sheet);
      if (res) onImported(t.importDialog.done(res.created, res.updated));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
    } finally {
      setBusy(null);
    }
  };

  const fieldLabel = (field: string) => t.fields[field] ?? field;

  return (
    <Modal
      title={t.importDialog.title}
      onClose={onClose}
      wide
      footer={
        <>
          <button className={buttonSecondary} onClick={onClose}>
            {t.cancel}
          </button>
          <button
            className={buttonPrimary}
            disabled={!preview || preview.rowCount === 0 || busy !== null}
            onClick={runImport}
          >
            {busy === "import" && <Spinner />}
            {busy === "import" ? t.importDialog.importing : t.importDialog.submit(preview?.rowCount ?? 0)}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.importDialog.file}</span>
            <input
              type="file"
              accept=".xlsx"
              className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-teal-50 file:text-teal-700 dark:file:bg-teal-900/30 dark:file:text-teal-300"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && <span className="block mt-1 text-xs text-slate-500 truncate">{file.name}</span>}
          </label>
          {preview && preview.mappingSheets.length > 1 && (
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.importDialog.sheet}</span>
              <select
                className={inputClass}
                value={sheet}
                onChange={(e) => {
                  setSheet(e.target.value);
                  void loadPreview(e.target.value);
                }}
              >
                {preview.mappingSheets.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {preview && preview.projectUrlCount > 0 && (
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.importDialog.mode}</legend>
            {(["merge", "replace"] as const).map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
                {m === "merge" ? t.importDialog.modeMerge : t.importDialog.modeReplace}
              </label>
            ))}
            {mode === "replace" && <Notice kind="warning">{t.importDialog.replaceWarning}</Notice>}
          </fieldset>
        )}

        {error && <Notice kind="error">{error}</Notice>}
        {busy === "preview" && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> {t.importDialog.analyzing}
          </div>
        )}

        {preview && busy !== "preview" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              {preview.headerRow && <Badge>{t.importDialog.headerRow(preview.headerRow)}</Badge>}
              <Badge strong>{t.importDialog.rows(preview.rowCount)}</Badge>
              <Badge>{t.importDialog.withFocus(preview.withFocus)}</Badge>
              <Badge>{t.importDialog.withSubs(preview.withSubs)}</Badge>
              {preview.projectUrlCount > 0 && <Badge>{t.importDialog.newExisting(preview.newUrls, preview.existingUrls)}</Badge>}
            </div>

            {preview.warnings.length > 0 && (
              <Notice kind="warning">
                <div className="font-medium mb-1">{t.importDialog.warnings}</div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {preview.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Notice>
            )}

            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t.importDialog.columns}</h3>
              <div className="flex flex-wrap gap-1.5">
                {preview.columns
                  .filter((c) => c.header || c.field)
                  .map((c, i) => (
                    <span
                      key={`${c.header}-${i}`}
                      className={`px-2 py-0.5 rounded text-xs border ${
                        c.field
                          ? "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300"
                          : "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 text-slate-400 line-through"
                      }`}
                      title={c.field ? fieldLabel(c.field) : t.importDialog.unmapped}
                    >
                      {c.header || t.importDialog.unnamedColumn}
                      {c.field && <span className="text-teal-600/70 dark:text-teal-400/70"> → {fieldLabel(c.field)}</span>}
                    </span>
                  ))}
              </div>
            </div>

            {preview.sample.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t.importDialog.sample}</h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/40 text-slate-500">
                      <tr>
                        <th className="px-2 py-1.5 text-left">{t.fields.url}</th>
                        <th className="px-2 py-1.5 text-left">{t.fields.pageType}</th>
                        <th className="px-2 py-1.5 text-left">{t.fields.focusKeyword}</th>
                        <th className="px-2 py-1.5 text-left">{t.fields.subKeywords}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-300">
                      {preview.sample.map((r) => (
                        <tr key={r.url}>
                          <td className="px-2 py-1.5 max-w-xs truncate" title={r.url}>
                            {r.url.replace(/^https?:\/\/[^/]+/, "")}
                          </td>
                          <td className="px-2 py-1.5">{r.pageType ?? "–"}</td>
                          <td className="px-2 py-1.5 font-medium">{r.focusKeyword ?? "–"}</td>
                          <td className="px-2 py-1.5">{r.subKeywords.join(", ") || "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Badge({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span
      className={`px-2 py-1 rounded-lg text-xs ${
        strong
          ? "bg-teal-600 text-white"
          : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
      }`}
    >
      {children}
    </span>
  );
}
