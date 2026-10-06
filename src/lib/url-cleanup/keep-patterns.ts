import { pathFromUrlOrPath, stripHtmlExt } from "./normalize";

/** Eine Zeile pro Muster; leere Zeilen und Duplikate fallen weg. */
export function parseKeepUrlPatterns(input: string | string[]): string[] {
  const lines = Array.isArray(input) ? input : input.split(/\r?\n/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.length < 2) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function patternPath(pattern: string): string | null {
  const t = pattern.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return pathFromUrlOrPath(t);
  if (/(^|\.)ubs\.com\//i.test(t) || t.toLowerCase().includes("ubs.com/")) {
    const withScheme = `https://${t.replace(/^\/+/, "")}`;
    return pathFromUrlOrPath(withScheme);
  }
  return pathFromUrlOrPath(t.startsWith("/") ? t : `/${t}`);
}

export function urlMatchesKeepPattern(url: string, urlKey: string, pattern: string): boolean {
  const raw = pattern.trim();
  if (raw.length < 2) return false;
  const needle = raw.toLowerCase();
  const urlLower = url.toLowerCase();
  const looksLikeUrl = /^https?:\/\//i.test(raw) || needle.includes("ubs.com/");
  if (looksLikeUrl && (urlLower === needle || urlLower.includes(needle))) return true;
  // Pfade mit Slash: `/legal/` trifft /ch/de/legal/…, aber nicht «illegal».
  if (needle.includes("/") && (urlLower === needle || urlLower.includes(needle))) return true;

  const p = patternPath(raw);
  if (!p || p === "/") return false;
  const key = urlKey.toLowerCase();
  const keyNoHtml = stripHtmlExt(key);
  const pathNoHtml = stripHtmlExt(p);
  if (key === p || keyNoHtml === pathNoHtml) return true;
  if (key.startsWith(p + "/") || keyNoHtml.startsWith(pathNoHtml + "/")) return true;
  if (key.includes(p + "/") || key.includes(pathNoHtml + "/")) return true;
  if (key.endsWith(p) || keyNoHtml.endsWith(pathNoHtml)) return true;
  return false;
}

export function firstMatchingKeepPattern(
  url: string,
  urlKey: string,
  patterns: string[]
): string | null {
  for (const pattern of patterns) {
    if (urlMatchesKeepPattern(url, urlKey, pattern)) return pattern;
  }
  return null;
}
