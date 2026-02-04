import { ProxyAgent } from "proxy-agent";
import https from "https";
import http from "http";
import zlib from "zlib";

/**
 * Fetches a URL through a Swiss proxy to avoid geo-blocking (403 errors).
 * Falls back to direct fetch if no proxy is configured.
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

  // If proxy is configured, use proxy-agent
  if (proxyUrl) {
    console.log(`[proxyFetch] Using proxy: ${proxyUrl.substring(0, 30)}...`);
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === "https:";

      // Create proxy agent with the proxy URL
      const agent = new ProxyAgent({ getProxyForUrl: () => proxyUrl });

      // Remove Accept-Encoding from headers to get uncompressed response,
      // or we handle decompression ourselves
      const headers = { ...options.headers };
      // Request compressed content - we'll decompress it
      headers["Accept-Encoding"] = "gzip, deflate";

      const requestModule = isHttps ? https : http;
      const requestOptions: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: "GET",
        headers,
        agent: agent,
        timeout: options.timeoutMs || 15000,
      };

      console.log(`[proxyFetch] Fetching ${url} through proxy`);

      const req = requestModule.request(requestOptions, (res) => {
        console.log(`[proxyFetch] Response status: ${res.statusCode}, encoding: ${res.headers["content-encoding"]}`);

        const chunks: Buffer[] = [];

        // Handle compressed responses
        let stream: NodeJS.ReadableStream = res;
        const encoding = res.headers["content-encoding"];

        if (encoding === "gzip") {
          stream = res.pipe(zlib.createGunzip());
        } else if (encoding === "deflate") {
          stream = res.pipe(zlib.createInflate());
        } else if (encoding === "br") {
          stream = res.pipe(zlib.createBrotliDecompress());
        }

        stream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        stream.on("end", () => {
          const body = Buffer.concat(chunks);

          // Create a Response-like object
          const response = new Response(body, {
            status: res.statusCode || 500,
            statusText: res.statusMessage || "",
            headers: new Headers(
              Object.entries(res.headers).reduce(
                (acc, [key, value]) => {
                  if (value) {
                    acc[key] = Array.isArray(value) ? value.join(", ") : value;
                  }
                  return acc;
                },
                {} as Record<string, string>
              )
            ),
          });

          resolve(response);
        });

        stream.on("error", (error) => {
          reject(error);
        });
      });

      req.on("error", (error) => {
        console.error(`[proxyFetch] Request error:`, error);
        reject(error);
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      req.end();
    });
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
