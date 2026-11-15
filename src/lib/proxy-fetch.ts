import { ProxyAgent as UndiciProxyAgent, fetch as undiciFetch } from "undici";

const MAX_PROXY_RETRIES = 2;

/** Statuses that typically mean bot protection or geo-blocking rather than a real answer of the site. */
const BLOCKED_STATUSES = new Set([401, 403, 407, 429, 451]);

function looksBlocked(status: number): boolean {
  return BLOCKED_STATUSES.has(status) || status >= 500;
}

/**
 * Accepts both `http://user:pass@host:port` and the IPRoyal dashboard format
 * `[scheme://]host:port:user:pass`, which undici rejects as an invalid URL.
 */
export function normalizeProxyUrl(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(?:(https?):\/\/)?([^:/@]+):(\d+):([^:]+):(.+)$/);
  if (!match) return trimmed;
  const [, scheme = "http", host, port, user, pass] = match;
  return `${scheme}://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}`;
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err ?? "unknown");
}

/**
 * Fetches a URL directly first. If the site blocks the request (403, 429, 5xx, …) or the
 * request fails, it retries through the Swiss IPRoyal unblocker (geo-blocking, bot protection).
 * Retries the proxy on 403/429 (IP rotation may help).
 *
 * Usage:
 * - Set IPROYAL_PROXY_URL in .env to enable the proxy fallback
 * - Format: http://user:pass@geo.iproyal.com:12321
 *
 * If the proxy fails as well, the direct response is returned (or its error thrown),
 * so callers still see the site's original status.
 *
 * @param url - The URL to fetch
 * @param options - Fetch options (headers, timeout, etc.)
 * @returns Response object
 */
export async function proxyFetch(
  url: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = {}
): Promise<Response> {
  const timeoutMs = options.timeoutMs || 15000;
  const proxyUrl = process.env.IPROYAL_PROXY_URL
    ? normalizeProxyUrl(process.env.IPROYAL_PROXY_URL)
    : undefined;

  let directResponse: Response | null = null;
  let directError: unknown = null;
  try {
    directResponse = await fetch(url, {
      headers: options.headers || {},
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!looksBlocked(directResponse.status)) return directResponse;
    console.warn(`[proxyFetch] Direct fetch of ${url} returned ${directResponse.status}`);
  } catch (err) {
    directError = err;
    console.warn(`[proxyFetch] Direct fetch of ${url} failed: ${describe(err)}`);
  }

  if (!proxyUrl) {
    if (directResponse) return directResponse;
    throw directError;
  }

  console.log(`[proxyFetch] Retrying ${url} through proxy`);
  const proxyResponse = await fetchThroughProxy(url, proxyUrl, options.headers || {}, timeoutMs);
  if (proxyResponse) return proxyResponse;

  if (directResponse) return directResponse;
  throw directError;
}

/** Returns null when the proxy itself fails, so the caller can fall back to the direct result. */
async function fetchThroughProxy(
  url: string,
  proxyUrl: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<Response | null> {
  const isProxyHttps = proxyUrl.startsWith("https://");

  for (let attempt = 1; attempt <= MAX_PROXY_RETRIES; attempt++) {
    try {
      // Create a fresh agent per attempt to trigger IP rotation
      const proxyAgent = new UndiciProxyAgent({
        uri: proxyUrl,
        proxyTls: isProxyHttps ? { rejectUnauthorized: false } : undefined,
        requestTls: { rejectUnauthorized: false },
      });

      const res = await undiciFetch(url, {
        dispatcher: proxyAgent,
        headers,
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "follow",
      });

      console.log(`[proxyFetch] Proxy attempt ${attempt}: status ${res.status}, url: ${res.url}`);

      if ((res.status === 403 || res.status === 429) && attempt < MAX_PROXY_RETRIES) {
        console.warn(`[proxyFetch] Got ${res.status}, retrying with new IP...`);
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      const body = await res.arrayBuffer();

      // The IPRoyal unblocker answers 422 with an empty body when it rejects the request itself
      // (e.g. exhausted plan), regardless of the target site
      if (res.status === 422 && body.byteLength === 0) {
        console.warn(`[proxyFetch] Proxy rejected ${url} with 422`);
        return null;
      }

      const responseHeaders = new Headers();
      res.headers.forEach((value, key) => {
        responseHeaders.set(key, value);
      });

      const response = new Response(body, {
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
      });
      Object.defineProperty(response, "url", { value: res.url || url });

      return response;
    } catch (err) {
      console.warn(`[proxyFetch] Proxy attempt ${attempt} failed: ${describe(err)}`);
      if (attempt < MAX_PROXY_RETRIES) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  return null;
}

/**
 * Default browser-like headers for scraping websites
 */
export const DEFAULT_SCRAPE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "de-CH,de-DE;q=0.9,de;q=0.8,en-US;q=0.7,en;q=0.6",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Ch-Ua":
    '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};
