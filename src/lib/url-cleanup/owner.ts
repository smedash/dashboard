import type { Prisma } from "@prisma/client";
import { pathFromUrlOrPath, stripHtmlExt } from "./normalize";

export type OwnerFilter = "" | "with" | "without";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidOwnerEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

/** Pfad-Präfix wie `/ch/de/services/guide/pension/` → `/ch/de/services/guide/pension`; `null` für Root/ungültig. */
export function normalizeOwnerPrefix(input: string): string | null {
  const p = pathFromUrlOrPath(input);
  if (!p || p === "/") return null;
  return stripHtmlExt(p);
}

export function looksLikePath(input: string): boolean {
  const t = input.trim();
  return t.startsWith("/") || /^https?:\/\//i.test(t);
}

/** Die Seite selbst (`/x/y/z`, `/x/y/z.html`) plus alles darunter (`/x/y/z/…`). */
export function ownerPrefixWhere(prefix: string): Prisma.UrlInventoryWhereInput {
  return {
    OR: [
      { urlKeyNoHtml: prefix },
      { urlKey: { startsWith: `${prefix}/` } },
    ],
  };
}

export function ownerFilterWhere(filter: OwnerFilter): Prisma.UrlInventoryWhereInput | null {
  if (filter === "without") return { ownerName: null, ownerEmail: null };
  if (filter === "with") return { OR: [{ ownerName: { not: null } }, { ownerEmail: { not: null } }] };
  return null;
}

export function parseOwnerFilter(value: string | null): OwnerFilter {
  return value === "with" || value === "without" ? value : "";
}
