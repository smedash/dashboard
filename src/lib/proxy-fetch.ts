import { ProxyAgent as UndiciProxyAgent, fetch as undiciFetch } from "undici";

const MAX_PROXY_RETRIES = 2;

/**
 * Fetches a URL through a Swiss proxy to avoid geo-blocking (403 errors).
 * Falls back to direct fetch if no proxy is configured.
 * Retries on proxy failure or 403 responses (IP rotation may help).
 *
 * Usage:
 * - Set IPROYAL_PROXY_URL in .env to enable the proxy
 * - Format: http://user:pass@geo.iproyal.com:12321
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
  const proxyUrl = process.env.IPROYAL_PROXY_URL;

  if (proxyUrl) {
    console.log(`[proxyFetch] Fetching ${url} through proxy`);

    const isProxyHttps = proxyUrl.startsWith("https://");
    const timeoutMs = options.timeoutMs || 15000;
    let lastError: unknown;

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
          headers: options.headers || {},
          signal: AbortSignal.timeout(timeoutMs),
          redirect: "follow",
        });

        console.log(`[proxyFetch] Attempt ${attempt}: status ${res.status}, url: ${res.url}`);

        // Retry on 403/429 — IP rotation may get a better IP next time
        if ((res.status === 403 || res.status === 429) && attempt < MAX_PROXY_RETRIES) {
          console.warn(`[proxyFetch] Got ${res.status}, retrying with new IP...`);
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }

        const body = await res.arrayBuffer();
        const headers = new Headers();
        res.headers.forEach((value, key) => {
          headers.set(key, value);
        });

        const response = new Response(body, {
          status: res.status,
          statusText: res.statusText,
          headers,
        });
        Object.defineProperty(response, "url", { value: res.url || url });

        return response;
      } catch (err) {
        lastError = err;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[proxyFetch] Attempt ${attempt} failed: ${errMsg}`);
        if (attempt < MAX_PROXY_RETRIES) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }
    }

    // All proxy retries failed — throw so caller can decide on fallback
    throw lastError || new Error("Proxy fetch failed after retries");
  }

  // Fallback to direct fetch (for local development or if proxy not configured)
  console.log(`[proxyFetch] NO PROXY CONFIGURED - using direct fetch for ${url}`);
  return fetch(url, {
    headers: options.headers || {},
    signal: AbortSignal.timeout(options.timeoutMs || 15000),
  });
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
