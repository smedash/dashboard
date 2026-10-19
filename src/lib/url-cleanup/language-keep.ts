/**
 * Wenn eine Sprachversion einer Seite Keep ist, werden die übrigen
 * Sprachversionen derselben Seite ebenfalls Keep.
 *
 * Gruppiert wird über den Pfad: nur das Sprachsegment unterscheidet sich
 * (`/ch/de/…`, `/ch/fr/…`, `/ch/en/…`, bei Microsites `/microsites/{site}/{lang}/…`).
 * MustKeep (Allowlist) bleibt unverändert und löst die Regel nicht aus.
 */

const LANGUAGE_SEGMENT = /^[a-z]{2}(?:-[a-z]{2})?$/;

export const LANGUAGE_KEEP_MARK = "Gleiche Seite bleibt in allen Sprachen erhalten.";

export type LanguageKeepMember = {
  id: string;
  urlKey: string;
  urlKeyNoHtml: string;
  killBand: string;
  killReason: string;
  killConfidence: number;
  cleanupStatus: string;
};

export type LanguageKeepUpdate = {
  id: string;
  killConfidence: 0;
  killReason: string;
  killBand: "keep";
  cleanupStatus: "keep";
};

type Variant = { groupKey: string; language: string };

export function languageCodeFromSegment(segment: string): string | null {
  const bare = segment.toLowerCase().replace(/\.html$/, "");
  return LANGUAGE_SEGMENT.test(bare) ? bare : null;
}

/** Schlüssel, der für alle Sprachversionen einer Seite identisch ist. */
export function languageVariantOf(path: string): Variant | null {
  const normalized = path.replace(/\.html$/i, "");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  let langIndex = -1;
  if (segments[0] === "microsites") {
    if (languageCodeFromSegment(segments[2] ?? "")) langIndex = 2;
    else if (languageCodeFromSegment(segments[3] ?? "")) langIndex = 3;
  } else if (languageCodeFromSegment(segments[1] ?? "")) {
    langIndex = 1;
  }
  if (langIndex < 0) return null;

  const language = languageCodeFromSegment(segments[langIndex]);
  if (!language) return null;
  const copy = segments.slice();
  copy[langIndex] = "*";
  return { groupKey: `/${copy.join("/")}`, language };
}

export function isLanguageInheritedKeep(killReason: string): boolean {
  return killReason.includes(LANGUAGE_KEEP_MARK);
}

function isSourceKeep(row: { killBand: string; killReason: string }): boolean {
  return row.killBand === "keep" && row.killReason.trim() !== "" && !isLanguageInheritedKeep(row.killReason);
}

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} und ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} und ${items[items.length - 1]}`;
}

function buildLanguageKeepReason(
  sources: Array<{ language: string; urlKey: string; killBand: string }>
): string {
  const byLanguage = new Map<string, { language: string; urlKey: string; killBand: string }>();
  const sorted = [...sources].sort(
    (a, b) => a.language.localeCompare(b.language, "de") || a.urlKey.localeCompare(b.urlKey)
  );
  for (const source of sorted) {
    const prev = byLanguage.get(source.language);
    if (!prev) {
      byLanguage.set(source.language, source);
      continue;
    }
    const sourceHtml = source.urlKey.endsWith(".html");
    const prevHtml = prev.urlKey.endsWith(".html");
    if (sourceHtml && !prevHtml) byLanguage.set(source.language, source);
  }
  const list = [...byLanguage.values()];
  if (list.length === 1) {
    const source = list[0];
    return `Nicht löschen: Sprachversion ${source.language} ist Keep (${source.urlKey}). ${LANGUAGE_KEEP_MARK}`;
  }
  const parts = list.map((source) => `${source.language} (Keep, ${source.urlKey})`);
  return `Nicht löschen: Sprachversionen ${joinAnd(parts)}. ${LANGUAGE_KEEP_MARK}`;
}

export function planLanguageKeepUpdates(rows: LanguageKeepMember[]): LanguageKeepUpdate[] {
  const groups = new Map<string, Array<LanguageKeepMember & { language: string }>>();
  for (const row of rows) {
    const variant = languageVariantOf(row.urlKeyNoHtml || row.urlKey);
    if (!variant) continue;
    const list = groups.get(variant.groupKey) ?? [];
    list.push({ ...row, language: variant.language });
    groups.set(variant.groupKey, list);
  }

  const updates: LanguageKeepUpdate[] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const sources = members.filter(isSourceKeep);
    if (sources.length === 0) continue;
    const reason = buildLanguageKeepReason(sources);
    for (const member of members) {
      if (isSourceKeep(member) || member.killBand === "protected") continue;
      if (
        member.killBand === "keep" &&
        member.cleanupStatus === "keep" &&
        member.killConfidence === 0 &&
        member.killReason === reason
      ) {
        continue;
      }
      updates.push({
        id: member.id,
        killConfidence: 0,
        killReason: reason,
        killBand: "keep",
        cleanupStatus: "keep",
      });
    }
  }
  return updates;
}
