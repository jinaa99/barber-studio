import "server-only";

/*
 * Same-origin check for browser-facing mutations outside Server Actions
 * (Next.js checks those itself). Compares the Origin header with the host the
 * request arrived on, preferring `x-forwarded-host` from a reverse proxy.
 */

/**
 * Whether `headers` come from a page on this site. A request without an
 * Origin passes only when `allowMissing` (non-browser clients); a malformed
 * or opaque one ("null") never does.
 */
export function isSameOrigin(headers: Headers, { allowMissing = false } = {}): boolean {
  const origin = headers.get("origin");
  if (!origin) return allowMissing;
  const host = headers.get("x-forwarded-host")?.split(",")[0]?.trim() || headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
