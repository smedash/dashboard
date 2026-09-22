"use client";

import { useState } from "react";

type Preview = {
  headers: string[];
  guessedUrl: string;
  columns: Array<{ key: string; label: string; type: string }>;
  sample: string[][];
  rowCount: number;
  probeMatchRate: number;
};

export function DimensionImport({ onImported }: { onImported?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [urlColumn, setUrlColumn] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function runPreview() {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("preview", "true");
      fd.set("name", name);
      const res = await fetch("/api/url-cleanup/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview fehlgeschlagen");
      setPreview(data);
      setUrlColumn(data.guessedUrl);
      if (!name) setName(file.name.replace(/\.xlsx?$/i, ""));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("name", name || file.name);
      fd.set("urlColumn", urlColumn);
      if (periodStart) fd.set("periodStart", periodStart);
      if (periodEnd) fd.set("periodEnd", periodEnd);
      const res = await fetch("/api/url-cleanup/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import fehlgeschlagen");
      setMsg(
        `Importiert: ${data.dimension.matchedCount.toLocaleString("de-CH")} Matches, ${data.dimension.unmatchedCount.toLocaleString("de-CH")} ohne Inventar-Treffer`
      );
      setPreview(null);
      onImported?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dimensionsname"
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        />
        <input
          type="date"
          value={periodStart}
          onChange={(e) => setPeriodStart(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        />
        <input
          type="date"
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!file || busy}
          onClick={runPreview}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50"
        >
          Preview
        </button>
        <button
          type="button"
          disabled={!file || busy || !urlColumn}
          onClick={runImport}
          className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
        >
          {busy ? "Bitte warten…" : "Importieren"}
        </button>
      </div>
      {preview && (
        <div className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
          <p>
            {preview.rowCount.toLocaleString("de-CH")} Zeilen · geschätzte Match-Rate{" "}
            {(preview.probeMatchRate * 100).toFixed(1)}% (Stichprobe)
          </p>
          <label className="block text-xs">
            URL-Spalte
            <select
              value={urlColumn}
              onChange={(e) => setUrlColumn(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            >
              {preview.headers.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs">
            Weitere Spalten: {preview.columns.map((c) => `${c.key} (${c.type})`).join(", ") || "—"}
          </p>
        </div>
      )}
      {msg && <p className="text-sm text-slate-600 dark:text-slate-300">{msg}</p>}
    </div>
  );
}
