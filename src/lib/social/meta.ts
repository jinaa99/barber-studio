import { z } from "zod";

/*
 * Pure pieces of the Meta integration (Facebook Pages and Instagram
 * professional accounts): which permissions are requested and why, the OAuth
 * URLs, how Graph API responses and errors are read, and which insight
 * metrics are shown. No network, no secrets: the HTTP client lives in
 * `lib/server/meta-api.ts`, the stored connections in `lib/server/social.ts`.
 * Verified against Meta's documentation for Graph API v26.0; see docs/SOCIAL.md.
 */

export const socialProviders = ["facebook", "instagram"] as const;
export type SocialProviderKey = (typeof socialProviders)[number];

export function isSocialProvider(value: unknown): value is SocialProviderKey {
  return typeof value === "string" && (socialProviders as readonly string[]).includes(value);
}

export const DEFAULT_GRAPH_VERSION = "v26.0";

/*
 * Requested permissions. `required` ones must come back granted or the
 * connection is refused; `optional` ones only unlock the insights section.
 * Nothing is requested for posting, messages, comments or ads.
 */
export const scopes = {
  facebook: {
    /** List the Pages the person manages, so they can pick the studio's Page. */
    required: ["pages_show_list", "pages_read_engagement"],
    /** Page Insights (views, engagement, follows). */
    optional: ["read_insights"],
  },
  instagram: {
    /** Profile fields (username, account type, follower and media counts) and recent media. */
    required: ["instagram_business_basic"],
    /** Account insights (reach, views, interactions). */
    optional: ["instagram_business_manage_insights"],
  },
} as const satisfies Record<SocialProviderKey, { required: readonly string[]; optional: readonly string[] }>;

export const requestedScopes = (provider: SocialProviderKey): string[] => [...scopes[provider].required, ...scopes[provider].optional];

export function missingScopes(provider: SocialProviderKey, granted: readonly string[], which: "required" | "optional"): string[] {
  return scopes[provider][which].filter((s) => !granted.includes(s));
}

/* ------------------------------------------------------------------ Config */

export interface ProviderConfig {
  appId: string;
  appSecret: string;
  /** Exactly as registered in the App Dashboard; sent with both the dialog and the code exchange. */
  redirectUri: string;
  /** Facebook Login for Business configuration (a "User access token" configuration); replaces `scope`. */
  configId?: string;
}

export interface SocialConfig {
  graphVersion: string;
  facebook: ProviderConfig | null;
  instagram: ProviderConfig | null;
  /** Names of the environment variables each provider still needs (names only, never values). */
  missing: Record<SocialProviderKey, string[]>;
}

export const envNames = {
  facebook: { appId: "META_APP_ID", appSecret: "META_APP_SECRET" },
  instagram: { appId: "INSTAGRAM_APP_ID", appSecret: "INSTAGRAM_APP_SECRET" },
  tokenKey: "SOCIAL_TOKEN_KEY",
  origin: "NEXT_PUBLIC_SITE_URL",
  graphVersion: "META_GRAPH_VERSION",
  loginConfigId: "META_LOGIN_CONFIG_ID",
} as const;

export const callbackPath = (provider: SocialProviderKey) => `/api/social/${provider}/callback`;
export const deauthorizePath = (provider: SocialProviderKey) => `/api/social/${provider}/deauthorize`;

/**
 * The public origin the callbacks live on: an origin only (no path), and
 * https except on localhost. Meta compares redirect URIs exactly, so they are
 * derived from this setting, never from the request's Host header.
 */
export function parseOrigin(value: string | undefined): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) return null;
  return url.origin;
}

