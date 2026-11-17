"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { hasFullAdminRights } from "@/lib/rbac";
import { useMessages } from "@/i18n/I18nProvider";
import { urlCleanupMessages } from "@/i18n/messages/url-cleanup";

type Row = {
  id: string;
  url: string;
  urlKey: string;
  country: string | null;
  language: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerUpdatedAt: string | null;
};

type KnownOwner = { name: string | null; email: string | null; count: number };
type OwnerFilter = "" | "with" | "without";

const PAGE_SIZE = 50;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const inputClass =
  "px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800";

function pathLevels(path: string): string[] {
  const parts = path.replace(/\.html$/i, "").split("/").filter(Boolean);
  return parts.map((_, i) => `/${parts.slice(0, i + 1).join("/")}`);
}

export default function ZustaendigkeitPage() {
  const t = useMessages(urlCleanupMessages);
  const o = t.ownership;
  const { data: session } = useSession();
  const isAdmin = hasFullAdminRights(session?.user?.role);
  const fmt = (n: number) => n.toLocaleString(t.displayLocale);

  const [q, setQ] = useState("");
  const [person, setPerson] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("");
  const [debounced, setDebounced] = useState({ q: "", person: "" });
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [prefix, setPrefix] = useState<string | null>(null);
  const [scope, setScope] = useState({ total: 0, withoutOwner: 0 });
  const [owners, setOwners] = useState<KnownOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editSource, setEditSource] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [applyToPrefix, setApplyToPrefix] = useState(false);
  const [onlyWithout, setOnlyWithout] = useState(false);
  const [createUser, setCreateUser] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced({ q, person });
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [q, person]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (debounced.q) params.set("q", debounced.q);
    if (debounced.person) params.set("person", debounced.person);
    if (ownerFilter) params.set("owner", ownerFilter);
    const res = await fetch(`/api/url-cleanup/owner?${params.toString()}`);
    const data = await res.json();
    setRows(data.rows ?? []);
    setTotal(data.total ?? 0);
    setPrefix(data.prefix ?? null);
    setScope(data.scope ?? { total: 0, withoutOwner: 0 });
    setOwners(data.owners ?? []);
    setLoading(false);
  }, [debounced, ownerFilter, page]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const prefixLabel = prefix ? `${prefix}/` : "";
  const usePrefix = applyToPrefix && !!prefix;
  const targetCount = usePrefix ? (onlyWithout ? scope.withoutOwner : scope.total) : selected.size;
  const levels = useMemo(() => pathLevels(editSource ?? prefix ?? ""), [editSource, prefix]);

  function onNameChange(value: string) {
    setName(value);
    const known = owners.find((k) => k.name === value);
    if (known?.email && !email) setEmail(known.email);
  }

  function startEdit(r: Row) {
    setSelected(new Set([r.id]));
    setName(r.ownerName ?? "");
    setEmail(r.ownerEmail ?? "");
    setEditSource(r.urlKey);
    setApplyToPrefix(false);
    setMsg(null);
  }

  function chooseLevel(level: string) {
    setQ(`${level}/`);
    setApplyToPrefix(true);
    setEditSource(null);
  }

  async function submit(clear: boolean) {
    setMsg(null);
    const ownerName = clear ? "" : name.trim();
    const ownerEmail = clear ? "" : email.trim();
    if (!clear && !ownerName && !ownerEmail) {
      setMsg({ text: o.nameOrEmailRequired, error: true });
      return;
    }
    if (ownerEmail && !EMAIL_RE.test(ownerEmail)) {
      setMsg({ text: o.invalidEmail, error: true });
      return;
    }
    const inviteUser = !clear && isAdmin && createUser;
    if (inviteUser && !ownerEmail) {
      setMsg({ text: o.emailRequiredForUser, error: true });
      return;
    }
    if (targetCount === 0) return;
    const count = clear && usePrefix ? scope.total : targetCount;
    if (clear && !window.confirm(o.confirmClear(fmt(count)))) return;
    if (!clear && usePrefix && !window.confirm(o.confirmPrefix(fmt(count), prefixLabel))) return;

    setSaving(true);
    try {
      const body = usePrefix
        ? { prefix, onlyWithoutOwner: clear ? false : onlyWithout, ownerName, ownerEmail, createUser: inviteUser }
        : { ids: [...selected], ownerName, ownerEmail, createUser: inviteUser };
      const res = await fetch("/api/url-cleanup/owner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ text: data.error || t.error, error: true });
        return;
      }
      const updated = fmt(data.updated ?? 0);
      const userNote =
        data.userStatus === "created"
          ? ` · ${o.userCreated(ownerEmail)}`
          : data.userStatus === "exists"
            ? ` · ${o.userExists(ownerEmail)}`
            : "";
      setMsg({ text: (clear ? o.cleared(updated) : o.saved(updated)) + userNote });
      setCreateUser(false);
      setSelected(new Set());
      setEditSource(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "", label: o.filterAll },
            { id: "without", label: o.filterWithout },
            { id: "with", label: o.filterWith },
          ] as const
        ).map((f) => (
          <button
            key={f.id || "all"}
            type="button"
            onClick={() => {
              setOwnerFilter(f.id);
              setPage(0);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border ${
              ownerFilter === f.id
                ? "bg-blue-600 text-white border-blue-600"
                : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setEditSource(null);
          }}
          placeholder={o.searchPlaceholder}
          className={`${inputClass} lg:col-span-2`}
        />
        <input
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          placeholder={o.personPlaceholder}
          className={inputClass}
        />
      </div>
      <div className="text-xs text-slate-500 space-x-2">
        <span>{o.scopeSummary(fmt(scope.total), fmt(scope.withoutOwner))}</span>
        {prefix && <span>· {o.prefixHint(prefixLabel)}</span>}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{o.editorTitle}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={o.name}
            list="url-cleanup-owner-names"
            className={inputClass}
          />
          <div className="flex flex-col gap-1">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={o.email}
              list="url-cleanup-owner-emails"
              className={inputClass}
            />
            {isAdmin && (
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={createUser} onChange={(e) => setCreateUser(e.target.checked)} />
                <span>{o.createUser}</span>
              </label>
            )}
          </div>
          <datalist id="url-cleanup-owner-names">
            {[...new Set(owners.map((k) => k.name).filter(Boolean))].map((n) => (
              <option key={n} value={n!} />
            ))}
          </datalist>
          <datalist id="url-cleanup-owner-emails">
            {[...new Set(owners.map((k) => k.email).filter(Boolean))].map((m) => (
              <option key={m} value={m!} />
            ))}
          </datalist>
        </div>

        {levels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-slate-500 mr-1">{o.pathSegments}</span>
            {levels.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => chooseLevel(level)}
                className={`px-2 py-0.5 rounded border font-mono ${
                  prefix === level
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                {level}/
              </button>
            ))}
          </div>
        )}

        {prefix && (
          <div className="space-y-1 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={applyToPrefix}
                onChange={(e) => setApplyToPrefix(e.target.checked)}
              />
              <span>
                {o.applyToPrefix(prefixLabel, fmt(scope.total))}
              </span>
            </label>
            {applyToPrefix && (
              <label className="flex items-center gap-2 pl-6 text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={onlyWithout} onChange={(e) => setOnlyWithout(e.target.checked)} />
                <span>{o.onlyWithoutOwner(fmt(scope.withoutOwner))}</span>
              </label>
            )}
          </div>
        )}

        {!usePrefix && (
          <p className="text-xs text-slate-500">
            {selected.size > 0 ? o.targetSelected(selected.size) : o.targetNone}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving || targetCount === 0}
            onClick={() => submit(false)}
            className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-40"
          >
            {saving ? o.saving : o.save}
          </button>
          <button
            type="button"
            disabled={saving || targetCount === 0}
            onClick={() => submit(true)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-40"
          >
            {o.clear}
          </button>
          {msg && (
            <span className={`text-xs ${msg.error ? "text-red-600 dark:text-red-400" : "text-slate-500"}`}>
              {msg.text}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-x-auto">
        <table className="w-full min-w-[48rem] table-fixed text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs uppercase text-slate-500">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && rows.every((r) => selected.has(r.id))}
                  onChange={(e) => {
                    setEditSource(null);
                    if (e.target.checked) setSelected(new Set(rows.map((r) => r.id)));
                    else setSelected(new Set());
                  }}
                />
              </th>
              <th className="px-3 py-2 text-left">{o.columns.url}</th>
              <th className="w-[30%] px-3 py-2 text-left">{o.columns.owner}</th>
              <th className="w-28 px-3 py-2 text-left">{o.columns.updated}</th>
              <th className="w-24 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {t.loading}
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  {o.noResults}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={(e) => {
                        const n = new Set(selected);
                        if (e.target.checked) n.add(r.id);
                        else n.delete(r.id);
                        setSelected(n);
                      }}
                    />
                  </td>
                  <td className="px-3 py-2 align-top overflow-hidden">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline break-all line-clamp-2"
                      title={r.url}
                    >
                      {r.url.replace("https://www.ubs.com", "")}
                    </a>
                    <div className="text-[10px] text-slate-400 uppercase truncate">
                      {[r.country, r.language].filter(Boolean).join(" / ")}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-xs overflow-hidden">
                    {r.ownerName || r.ownerEmail ? (
                      <>
                        <div className="truncate">{r.ownerName ?? "—"}</div>
                        {r.ownerEmail && (
                          <a
                            href={`mailto:${r.ownerEmail}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline truncate block"
                          >
                            {r.ownerEmail}
                          </a>
                        )}
                      </>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        {o.noOwner}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-slate-500">
                    {r.ownerUpdatedAt ? new Date(r.ownerUpdatedAt).toLocaleDateString(t.displayLocale) : "—"}
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-600"
                    >
                      {o.edit}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 text-sm">
          <span className="text-slate-500">
            {t.inventory.page(page + 1, pageCount)} · {fmt(total)} URLs
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-40"
            >
              {t.inventory.previous}
            </button>
            <button
              type="button"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((p) => p + 1)}
              className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 disabled:opacity-40"
            >
              {t.inventory.next}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
