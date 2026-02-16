/**
 * Simple in-memory rate limiter for API routes.
 *
 * Limitations: On Vercel (serverless), each instance has its own memory,
 * so rate limiting is per-instance. This still provides meaningful protection
 * against abuse within each warm instance's lifetime.
 *
 * For production-grade rate limiting, consider @upstash/ratelimit with Redis.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterConfig {
  /** Maximum number of requests per window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

// Periodically clean up expired entries to prevent memory leaks
const CLEANUP_INTERVAL_MS = 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [, store] of stores) {
      for (const [key, entry] of store) {
        if (now > entry.resetAt) {
          store.delete(key);
        }
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't prevent Node process from exiting
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export function createRateLimiter(name: string, config: RateLimiterConfig) {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  const store = stores.get(name)!;
  ensureCleanup();

  return {
    /**
     * Check if a request is allowed.
     * @param key - Identifier for the requester (e.g. user ID or IP)
     * @returns { success, remaining, resetIn } - Whether request is allowed and metadata
     */
    check(key: string): {
      success: boolean;
      remaining: number;
      resetIn: number;
    } {
      const now = Date.now();
      const entry = store.get(key);

      if (!entry || now > entry.resetAt) {
        // Start new window
        store.set(key, {
          count: 1,
          resetAt: now + config.windowSeconds * 1000,
        });
        return {
          success: true,
          remaining: config.maxRequests - 1,
          resetIn: config.windowSeconds,
        };
      }

      if (entry.count >= config.maxRequests) {
        return {
          success: false,
          remaining: 0,
          resetIn: Math.ceil((entry.resetAt - now) / 1000),
        };
      }

      entry.count += 1;
      return {
        success: true,
        remaining: config.maxRequests - entry.count,
        resetIn: Math.ceil((entry.resetAt - now) / 1000),
      };
    },
  };
}

// Pre-configured rate limiters for different tiers

/** Strict: 5 requests per minute — for expensive AI operations */
export const aiRateLimiter = createRateLimiter("ai", {
  maxRequests: 5,
  windowSeconds: 60,
});

/** Medium: 20 requests per minute — for external API calls */
export const apiRateLimiter = createRateLimiter("api", {
  maxRequests: 20,
  windowSeconds: 60,
});

/** Relaxed: 60 requests per minute — for standard endpoints */
export const standardRateLimiter = createRateLimiter("standard", {
  maxRequests: 60,
  windowSeconds: 60,
});