/** Read the configuration from an environment. `hasTokenKey` comes from the crypto module, which validates the key. */
export function readSocialConfig(env: Record<string, string | undefined>, hasTokenKey: boolean): SocialConfig {
  const origin = parseOrigin(env[envNames.origin]);
  const version = env[envNames.graphVersion]?.trim();
  const graphVersion = version && /^v\d{2}\.\d$/.test(version) ? version : DEFAULT_GRAPH_VERSION;
  const missing: Record<SocialProviderKey, string[]> = { facebook: [], instagram: [] };
  const provider = (key: SocialProviderKey): ProviderConfig | null => {
    const names = envNames[key];
    const appId = env[names.appId]?.trim() ?? "";
    const appSecret = env[names.appSecret]?.trim() ?? "";
    if (!/^\d{5,25}$/.test(appId)) missing[key].push(names.appId);
    if (!appSecret) missing[key].push(names.appSecret);
    if (!hasTokenKey) missing[key].push(envNames.tokenKey);
    if (!origin) missing[key].push(envNames.origin);
    if (missing[key].length > 0) return null;
    const configId = key === "facebook" ? env[envNames.loginConfigId]?.trim() : undefined;
    return { appId, appSecret, redirectUri: `${origin}${callbackPath(key)}`, ...(configId && /^\d{5,25}$/.test(configId) ? { configId } : {}) };
  };
  return { graphVersion, facebook: provider("facebook"), instagram: provider("instagram"), missing };
}

/* ------------------------------------------------------------- OAuth URLs */

/**
 * Facebook Login dialog (manual flow, `response_type=code`). With a Facebook
 * Login for Business configuration, its `config_id` selects the permissions
 * instead of `scope`; either way the granted ones are read back afterwards.
 */
export function facebookAuthorizeUrl(config: ProviderConfig, graphVersion: string, state: string): string {
  const url = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  if (config.configId) url.searchParams.set("config_id", config.configId);
  else url.searchParams.set("scope", requestedScopes("facebook").join(","));
  // Ask again for anything declined last time instead of silently skipping it.
  url.searchParams.set("auth_type", "rerequest");
  return url.toString();
}

/** Business Login for Instagram authorization window. */
export function instagramAuthorizeUrl(config: ProviderConfig, state: string): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", requestedScopes("instagram").join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

