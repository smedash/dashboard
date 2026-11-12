"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { canEdit } from "@/lib/rbac";
import { KVP_CATEGORIES } from "@/lib/kvp-categories";
import { useLocale, useMessages } from "@/i18n/I18nProvider";
import { seoHelperKeywordMappingMessages } from "@/i18n/messages/seo-helper-keyword-mapping";
import type { MapProjectDto } from "@/lib/keyword-map/shared";
import { ImportDialog } from "@/components/keyword-mapping/ImportDialog";
import {
  Modal,
  Notice,
  PageHeader,
  Spinner,
  apiFetch,
  buttonPrimary,
  buttonSecondary,
  formatNumber,
  inputClass,
} from "@/components/keyword-mapping/ui";

export default function KeywordMappingProjectsPage() {
  const t = useMessages(seoHelperKeywordMappingMessages);
  const { intlLocale } = useLocale();
  const router = useRouter();
  const { data: session } = useSession();
  const editable = canEdit(session?.user?.role);

  const [projects, setProjects] = useState<MapProjectDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [importFor, setImportFor] = useState<{ projectId: string; file: File | null } | null>(null);

  const load = useCallback(
    () =>
      apiFetch<{ projects: MapProjectDto[] }>("/api/seo-helper/keyword-mapping/projects")
        .then((res) => setProjects(res.projects))
        .catch((e: unknown) => setError(e instanceof Error ? e.message : t.errorGeneric)),
    [t.errorGeneric]
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        backHref="/seo-helper"
        actions={
          editable && (
            <button className={buttonPrimary} onClick={() => setShowCreate(true)}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t.projects.create}
            </button>
          )
        }
      />

      <div className="bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-900/20 dark:to-indigo-900/20 rounded-2xl p-5 border border-sky-200 dark:border-sky-800 text-sm text-slate-700 dark:text-slate-300">
        {t.projects.intro}
      </div>

      {error && <Notice kind="error">{error}</Notice>}

      {projects === null && !error ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Spinner /> {t.loading}
        </div>
      ) : projects && projects.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-500">
          {t.projects.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects?.map((p) => {
            const coverage = p.urlCount ? Math.round((p.focusCount / p.urlCount) * 100) : 0;
            return (
              <Link
                key={p.id}
                href={`/seo-helper/keyword-mapping/${p.id}`}
                className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400">
                    {p.name}
                  </h3>
                  {p.category && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {p.category}
                    </span>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Stat value={formatNumber(p.urlCount, intlLocale)} label={t.projects.urls} />
                  <Stat value={formatNumber(p.focusCount, intlLocale)} label={t.projects.focusCoverage} />
                  <Stat value={formatNumber(p.kvpCount, intlLocale)} label={t.projects.inKvp} />
                </div>
                <div className="mt-4 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full bg-teal-500" style={{ width: `${coverage}%` }} />
                </div>
                <div className="mt-3 text-xs text-slate-400">
                  {p.countryCode.toUpperCase()}/{p.languageCode} · {t.projects.updated}{" "}
                  {new Date(p.updatedAt).toLocaleDateString(intlLocale)}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateProjectDialog
          onClose={() => setShowCreate(false)}
          onCreated={(projectId, file) => {
            setShowCreate(false);
            if (file) setImportFor({ projectId, file });
            else router.push(`/seo-helper/keyword-mapping/${projectId}`);
          }}
        />
      )}

      {importFor && (
        <ImportDialog
          projectId={importFor.projectId}
          initialFile={importFor.file}
          onClose={() => router.push(`/seo-helper/keyword-mapping/${importFor.projectId}`)}
          onImported={() => router.push(`/seo-helper/keyword-mapping/${importFor.projectId}`)}
        />
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-xl font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function CreateProjectDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (projectId: string, file: File | null) => void;
}) {
  const t = useMessages(seoHelperKeywordMappingMessages);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [countryCode, setCountryCode] = useState("ch");
  const [languageCode, setLanguageCode] = useState("de");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ project: { id: string } }>("/api/seo-helper/keyword-mapping/projects", {
        method: "POST",
        body: JSON.stringify({ name, category: category || null, countryCode, languageCode }),
      });
      onCreated(res.project.id, file);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errorGeneric);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t.createDialog.title}
      onClose={onClose}
      footer={
        <>
          <button className={buttonSecondary} onClick={onClose}>
            {t.cancel}
          </button>
          <button className={buttonPrimary} disabled={!name.trim() || busy} onClick={submit}>
            {busy && <Spinner />}
            {t.createDialog.submit}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.createDialog.name}</span>
          <input
            className={inputClass}
            value={name}
            autoFocus
            placeholder={t.createDialog.namePlaceholder}
            onChange={(e) => {
              setName(e.target.value);
              const match = KVP_CATEGORIES.find((c) => c.toLowerCase() === e.target.value.trim().toLowerCase());
              if (match) setCategory(match);
            }}
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.createDialog.category}</span>
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t.createDialog.noCategory}</option>
            {KVP_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.createDialog.country}</span>
            <input className={inputClass} value={countryCode} maxLength={2} onChange={(e) => setCountryCode(e.target.value)} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.createDialog.language}</span>
            <input className={inputClass} value={languageCode} maxLength={2} onChange={(e) => setLanguageCode(e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.createDialog.file}</span>
          <input
            type="file"
            accept=".xlsx"
            className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-teal-50 file:text-teal-700 dark:file:bg-teal-900/30 dark:file:text-teal-300"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <span className="block mt-1 text-xs text-slate-500">{t.createDialog.fileHint}</span>
        </label>
        {error && <Notice kind="error">{error}</Notice>}
      </div>
    </Modal>
  );
}
