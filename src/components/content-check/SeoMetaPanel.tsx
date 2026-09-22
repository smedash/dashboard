"use client";

const TITLE_MIN = 50;
const TITLE_MAX = 60;
const DESC_MIN = 140;
const DESC_MAX = 160;

function countClass(length: number, min: number, max: number) {
  if (length > max) return "text-red-600 dark:text-red-400";
  if (length >= min) return "text-emerald-600 dark:text-emerald-400";
  return "text-amber-600 dark:text-amber-400";
}

function barClass(length: number, min: number, max: number) {
  if (length > max) return "bg-red-500";
  if (length >= min) return "bg-emerald-500";
  return "bg-amber-500";
}

export function SeoMetaPanel({
  metaTitle,
  metaDescription,
  onMetaTitleChange,
  onMetaDescriptionChange,
  readOnly = false,
  onSave,
  saving = false,
  saveSuccess = false,
  dirty = false,
}: {
  metaTitle: string;
  metaDescription: string;
  onMetaTitleChange?: (value: string) => void;
  onMetaDescriptionChange?: (value: string) => void;
  readOnly?: boolean;
  onSave?: () => void;
  saving?: boolean;
  saveSuccess?: boolean;
  dirty?: boolean;
}) {
  const titleLen = metaTitle.length;
  const descLen = metaDescription.length;
  const previewTitle = titleLen > TITLE_MAX ? `${metaTitle.slice(0, TITLE_MAX)}…` : metaTitle;
  const previewDesc = descLen > DESC_MAX ? `${metaDescription.slice(0, DESC_MAX)}…` : metaDescription;
  const inputClass =
    "w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70";

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Title & Meta Description</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Sachlich, im Bank-Sprech. Klickstark durch Klarheit – nicht durch Werbesprache.
          </p>
        </div>
        {onSave && !readOnly && (
          <div className="flex items-center gap-2 shrink-0">
            {saveSuccess && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">Gespeichert</span>
            )}
            {dirty && !saveSuccess && (
              <span className="text-xs text-amber-600 dark:text-amber-400">Ungespeichert</span>
            )}
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !dirty}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Title</label>
              <span className={`text-xs font-medium ${countClass(titleLen, TITLE_MIN, TITLE_MAX)}`}>
                {titleLen}/{TITLE_MAX}
              </span>
            </div>
            <input
              value={metaTitle}
              onChange={(e) => onMetaTitleChange?.(e.target.value)}
              readOnly={readOnly}
              disabled={readOnly}
              className={inputClass}
              placeholder="SEO-Title | UBS"
            />
            <div className="mt-1.5 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${barClass(titleLen, TITLE_MIN, TITLE_MAX)}`}
                style={{ width: `${Math.min((titleLen / 70) * 100, 100)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Meta Description</label>
              <span className={`text-xs font-medium ${countClass(descLen, DESC_MIN, DESC_MAX)}`}>
                {descLen}/{DESC_MAX}
              </span>
            </div>
            <textarea
              value={metaDescription}
              onChange={(e) => onMetaDescriptionChange?.(e.target.value)}
              readOnly={readOnly}
              disabled={readOnly}
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="Sachliche Beschreibung mit klarem Nutzen, 140–160 Zeichen."
            />
            <div className="mt-1.5 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${barClass(descLen, DESC_MIN, DESC_MAX)}`}
                style={{ width: `${Math.min((descLen / 180) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-3">Google-Vorschau</p>
          <div className="flex items-center gap-2 text-sm mb-1">
            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-semibold text-red-600">U</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-700 dark:text-slate-300 truncate">ubs.com</p>
              <p className="text-[11px] text-slate-400 truncate">www.ubs.com › guide</p>
            </div>
          </div>
          <p className="text-[18px] leading-snug text-[#1a0dab] dark:text-blue-400 hover:underline cursor-default">
            {previewTitle || "SEO-Title"}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
            {previewDesc || "Meta Description erscheint hier."}
          </p>
        </div>
      </div>
    </div>
  );
}
