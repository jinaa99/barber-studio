import "server-only";

/*
 * Fixed-window rate limiter kept in process memory. It blunts scripted abuse
 * of the public booking API and the login form on a single server; behind
 * several instances each one counts separately, so put a shared limiter
 * (proxy, CDN or Redis) in front for stricter guarantees.
 */

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, window] of buckets) if (window.resetAt <= now) buckets.delete(key);
}

/** Count one hit for `key`. Returns false once `limit` hits have been made inside `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  sweep(now);
  const window = buckets.get(key);
  if (!window || window.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  window.count += 1;
  return window.count <= limit;
}

/**
 * Best-effort client address. `x-forwarded-for` is only trustworthy when the
 * app sits behind a proxy that sets it (Vercel, nginx…); see docs/BOOKING.md.
 */
export function clientAddress(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
