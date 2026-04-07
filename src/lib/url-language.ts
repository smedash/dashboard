function normalizeLanguageSegment(segment: string): string | null {
  const raw = segment.toLowerCase();
  if (/^[a-z]{2}$/.test(raw)) return raw;
  if (/^[a-z]{2}-[a-z]{2}$/.test(raw)) return raw;
  if (/^[a-z]{3}$/.test(raw)) return raw;
  return null;
}

/**
 * Ermittelt die Sprache aus der URL:
 * - Standard: zweites Pfadsegment (z. B. /global/en/ → en, /ch/de/ → de).
 * - Microsites: viertes Segment, wenn der Pfad mit /microsites/ beginnt
 *   (z. B. /microsites/wma/insights/en/… → en).
 */
export function languageFromUrlPath(urlLike: string | null | undefined): string | null {
  if (!urlLike?.trim()) return null;

  let pathname: string;
  try {
    pathname = new URL(urlLike.trim()).pathname;
  } catch {
    try {
      pathname = new URL(urlLike.trim(), "https://placeholder.local/").pathname;
    } catch {
      return null;
    }
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;

  const first = segments[0].toLowerCase();
  if (first === "microsites" && segments.length >= 4) {
    return normalizeLanguageSegment(segments[3]);
  }

  return normalizeLanguageSegment(segments[1]);
}
