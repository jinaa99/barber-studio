import "server-only";
import {
  assetUrl,
  isProviderMediaUrl,
  normalizeAssetResponse,
  normalizeSearch,
  searchUrl,
  type StockAsset,
  type StockPage,
  type StockProvider,
  type StockSearch,
  type StockSelection,
} from "@/lib/media/stock";

/*
 * Server-side client for the stock media APIs. Keys come only from
 * `PEXELS_API_KEY` / `PIXABAY_API_KEY` and never leave this module: Pexels
 * takes it in a header, Pixabay in the query string, so request URLs are
 * never logged or returned.
 *
 * Responses are cached in process memory (Pixabay requires 24 hours; Pexels
 * results are kept for an hour), every request has a timeout, and a 429 from a
 * provider pauses calls to it until its window resets. Callers rate-limit per
 * staff member as well.
 */

export type StockError = "not_configured" | "rate_limited" | "rejected" | "unavailable" | "not_found";
export type StockResult<T> = { ok: true; value: T } | { ok: false; error: StockError; retryAfterSeconds?: number };

const keys: Record<StockProvider, string> = { pexels: "PEXELS_API_KEY", pixabay: "PIXABAY_API_KEY" };

function apiKey(provider: StockProvider): string | null {
  return process.env[keys[provider]]?.trim() || null;
}

export function configuredProviders(): Record<StockProvider, boolean> {
  return { pexels: Boolean(apiKey("pexels")), pixabay: Boolean(apiKey("pixabay")) };
}

const ttl: Record<StockProvider, number> = { pexels: 60 * 60_000, pixabay: 24 * 60 * 60_000 };
const cache = new Map<string, { expires: number; body: unknown }>();
const MAX_CACHED = 300;
const cooldownUntil: Partial<Record<StockProvider, number>> = {};

function remember(key: string, provider: StockProvider, body: unknown) {
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
  cache.set(key, { expires: Date.now() + ttl[provider], body });
}

/** Seconds from a provider's rate-limit headers: Pixabay sends seconds, Pexels a UNIX time. */
function resetSeconds(provider: StockProvider, headers: Headers): number {
  const reset = Number(headers.get("x-ratelimit-reset") ?? headers.get("retry-after"));
  if (!Number.isFinite(reset) || reset <= 0) return 60;
  const seconds = provider === "pexels" && reset > 1e9 ? reset - Date.now() / 1000 : reset;
  return Math.min(Math.max(Math.ceil(seconds), 1), 24 * 60 * 60);
}

async function callProvider(provider: StockProvider, url: URL): Promise<StockResult<unknown>> {
  const key = apiKey(provider);
  if (!key) return { ok: false, error: "not_configured" };

  const cacheKey = `${provider}:${url.toString()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return { ok: true, value: cached.body };

  const pausedFor = (cooldownUntil[provider] ?? 0) - Date.now();
  if (pausedFor > 0) return { ok: false, error: "rate_limited", retryAfterSeconds: Math.ceil(pausedFor / 1000) };

  const request = new URL(url);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (provider === "pexels") headers.Authorization = key;
  else request.searchParams.set("key", key);

  let response: Response;
  try {
    response = await fetch(request, { headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    console.error(`[media] ${provider} request failed:`, error instanceof Error ? error.name : "error");
    return { ok: false, error: "unavailable" };
  }

  if (response.status === 429) {
    const seconds = resetSeconds(provider, response.headers);
    cooldownUntil[provider] = Date.now() + seconds * 1000;
    return { ok: false, error: "rate_limited", retryAfterSeconds: seconds };
  }
  if (response.status === 401 || response.status === 403) {
    console.error(`[media] ${provider} rejected the API key (HTTP ${response.status}).`);
    return { ok: false, error: "rejected" };
  }
  // Pixabay answers an unknown id with 400 "[ERROR 400] … id"; Pexels with 404.
  if (response.status === 404 || response.status === 400) return { ok: false, error: "not_found" };
  if (!response.ok) {
    console.error(`[media] ${provider} returned HTTP ${response.status}.`);
    return { ok: false, error: "unavailable" };
  }
  if (response.headers.get("x-ratelimit-remaining") === "0") {
    cooldownUntil[provider] = Date.now() + resetSeconds(provider, response.headers) * 1000;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: "unavailable" };
  }
  remember(cacheKey, provider, body);
  return { ok: true, value: body };
}

export async function searchStock(search: StockSearch): Promise<StockResult<StockPage>> {
  const result = await callProvider(search.provider, searchUrl(search));
  if (!result.ok) return result;
  const page = normalizeSearch(search, result.value);
  return page ? { ok: true, value: page } : { ok: false, error: "unavailable" };
}

/** One asset, looked up again by id so its URLs and credits come from the provider, not the browser. */
export async function fetchStockAsset(selection: StockSelection): Promise<StockResult<StockAsset>> {
  const result = await callProvider(selection.provider, assetUrl(selection));
  if (!result.ok) return result;
  const asset = normalizeAssetResponse(selection, result.value);
  return asset ? { ok: true, value: asset } : { ok: false, error: "not_found" };
}

export type DownloadError = "blocked" | "too_large" | "unavailable";

/**
 * Download a file from a provider's media host. Only https URLs on the
 * provider's own hosts are fetched; redirects are followed by hand (at most
 * three) and each hop is checked again; the body is read with a hard size cap.
 */
export async function downloadProviderFile(
  provider: StockProvider,
  url: string,
  maxBytes: number,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; error: DownloadError }> {
  let current = url;
  const deadline = AbortSignal.timeout(90_000);
  for (let hop = 0; hop <= 3; hop++) {
    if (!isProviderMediaUrl(provider, current)) return { ok: false, error: "blocked" };
    let response: Response;
    try {
      response = await fetch(current, { cache: "no-store", redirect: "manual", signal: deadline });
    } catch {
      return { ok: false, error: "unavailable" };
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) return { ok: false, error: "unavailable" };
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok || !response.body) return { ok: false, error: "unavailable" };
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) {
      await response.body.cancel();
      return { ok: false, error: "too_large" };
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = response.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          return { ok: false, error: "too_large" };
        }
        chunks.push(value);
      }
    } catch {
      return { ok: false, error: "unavailable" };
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, bytes };
  }
  return { ok: false, error: "blocked" };
}
