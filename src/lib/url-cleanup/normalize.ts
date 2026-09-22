const UBS_ORIGIN = "https://www.ubs.com";

export function decodeRepeated(input: string): string {
  let prev = input;
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(prev.replace(/\+/g, " "));
      if (next === prev) break;
      prev = next;
    } catch {
      break;
    }
  }
  return prev;
}

export function stripHtmlExt(path: string): string {
  return path.replace(/\.html$/i, "");
}

/** Normalisierter Path: lowercase, ohne Trailing Slash, kollabierte Slashes. */
export function pathFromUrlOrPath(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const decoded = decodeRepeated(t).trim();
  if (!decoded) return null;

  let pathname: string;
  try {
    if (/^https?:\/\//i.test(decoded)) {
      pathname = new URL(decoded).pathname;
    } else {
      const path = decoded.startsWith("/") ? decoded : `/${decoded}`;
      pathname = new URL(path, UBS_ORIGIN).pathname;
    }
  } catch {
    return null;
  }

  pathname = pathname.replace(/\/{2,}/g, "/");
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  if (!pathname) pathname = "/";
  return pathname.toLowerCase();
}

export type UrlKeys = {
  urlKey: string;
  urlKeyNoHtml: string;
};

export function toUrlKey(input: string): UrlKeys | null {
  const p = pathFromUrlOrPath(input);
  if (!p) return null;
  return { urlKey: p, urlKeyNoHtml: stripHtmlExt(p) };
}

export function canonicalUbsUrl(urlKey: string): string {
  return `${UBS_ORIGIN}${urlKey.startsWith("/") ? urlKey : `/${urlKey}`}`;
}

/** Cache-Schlüssel wie DataForSEO/Keyword-Mapping: nur www.ubs.com, inkl. Query. */
export function normalizeUbsPageUrl(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `${UBS_ORIGIN}${t.startsWith("/") ? t : `/${t}`}`);
    const host = u.hostname.toLowerCase();
    if (host !== "www.ubs.com" && host !== "ubs.com") return null;
    return `${UBS_ORIGIN}${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

export function lookupInventoryId(
  keys: UrlKeys,
  byKey: Map<string, string>,
  byNoHtml: Map<string, string>
): string | undefined {
  return byKey.get(keys.urlKey) ?? byNoHtml.get(keys.urlKeyNoHtml);
}
