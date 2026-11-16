import { proxyFetch, DEFAULT_SCRAPE_HEADERS } from "@/lib/proxy-fetch";
import { fetchRawHtml } from "@/lib/dataforseo";

export interface LoadedHtml {
  html: string;
  status: number;
  lastModified: string | null;
  finalUrl: string;
  fetchedVia: "direct" | "dataforseo";
}

export class HtmlFetchError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message);
    this.name = "HtmlFetchError";
  }
}

/** Holt das HTML direkt bzw. über den Proxy und weicht bei Bot-Schutz auf den DataForSEO-Crawler aus. */
export async function loadHtml(url: string, options: { logPrefix?: string } = {}): Promise<LoadedHtml> {
  let directError: string;
  let res: Response | null = null;
  try {
    res = await proxyFetch(url, { headers: DEFAULT_SCRAPE_HEADERS, timeoutMs: 20_000 });
    directError = `HTTP ${res.status}`;
  } catch (err) {
    directError = err instanceof Error ? err.message : String(err);
  }
  if (res?.ok) {
    return {
      html: await res.text(),
      status: res.status,
      lastModified: res.headers.get("last-modified"),
      finalUrl: res.url || url,
      fetchedVia: "direct",
    };
  }
  if (res && (res.status === 404 || res.status === 410)) {
    throw new HtmlFetchError(`Seite konnte nicht geladen werden: HTTP ${res.status}`, res.status);
  }

  if (!process.env.DATAFORSEO_USERNAME?.trim() || !process.env.DATAFORSEO_PASSWORD?.trim()) {
    throw new HtmlFetchError(`Seite konnte nicht geladen werden: ${directError}`, res?.status ?? null);
  }
  console.warn(`[${options.logPrefix ?? "load-html"}] ${url}: ${directError}, lade über DataForSEO`);
  const page = await fetchRawHtml(url);
  if (page.status < 200 || page.status >= 300 || !page.html) {
    throw new HtmlFetchError(
      `Seite konnte nicht geladen werden: ${directError} (DataForSEO: HTTP ${page.status})`,
      page.status || res?.status || null
    );
  }
  return { html: page.html, status: page.status, lastModified: null, finalUrl: url, fetchedVia: "dataforseo" };
}