/** Instagram appends `#_` to the code; it is not part of it. */
export function cleanCode(code: string): string {
  return code.replace(/#_$/, "").trim();
}

/* ------------------------------------------------------------------ Errors */

export type MetaErrorKind =
  /** The token expired, was revoked or is otherwise invalid: reconnect. */
  | "token"
  /** A permission is missing or the person lacks the needed role on the Page. */
  | "permission"
  | "rate_limited"
  /** Meta rejected the request itself (e.g. an unknown or retired metric, a used code). */
  | "invalid_request"
  /** Network failure, timeout, 5xx or an unexpected body. */
  | "unavailable";

export interface MetaError {
  kind: MetaErrorKind;
  code?: number;
  subcode?: number;
}

export type MetaResult<T> = { ok: true; value: T } | { ok: false; error: MetaError };

const graphError = z.object({
  error: z.object({
    code: z.coerce.number().optional(),
    error_subcode: z.coerce.number().optional(),
    type: z.string().optional(),
  }),
});
/** The Instagram OAuth endpoints answer with a flat shape. */
const flatError = z.object({ error_type: z.string(), code: z.coerce.number().optional() });

/**
 * Map a Graph API error (or a bare HTTP failure) to what the dashboard can do
 * about it. Codes from Meta's "Handle errors" reference: 190/102 invalid or
 * expired token, 10 and 200–299 permissions, 4/17/32/613 throttling,
 * 100 invalid parameter, 1/2 temporary.
 */
export function classifyMetaError(status: number, body: unknown): MetaError {
  const graph = graphError.safeParse(body);
  const flat = graph.success ? null : flatError.safeParse(body);
  const code = graph.success ? graph.data.error.code : flat?.success ? flat.data.code : undefined;
  const subcode = graph.success ? graph.data.error.error_subcode : undefined;
  const type = graph.success ? graph.data.error.type : flat?.success ? flat.data.error_type : undefined;
  const result = (kind: MetaErrorKind): MetaError => ({ kind, code, subcode });

  if (code === 190 || code === 102) return result("token");
  if (code === 10 || (code !== undefined && code >= 200 && code <= 299)) return result("permission");
  if (code === 4 || code === 17 || code === 32 || code === 613 || status === 429) return result("rate_limited");
  if (code === 1 || code === 2 || status >= 500) return result("unavailable");
  if (code === 100 || status === 400) return result("invalid_request");
  if (status === 401 || type === "OAuthException") return result("token");
  if (status === 403) return result("permission");
  return result("unavailable");
}

/* --------------------------------------------------------------- Responses */

const id = z.union([z.string(), z.number()]).transform(String);
const count = z.number().int().nonnegative().optional().catch(undefined);
const text = (max: number) =>
  z
    .string()
    .optional()
    .catch(undefined)
    .transform((v) => v?.slice(0, max));
const httpsUrl = z
  .string()
  .optional()
  .catch(undefined)
  .transform((v) => (v && /^https:\/\//.test(v) ? v.slice(0, 500) : undefined));
const epoch = z
  .number()
  .optional()
  .catch(undefined)
  .transform((v) => (v && v > 0 ? new Date(v * 1000) : null));

export const accessTokenResponse = z.object({
  access_token: z.string().min(10),
  expires_in: z.number().positive().optional().catch(undefined),
});

/** The Instagram code exchange: documented both flat and wrapped in `data: [...]`. */
export const instagramCodeResponse = z
  .union([
    z.object({ data: z.array(z.object({ access_token: z.string(), user_id: id, permissions: z.unknown() })).min(1) }).transform((r) => r.data[0]),
    z.object({ access_token: z.string(), user_id: id, permissions: z.unknown() }),
  ])
  .transform((r) => ({ accessToken: r.access_token, userId: r.user_id, permissions: scopeList(r.permissions) }));

function scopeList(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return list.filter((s): s is string => typeof s === "string").map((s) => s.trim()).filter(Boolean);
}

export const debugTokenResponse = z
  .object({
    data: z.object({
      app_id: id.optional(),
      is_valid: z.boolean(),
      user_id: id.optional(),
      profile_id: id.optional(),
      scopes: z.array(z.string()).optional().catch([]),
      expires_at: epoch,
      data_access_expires_at: epoch,
    }),
  })
  .transform(({ data }) => ({
    appId: data.app_id ?? null,
    isValid: data.is_valid,
    userId: data.user_id ?? null,
    profileId: data.profile_id ?? null,
    scopes: data.scopes ?? [],
    expiresAt: data.expires_at,
    dataAccessExpiresAt: data.data_access_expires_at,
  }));
export type TokenInfo = z.output<typeof debugTokenResponse>;

export const pagesResponse = z
  .object({
    data: z.array(
      z.object({
        id,
        name: z.string(),
        category: text(120),
        access_token: z.string().optional(),
        tasks: z.array(z.string()).optional().catch([]),
      }),
    ),
  })
  .transform((r) =>
    r.data.map((p) => ({ id: p.id, name: p.name.slice(0, 200), category: p.category ?? null, accessToken: p.access_token ?? null, tasks: p.tasks ?? [] })),
  );
export type FacebookPageChoice = z.output<typeof pagesResponse>[number];

export const pageProfileResponse = z
  .object({ id, name: z.string(), link: httpsUrl, category: text(120), followers_count: count, fan_count: count })
  .transform((p) => ({
    id: p.id,
    name: p.name.slice(0, 200),
    link: p.link ?? null,
    category: p.category ?? null,
    followers: p.followers_count ?? null,
    likes: p.fan_count ?? null,
  }));
export type FacebookPageProfile = z.output<typeof pageProfileResponse>;

export const pagePostsResponse = z
  .object({
    data: z.array(z.object({ id, message: text(280), created_time: z.string().optional(), permalink_url: httpsUrl })).catch([]),
  })
  .transform((r) => r.data.map((p) => ({ id: p.id, text: p.message ?? null, createdAt: isoDate(p.created_time), permalink: p.permalink_url ?? null })));

export const instagramProfileResponse = z
  .object({
    user_id: id.optional(),
    id: id.optional(),
    username: z.string(),
    name: text(200),
    account_type: z.string().optional().catch(undefined),
    followers_count: count,
    follows_count: count,
    media_count: count,
  })
  .transform((p) => ({
    /** The professional account id (`user_id`); `id` is app-scoped. */
    accountId: p.user_id ?? p.id ?? "",
    username: p.username.slice(0, 100),
    name: p.name ?? null,
    accountType: p.account_type?.toUpperCase() ?? null,
    followers: p.followers_count ?? null,
    follows: p.follows_count ?? null,
    mediaCount: p.media_count ?? null,
  }));
export type InstagramProfile = z.output<typeof instagramProfileResponse>;

/** Business Login for Instagram serves professional accounts only. */
export const eligibleInstagramTypes = ["BUSINESS", "MEDIA_CREATOR"];

export const instagramMediaResponse = z
  .object({
    data: z
      .array(
        z.object({
          id,
          caption: text(280),
          media_type: z.string().optional().catch(undefined),
          permalink: httpsUrl,
          timestamp: z.string().optional(),
          like_count: count,
          comments_count: count,
        }),
      )
      .catch([]),
  })
  .transform((r) =>
    r.data.map((m) => ({
      id: m.id,
      text: m.caption ?? null,
      mediaType: m.media_type ?? null,
      createdAt: isoDate(m.timestamp),
      permalink: m.permalink ?? null,
      likes: m.like_count ?? null,
      comments: m.comments_count ?? null,
    })),
  );

export interface SocialPost {
  id: string;
  text: string | null;
  createdAt: string | null;
  permalink: string | null;
  mediaType?: string | null;
  likes?: number | null;
  comments?: number | null;
}

function isoDate(value: string | undefined): string | null {
  if (!value) return null;
  // Graph API timestamps look like 2026-10-01T09:30:00+0000.
  const date = new Date(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/* ---------------------------------------------------------------- Insights */

/**
 * Metrics shown in the insights section, each fetched on its own so one that
 * Meta retires or withholds doesn't hide the others. Facebook: Page Insights
 * (`read_insights`, a Page token with the ANALYZE task, Pages with 100+ likes).
 * Instagram: account insights with `metric_type=total_value` over 28 days
 * (`instagram_business_manage_insights`; some need 100+ followers).
 */
export const insightMetrics = {
  facebook: [
    { key: "page_media_view", period: "days_28" },
    { key: "page_post_engagements", period: "days_28" },
    { key: "page_daily_follows_unique", period: "days_28" },
  ],
  instagram: [
    { key: "reach", period: "day" },
    { key: "views", period: "day" },
    { key: "accounts_engaged", period: "day" },
    { key: "total_interactions", period: "day" },
  ],
} as const;

export type FacebookMetric = (typeof insightMetrics.facebook)[number]["key"];
export type InstagramMetric = (typeof insightMetrics.instagram)[number]["key"];
export type InsightMetric = FacebookMetric | InstagramMetric;

export const INSIGHT_WINDOW_DAYS = 28;

/** Page Insights: the value of the latest period returned, or null when Meta returned no data. */
export const pageInsightResponse = z
  .object({
    data: z.array(z.object({ name: z.string(), values: z.array(z.object({ value: z.unknown(), end_time: z.string().optional() })).catch([]) })),
  })
  .transform((r) => {
    const values = r.data[0]?.values ?? [];
    const last = values.at(-1)?.value;
    return typeof last === "number" && Number.isFinite(last) ? last : null;
  });

/** Instagram total_value insights: `data[0].total_value.value`, or null (Meta returns an empty set, not 0, without data). */
export const instagramInsightResponse = z
  .object({ data: z.array(z.object({ name: z.string(), total_value: z.object({ value: z.unknown() }).optional() })) })
  .transform((r) => {
    const value = r.data[0]?.total_value?.value;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  });

/* -------------------------------------------------------------- Problems */

/** Why a stored connection needs attention. Stored in `SocialConnection.problem`. */
export const socialProblems = ["token_expired", "token_invalid", "revoked", "permission_removed", "not_eligible", "key_changed"] as const;
export type SocialProblem = (typeof socialProblems)[number];

export function isSocialProblem(value: unknown): value is SocialProblem {
  return typeof value === "string" && (socialProblems as readonly string[]).includes(value);
}

/** Outcomes of a connect attempt, shown on the settings page via `?result=`. */
export const connectResults = [
  "connected",
  "denied",
  "invalid_state",
  "not_configured",
  "missing_permission",
  "no_pages",
  "not_eligible",
  "wrong_app",
  "rate_limited",
  "failed",
] as const;
export type ConnectResult = (typeof connectResults)[number];

export function isConnectResult(value: unknown): value is ConnectResult {
  return typeof value === "string" && (connectResults as readonly string[]).includes(value);
}
