import "server-only";
import type { z } from "zod";
import {
  accessTokenResponse,
  classifyMetaError,
  debugTokenResponse,
  instagramCodeResponse,
  instagramInsightResponse,
  instagramMediaResponse,
  instagramProfileResponse,
  pageInsightResponse,
  pagePostsResponse,
  pageProfileResponse,
  pagesResponse,
  type FacebookMetric,
  type FacebookPageChoice,
  type FacebookPageProfile,
  type InstagramMetric,
  type InstagramProfile,
  type MetaResult,
  type SocialConfig,
  type SocialPost,
  type TokenInfo,
} from "@/lib/social/meta";
import { appSecretProof } from "./social-crypto";

/*
 * Server-side client for the Meta APIs, behind the `MetaApi` interface so the
 * connection logic can be tested with a fake (tests/integration/social.test.ts)
 * and this transport with a fake `fetch`. App secrets and access tokens travel
 * only in request URLs and bodies built here; URLs are never logged or
 * returned, and failures are logged as method + path + Meta's error code.
 * Every Graph call made with a Facebook token carries `appsecret_proof`.
 */

export interface MetaApi {
  facebook: {
    /** Authorization code → short-lived user token. */
    exchangeCode(code: string): Promise<MetaResult<{ accessToken: string }>>;
    /** Short-lived → long-lived (~60 days) user token. */
    extendUserToken(userToken: string): Promise<MetaResult<{ accessToken: string; expiresAt: Date | null }>>;
    /** `debug_token` with the app token: validity, app, granted scopes and expiry. */
    inspectToken(token: string): Promise<MetaResult<TokenInfo>>;
    /** The Pages the person manages, each with its Page token. */
    listPages(userToken: string): Promise<MetaResult<FacebookPageChoice[]>>;
    getPage(pageId: string, pageToken: string): Promise<MetaResult<FacebookPageProfile>>;
    recentPosts(pageId: string, pageToken: string, limit: number): Promise<MetaResult<SocialPost[]>>;
    pageInsight(pageId: string, pageToken: string, metric: FacebookMetric, period: string): Promise<MetaResult<number | null>>;
  };
  instagram: {
    exchangeCode(code: string): Promise<MetaResult<{ accessToken: string; userId: string; permissions: string[] }>>;
    /** Short-lived → long-lived (60 days) token. */
    extendToken(token: string): Promise<MetaResult<{ accessToken: string; expiresAt: Date | null }>>;
    /** Another 60 days for a long-lived token at least 24 hours old. */
    refreshToken(token: string): Promise<MetaResult<{ accessToken: string; expiresAt: Date | null }>>;
    profile(token: string): Promise<MetaResult<InstagramProfile>>;
    recentMedia(token: string, limit: number): Promise<MetaResult<SocialPost[]>>;
    accountInsight(accountId: string, token: string, metric: InstagramMetric, since: Date, until: Date): Promise<MetaResult<number | null>>;
  };
}

export type Http = (url: string, init: RequestInit) => Promise<Response>;

const unavailable = { ok: false, error: { kind: "unavailable" } } as const;

