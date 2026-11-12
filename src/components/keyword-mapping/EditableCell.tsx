"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Zelle mit Klick-zum-Bearbeiten. Enter/Blur speichert, Escape verwirft.
 * Mit `options` gibt es eine Vorschlagsliste, freie Eingaben bleiben möglich.
 */
export function EditableCell({
  value,
  onSave,
  editable,
  options,
  placeholder,
  className = "",
  multiline,
}: {
  value: string | null;
  onSave: (value: string | null) => Promise<void> | void;
  editable: boolean;
  options?: string[];
  placeholder?: string;
  className?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = async () => {
    const next = draft.trim() || null;
    if (next === (value ?? null)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        disabled={!editable}
        onClick={() => setEditing(true)}
        className={`w-full text-left rounded px-1 -mx-1 min-h-[1.5rem] ${
          editable ? "hover:bg-teal-50 dark:hover:bg-teal-900/20 cursor-text" : "cursor-default"
        } ${value ? "" : "text-slate-300 dark:text-slate-600"} ${className}`}
        title={value ?? undefined}
      >
        <span className={multiline ? "line-clamp-2 whitespace-pre-line" : "block truncate"}>{value || placeholder || "–"}</span>
      </button>
    );
  }

  const shared = {
    ref: inputRef,
    value: draft,
    disabled: saving,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: () => void commit(),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void commit();
      }
      if (e.key === "Escape") {
        setDraft(value ?? "");
        setEditing(false);
      }
    },
    className:
      "w-full px-1.5 py-0.5 rounded border border-teal-400 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500",
  };

  return (
    <>
      {multiline ? <textarea rows={3} {...shared} /> : <input list={options ? listId : undefined} {...shared} />}
      {options && (
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </>
  );
}