export function createMetaApi(config: SocialConfig, http: Http = (url, init) => fetch(url, init)): MetaApi {
  const v = config.graphVersion;
  const fbGraph = `https://graph.facebook.com/${v}`;
  const igGraph = `https://graph.instagram.com/${v}`;

  async function call<S extends z.ZodType>(
    provider: "facebook" | "instagram",
    method: "GET" | "POST",
    url: URL,
    schema: S,
    body?: URLSearchParams,
  ): Promise<MetaResult<z.output<S>>> {
    const where = `${provider} ${method} ${url.pathname}`;
    let response: Response;
    try {
      response = await http(url.toString(), {
        method,
        body,
        headers: { Accept: "application/json" },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      console.error(`[social] ${where} failed:`, error instanceof Error ? error.name : "error");
      return unavailable;
    }
    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      // Handled below: a non-JSON body is never a usable answer.
    }
    if (!response.ok || (json && typeof json === "object" && "error" in json)) {
      const error = classifyMetaError(response.status, json);
      console.error(`[social] ${where} → HTTP ${response.status}, ${error.kind}${error.code ? ` (code ${error.code}${error.subcode ? `/${error.subcode}` : ""})` : ""}`);
      return { ok: false, error };
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      console.error(`[social] ${where} returned an unexpected body.`);
      return unavailable;
    }
    return { ok: true, value: parsed.data };
  }

  const url = (base: string, params: Record<string, string>) => {
    const u = new URL(base);
    for (const [k, value] of Object.entries(params)) u.searchParams.set(k, value);
    return u;
  };
  const expiry = (seconds: number | undefined) => (seconds ? new Date(Date.now() + seconds * 1000) : null);

  const fb = () => config.facebook;
  const ig = () => config.instagram;
  const notConfigured = { ok: false, error: { kind: "invalid_request" } } as const;
  /** Graph call with a Facebook user or Page token, signed with appsecret_proof. */
  const fbGet = <S extends z.ZodType>(path: string, token: string, params: Record<string, string>, schema: S) => {
    const app = fb();
    if (!app) return Promise.resolve(notConfigured);
    return call("facebook", "GET", url(`${fbGraph}${path}`, { ...params, access_token: token, appsecret_proof: appSecretProof(token, app.appSecret) }), schema);
  };

  return {
    facebook: {
      async exchangeCode(code) {
        const app = fb();
        if (!app) return notConfigured;
        const result = await call(
          "facebook",
          "GET",
          url(`${fbGraph}/oauth/access_token`, { client_id: app.appId, client_secret: app.appSecret, redirect_uri: app.redirectUri, code }),
          accessTokenResponse,
        );
        return result.ok ? { ok: true, value: { accessToken: result.value.access_token } } : result;
      },
      async extendUserToken(userToken) {
        const app = fb();
        if (!app) return notConfigured;
        const result = await call(
          "facebook",
          "GET",
          url(`${fbGraph}/oauth/access_token`, {
            grant_type: "fb_exchange_token",
            client_id: app.appId,
            client_secret: app.appSecret,
            fb_exchange_token: userToken,
          }),
          accessTokenResponse,
        );
        return result.ok ? { ok: true, value: { accessToken: result.value.access_token, expiresAt: expiry(result.value.expires_in) } } : result;
      },
      inspectToken(token) {
        const app = fb();
        if (!app) return Promise.resolve(notConfigured);
        return call("facebook", "GET", url(`${fbGraph}/debug_token`, { input_token: token, access_token: `${app.appId}|${app.appSecret}` }), debugTokenResponse);
      },
      listPages: (userToken) => fbGet("/me/accounts", userToken, { fields: "id,name,category,access_token,tasks", limit: "100" }, pagesResponse),
      getPage: (pageId, pageToken) =>
        fbGet(`/${encodeURIComponent(pageId)}`, pageToken, { fields: "id,name,link,category,followers_count,fan_count" }, pageProfileResponse),
      recentPosts: (pageId, pageToken, limit) =>
        fbGet(`/${encodeURIComponent(pageId)}/posts`, pageToken, { fields: "id,message,created_time,permalink_url", limit: String(limit) }, pagePostsResponse),
      pageInsight: (pageId, pageToken, metric, period) =>
        fbGet(`/${encodeURIComponent(pageId)}/insights`, pageToken, { metric, period }, pageInsightResponse),
    },
    instagram: {
      async exchangeCode(code) {
        const app = ig();
        if (!app) return notConfigured;
        const body = new URLSearchParams({
          client_id: app.appId,
          client_secret: app.appSecret,
          grant_type: "authorization_code",
          redirect_uri: app.redirectUri,
          code,
        });
        return call("instagram", "POST", new URL("https://api.instagram.com/oauth/access_token"), instagramCodeResponse, body);
      },
      async extendToken(token) {
        const app = ig();
        if (!app) return notConfigured;
        const result = await call(
          "instagram",
          "GET",
          url("https://graph.instagram.com/access_token", { grant_type: "ig_exchange_token", client_secret: app.appSecret, access_token: token }),
          accessTokenResponse,
        );
        return result.ok ? { ok: true, value: { accessToken: result.value.access_token, expiresAt: expiry(result.value.expires_in) } } : result;
      },
      async refreshToken(token) {
        const result = await call(
          "instagram",
          "GET",
          url("https://graph.instagram.com/refresh_access_token", { grant_type: "ig_refresh_token", access_token: token }),
          accessTokenResponse,
        );
        return result.ok ? { ok: true, value: { accessToken: result.value.access_token, expiresAt: expiry(result.value.expires_in) } } : result;
      },
      profile: (token) =>
        call(
          "instagram",
          "GET",
          url(`${igGraph}/me`, { fields: "user_id,username,name,account_type,followers_count,follows_count,media_count", access_token: token }),
          instagramProfileResponse,
        ),
      recentMedia: (token, limit) =>
        call(
          "instagram",
          "GET",
          url(`${igGraph}/me/media`, { fields: "id,caption,media_type,permalink,timestamp,like_count,comments_count", limit: String(limit), access_token: token }),
          instagramMediaResponse,
        ),
      accountInsight: (accountId, token, metric, since, until) =>
        call(
          "instagram",
          "GET",
          url(`${igGraph}/${encodeURIComponent(accountId)}/insights`, {
            metric,
            period: "day",
            metric_type: "total_value",
            since: String(Math.floor(since.getTime() / 1000)),
            until: String(Math.floor(until.getTime() / 1000)),
            access_token: token,
          }),
          instagramInsightResponse,
        ),
    },
  };
}
