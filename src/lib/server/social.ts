import "server-only";
import type { SocialConnection } from "@/generated/prisma/client";
import type { SocialProvider } from "@/generated/prisma/enums";
import {
  callbackPath,
  deauthorizePath,
  eligibleInstagramTypes,
  facebookAuthorizeUrl,
  INSIGHT_WINDOW_DAYS,
  insightMetrics,
  instagramAuthorizeUrl,
  isSocialProblem,
  missingScopes,
  parseOrigin,
  readSocialConfig,
  scopes,
  type ConnectResult,
  type FacebookPageChoice,
  type InsightMetric,
  type MetaError,
  type MetaResult,
  type SocialConfig,
  type SocialPost,
  type SocialProblem,
  type SocialProviderKey,
} from "@/lib/social/meta";
import { audit } from "./audit";
import type { Db } from "./db";
import { createMetaApi, type MetaApi } from "./meta-api";
import { hashState, hasTokenKey, newState, openSecret, sealSecret, verifySignedRequest } from "./social-crypto";

/*
 * Connected Facebook Page and Instagram professional account (Phase 06).
 *
 * - A connection exists only after Meta's callback has been verified: the
 *   state is hashed, single-use, bound to the staff login that started it and
 *   valid for ten minutes, and the granted permissions are read back from
 *   Meta rather than assumed from what was requested.
 * - Tokens are encrypted at rest (social-crypto.ts) and never leave the
 *   server: the view models below carry no token, and the browser only ever
 *   sees connection metadata.
 * - When Meta says a token no longer works (expired, revoked, password
 *   changed, permission removed) the token is erased and the connection is
 *   marked NEEDS_RECONNECT. Nothing is faked: no connection, no numbers.
 *
 * Every function takes the Prisma client and, where it talks to Meta, a
 * `MetaApi`, so the tests run against fakes. See docs/SOCIAL.md.
 */

const STATE_TTL_MS = 10 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
/** Instagram allows a refresh once a token is a day old; refresh weekly while the dashboard is used. */
const INSTAGRAM_REFRESH_AFTER_MS = 7 * DAY_MS;
const INSIGHTS_TTL_MS = 10 * 60_000;

const providerEnum = { facebook: "FACEBOOK", instagram: "INSTAGRAM" } as const satisfies Record<SocialProviderKey, SocialProvider>;
const providerKey = (value: SocialProvider): SocialProviderKey => (value === "FACEBOOK" ? "facebook" : "instagram");
const tokenContext = (provider: SocialProviderKey) => `token:${providerEnum[provider]}`;
const pendingContext = (userId: string) => `pending:FACEBOOK:${userId}`;

export function socialConfig(): SocialConfig {
  return readSocialConfig(process.env, hasTokenKey());
}

export function metaApi(config: SocialConfig = socialConfig()): MetaApi {
  return createMetaApi(config);
}

/* ---------------------------------------------------------------- Connect */

/** Start an OAuth round trip for `userId`. Returns the Meta authorization URL to redirect to. */
export async function beginConnection(
  db: Db,
  config: SocialConfig,
  input: { provider: SocialProviderKey; userId: string; locale: string; now?: Date },
): Promise<{ ok: true; url: string } | { ok: false; error: "not_configured" }> {
  const app = config[input.provider];
  if (!app) return { ok: false, error: "not_configured" };
  const now = input.now ?? new Date();
  // One round trip in flight per person and provider; expired rows are swept as well.
  await db.socialOAuthState.deleteMany({
    where: { OR: [{ expiresAt: { lte: now } }, { userId: input.userId, provider: providerEnum[input.provider], stateHash: { not: null } }] },
  });
  const { state, hash } = newState();
  await db.socialOAuthState.create({
    data: { stateHash: hash, provider: providerEnum[input.provider], userId: input.userId, locale: input.locale, expiresAt: new Date(now.getTime() + STATE_TTL_MS) },
  });
  const url = input.provider === "facebook" ? facebookAuthorizeUrl(app, config.graphVersion, state) : instagramAuthorizeUrl(app, state);
  return { ok: true, url };
}

export interface CallbackInput {
  provider: SocialProviderKey;
  /** The signed-in staff member receiving the callback. */
  userId: string;
  state: string | null;
  code: string | null;
  error: string | null;
  now?: Date;
}

export interface CallbackOutcome {
  result: ConnectResult | "choose";
  /** The locale the flow started in, when the state was valid. */
  locale: string | null;
  pendingId?: string;
}

/** Handle Meta's redirect back. Consumes the state whatever happens next. */
export async function completeConnection(db: Db, api: MetaApi, config: SocialConfig, input: CallbackInput): Promise<CallbackOutcome> {
  const now = input.now ?? new Date();
  if (!input.state || input.state.length > 200) return { result: "invalid_state", locale: null };
  const row = await db.socialOAuthState.findUnique({ where: { stateHash: hashState(input.state) } });
  if (!row || row.provider !== providerEnum[input.provider] || row.userId !== input.userId) return { result: "invalid_state", locale: null };
  // Single use, even under a double submit: only the request that deletes the row continues.
  const consumed = await db.socialOAuthState.deleteMany({ where: { id: row.id, stateHash: row.stateHash } });
  if (consumed.count !== 1 || row.expiresAt <= now) return { result: "invalid_state", locale: row.locale };
  const locale = row.locale;

  if (!config[input.provider]) return { result: "not_configured", locale };
  if (input.error) return { result: input.error === "access_denied" ? "denied" : "failed", locale };
  if (!input.code || input.code.length > 2000) return { result: "invalid_state", locale };

  if (input.provider === "instagram") return { result: await connectInstagram(db, api, input.code, input.userId, now), locale };

  const fb = await authorizeFacebook(api, config, input.code);
  if (!fb.ok) return { result: fb.result, locale };
  const pages = fb.pages.filter((p) => p.accessToken);
  if (pages.length === 0) return { result: "no_pages", locale };
  if (pages.length === 1) return { result: await connectFacebookPage(db, api, config, pages[0], fb.userId, input.userId, now), locale };

  const pending = await db.socialOAuthState.create({
    data: {
      provider: "FACEBOOK",
      userId: input.userId,
      locale,
      expiresAt: new Date(now.getTime() + STATE_TTL_MS),
      encryptedPending: sealSecret(JSON.stringify({ authorizedUserId: fb.userId, pages }), pendingContext(input.userId)),
    },
  });
  return { result: "choose", locale, pendingId: pending.id };
}

function failure(error: MetaError): ConnectResult {
  if (error.kind === "permission") return "missing_permission";
  if (error.kind === "rate_limited") return "rate_limited";
  return "failed";
}

async function authorizeFacebook(
  api: MetaApi,
  config: SocialConfig,
  code: string,
): Promise<{ ok: true; userId: string | null; pages: FacebookPageChoice[] } | { ok: false; result: ConnectResult }> {
  const short = await api.facebook.exchangeCode(code);
  if (!short.ok) return { ok: false, result: failure(short.error) };
  const long = await api.facebook.extendUserToken(short.value.accessToken);
  if (!long.ok) return { ok: false, result: failure(long.error) };
  const info = await api.facebook.inspectToken(long.value.accessToken);
  if (!info.ok) return { ok: false, result: failure(info.error) };
  if (!info.value.isValid) return { ok: false, result: "failed" };
  if (info.value.appId !== config.facebook?.appId) return { ok: false, result: "wrong_app" };
  if (missingScopes("facebook", info.value.scopes, "required").length > 0) return { ok: false, result: "missing_permission" };
  const pages = await api.facebook.listPages(long.value.accessToken);
  if (!pages.ok) return { ok: false, result: failure(pages.error) };
  return { ok: true, userId: info.value.userId, pages: pages.value };
}

async function connectFacebookPage(
  db: Db,
  api: MetaApi,
  config: SocialConfig,
  page: FacebookPageChoice,
  authorizedUserId: string | null,
  actorId: string,
  now: Date,
): Promise<ConnectResult> {
  if (!page.accessToken) return "no_pages";
  const info = await api.facebook.inspectToken(page.accessToken);
  if (!info.ok) return failure(info.error);
  if (!info.value.isValid) return "failed";
  if (info.value.appId !== config.facebook?.appId) return "wrong_app";
  if (missingScopes("facebook", info.value.scopes, "required").length > 0) return "missing_permission";
  const profile = await api.facebook.getPage(page.id, page.accessToken);
  if (!profile.ok) return failure(profile.error);

  await saveConnection(db, "facebook", actorId, now, {
    accountId: profile.value.id,
    authorizedUserId,
    name: profile.value.name,
    username: null,
    accountType: null,
    grantedScopes: info.value.scopes,
    token: page.accessToken,
    tokenExpiresAt: info.value.expiresAt,
    dataAccessExpiresAt: info.value.dataAccessExpiresAt,
  });
  return "connected";
}

async function connectInstagram(db: Db, api: MetaApi, code: string, actorId: string, now: Date): Promise<ConnectResult> {
  const short = await api.instagram.exchangeCode(code);
  if (!short.ok) return failure(short.error);
  if (missingScopes("instagram", short.value.permissions, "required").length > 0) return "missing_permission";
  const long = await api.instagram.extendToken(short.value.accessToken);
  if (!long.ok) return failure(long.error);
  const profile = await api.instagram.profile(long.value.accessToken);
  if (!profile.ok) return failure(profile.error);
  if (!profile.value.accountType || !eligibleInstagramTypes.includes(profile.value.accountType)) return "not_eligible";

  await saveConnection(db, "instagram", actorId, now, {
    accountId: profile.value.accountId || short.value.userId,
    authorizedUserId: short.value.userId,
    name: profile.value.name || profile.value.username,
    username: profile.value.username,
    accountType: profile.value.accountType,
    grantedScopes: short.value.permissions,
    token: long.value.accessToken,
    tokenExpiresAt: long.value.expiresAt,
    dataAccessExpiresAt: null,
  });
  return "connected";
}

async function saveConnection(
  db: Db,
  provider: SocialProviderKey,
  actorId: string,
  now: Date,
  data: {
    accountId: string;
    authorizedUserId: string | null;
    name: string;
    username: string | null;
    accountType: string | null;
    grantedScopes: string[];
    token: string;
    tokenExpiresAt: Date | null;
    dataAccessExpiresAt: Date | null;
  },
) {
  const { token, ...fields } = data;
  const values = {
    ...fields,
    status: "CONNECTED" as const,
    problem: null,
    encryptedToken: sealSecret(token, tokenContext(provider)),
    tokenIssuedAt: now,
    lastCheckedAt: now,
    connectedById: actorId,
    connectedAt: now,
  };
  await db.$transaction(async (tx) => {
    const previous = await tx.socialConnection.findUnique({ where: { provider: providerEnum[provider] }, select: { accountId: true } });
    await tx.socialConnection.upsert({ where: { provider: providerEnum[provider] }, create: { provider: providerEnum[provider], ...values }, update: values });
    await audit(tx, {
      actorId,
      action: "social.connected",
      entityType: "social",
      entityId: provider,
      metadata: { provider, account: data.username ? `@${data.username}` : data.name, ...(previous && previous.accountId !== data.accountId ? { replaced: true } : {}) },
    });
  });
  invalidateInsights(provider);
}

/** The Pages offered after a Facebook callback, without their tokens; null if expired or not this person's. */
export async function pendingPageChoice(db: Db, pendingId: string, userId: string, now = new Date()) {
  const pending = await readPending(db, pendingId, userId, now);
  return pending ? pending.pages.map((p) => ({ id: p.id, name: p.name, category: p.category, canAnalyze: p.tasks.includes("ANALYZE") })) : null;
}

async function readPending(db: Db, pendingId: string, userId: string, now: Date) {
  if (!/^[a-z0-9]{8,40}$/.test(pendingId)) return null;
  const row = await db.socialOAuthState.findFirst({ where: { id: pendingId, userId, provider: "FACEBOOK", stateHash: null } });
  if (!row?.encryptedPending || row.expiresAt <= now) return null;
  const json = openSecret(row.encryptedPending, pendingContext(userId));
  if (!json) return null;
  return { row, ...(JSON.parse(json) as { authorizedUserId: string | null; pages: FacebookPageChoice[] }) };
}

/** Connect the Page picked from a pending choice. The choice is used up either way. */
export async function choosePage(
  db: Db,
  api: MetaApi,
  config: SocialConfig,
  input: { pendingId: string; pageId: string; userId: string; now?: Date },
): Promise<ConnectResult> {
  const now = input.now ?? new Date();
  const pending = await readPending(db, input.pendingId, input.userId, now);
  if (!pending) return "invalid_state";
  const page = pending.pages.find((p) => p.id === input.pageId);
  if (!page) return "invalid_state";
  const consumed = await db.socialOAuthState.deleteMany({ where: { id: pending.row.id, userId: input.userId } });
  if (consumed.count !== 1) return "invalid_state";
  if (!config.facebook) return "not_configured";
  return connectFacebookPage(db, api, config, page, pending.authorizedUserId, input.userId, now);
}

/** Forget a connection: its encrypted token and metadata are deleted. Returns false if there was none. */
export async function disconnect(db: Db, provider: SocialProviderKey, actorId: string): Promise<boolean> {
  const removed = await db.$transaction(async (tx) => {
    const row = await tx.socialConnection.findUnique({ where: { provider: providerEnum[provider] }, select: { name: true, username: true } });
    if (!row) return false;
    await tx.socialConnection.delete({ where: { provider: providerEnum[provider] } });
    await audit(tx, {
      actorId,
      action: "social.disconnected",
      entityType: "social",
      entityId: provider,
      metadata: { provider, account: row.username ? `@${row.username}` : row.name },
    });
    return true;
  });
  invalidateInsights(provider);
  return removed;
}

/** Erase the token and flag the connection. No-op if it already needs reconnecting. */
export async function markNeedsReconnect(db: Db, provider: SocialProviderKey, problem: SocialProblem, now = new Date()): Promise<void> {
  const updated = await db.socialConnection.updateMany({
    where: { provider: providerEnum[provider], status: "CONNECTED" },
    data: { status: "NEEDS_RECONNECT", problem, encryptedToken: null, lastCheckedAt: now },
  });
  invalidateInsights(provider);
  if (updated.count > 0) {
    console.warn(`[social] ${provider} connection needs reconnecting: ${problem}.`);
    await audit(db, { actorId: null, action: "social.needs_reconnect", entityType: "social", entityId: provider, metadata: { provider, problem } });
  }
}

/* ----------------------------------------------------------------- Status */

export interface SocialConnectionView {
  status: "connected" | "needs_reconnect";
  problem: SocialProblem | null;
  accountId: string;
  name: string;
  username: string | null;
  accountType: string | null;
  grantedScopes: string[];
  /** Required permissions missing from the grant (connected rows never have any). */
  missingRequired: string[];
  /** Optional permissions not granted: the features they unlock are unavailable. */
  missingOptional: string[];
  tokenExpiresAt: Date | null;
  dataAccessExpiresAt: Date | null;
  connectedAt: Date;
  connectedBy: string | null;
  lastCheckedAt: Date | null;
  profileUrl: string | null;
}

export interface SocialAccountView {
  provider: SocialProviderKey;
  configured: boolean;
  /** Environment variable names still to set. */
  missingEnv: string[];
  redirectUri: string | null;
  deauthorizeUri: string | null;
  requested: { required: readonly string[]; optional: readonly string[] };
  connection: SocialConnectionView | null;
}

/** Both providers' setup and stored connection, for the settings page. No tokens. */
export async function listSocialAccounts(db: Db, config: SocialConfig, now = new Date()): Promise<SocialAccountView[]> {
  const rows = await db.socialConnection.findMany({ include: { connectedBy: { select: { name: true } } } });
  const origin = parseOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  return (["facebook", "instagram"] as const).map((provider) => {
    const row = rows.find((r) => providerKey(r.provider) === provider);
    return {
      provider,
      configured: Boolean(config[provider]),
      missingEnv: config.missing[provider],
      redirectUri: origin ? `${origin}${callbackPath(provider)}` : null,
      deauthorizeUri: origin ? `${origin}${deauthorizePath(provider)}` : null,
      requested: scopes[provider],
      connection: row ? connectionView(provider, row, row.connectedBy?.name ?? null, now) : null,
    };
  });
}

function connectionView(provider: SocialProviderKey, row: SocialConnection, connectedBy: string | null, now: Date): SocialConnectionView {
  const expired = Boolean(row.tokenExpiresAt && row.tokenExpiresAt <= now) || Boolean(row.dataAccessExpiresAt && row.dataAccessExpiresAt <= now);
  const working = row.status === "CONNECTED" && !expired;
  return {
    status: working ? "connected" : "needs_reconnect",
    problem: working ? null : isSocialProblem(row.problem) ? row.problem : "token_expired",
    accountId: row.accountId,
    name: row.name,
    username: row.username,
    accountType: row.accountType,
    grantedScopes: row.grantedScopes,
    missingRequired: missingScopes(provider, row.grantedScopes, "required"),
    missingOptional: missingScopes(provider, row.grantedScopes, "optional"),
    tokenExpiresAt: row.tokenExpiresAt,
    dataAccessExpiresAt: row.dataAccessExpiresAt,
    connectedAt: row.connectedAt,
    connectedBy,
    lastCheckedAt: row.lastCheckedAt,
    profileUrl:
      provider === "instagram" && row.username
        ? `https://www.instagram.com/${encodeURIComponent(row.username)}/`
        : provider === "facebook" && /^\d+$/.test(row.accountId)
          ? `https://www.facebook.com/${row.accountId}`
          : null,
  };
}

/**
 * The decrypted token of a working connection, or null (after flagging the
 * connection when the token is expired or can no longer be decrypted).
 */
async function usableToken(db: Db, provider: SocialProviderKey, now: Date): Promise<{ row: SocialConnection; token: string } | null> {
  const row = await db.socialConnection.findUnique({ where: { provider: providerEnum[provider] } });
  if (!row || row.status !== "CONNECTED" || !row.encryptedToken) return null;
  if ((row.tokenExpiresAt && row.tokenExpiresAt <= now) || (row.dataAccessExpiresAt && row.dataAccessExpiresAt <= now)) {
    await markNeedsReconnect(db, provider, "token_expired", now);
    return null;
  }
  const token = openSecret(row.encryptedToken, tokenContext(provider));
  if (!token) {
    await markNeedsReconnect(db, provider, "key_changed", now);
    return null;
  }
  return { row, token };
}

/** React to a failed call made with a stored token. Returns true if the connection was flagged. */
async function handleTokenError(db: Db, provider: SocialProviderKey, error: MetaError, now: Date): Promise<boolean> {
  if (error.kind !== "token") return false;
  // 190/463 is an expired token; anything else under 190 means it was invalidated (logout, password change, removal).
  await markNeedsReconnect(db, provider, error.subcode === 463 ? "token_expired" : "token_invalid", now);
  return true;
}

export type CheckResult = "ok" | "needs_reconnect" | "unavailable" | "not_connected";

/** Ask Meta whether a stored connection still works, and refresh what it reports. */
export async function checkConnection(db: Db, api: MetaApi, config: SocialConfig, provider: SocialProviderKey, now = new Date()): Promise<CheckResult> {
  const current = await usableToken(db, provider, now);
  if (!current) {
    const exists = await db.socialConnection.count({ where: { provider: providerEnum[provider] } });
    return exists ? "needs_reconnect" : "not_connected";
  }
  const where = { provider: providerEnum[provider], status: "CONNECTED" as const };

  if (provider === "facebook") {
    const info = await api.facebook.inspectToken(current.token);
    if (!info.ok) return (await handleTokenError(db, provider, info.error, now)) ? "needs_reconnect" : "unavailable";
    if (!info.value.isValid || info.value.appId !== config.facebook?.appId) {
      await markNeedsReconnect(db, provider, "token_invalid", now);
      return "needs_reconnect";
    }
    if (missingScopes("facebook", info.value.scopes, "required").length > 0) {
      await markNeedsReconnect(db, provider, "permission_removed", now);
      return "needs_reconnect";
    }
    await db.socialConnection.updateMany({
      where,
      data: { grantedScopes: info.value.scopes, tokenExpiresAt: info.value.expiresAt, dataAccessExpiresAt: info.value.dataAccessExpiresAt, lastCheckedAt: now },
    });
    invalidateInsights(provider);
    return "ok";
  }

  const profile = await api.instagram.profile(current.token);
  if (!profile.ok) {
    if (await handleTokenError(db, provider, profile.error, now)) return "needs_reconnect";
    if (profile.error.kind === "permission") {
      await markNeedsReconnect(db, provider, "permission_removed", now);
      return "needs_reconnect";
    }
    return "unavailable";
  }
  if (!profile.value.accountType || !eligibleInstagramTypes.includes(profile.value.accountType)) {
    await markNeedsReconnect(db, provider, "not_eligible", now);
    return "needs_reconnect";
  }
  await db.socialConnection.updateMany({
    where,
    data: { name: profile.value.name || profile.value.username, username: profile.value.username, accountType: profile.value.accountType, lastCheckedAt: now },
  });
  invalidateInsights(provider);
  return "ok";
}

/**
 * Extend the Instagram token by another 60 days. Meta only refreshes tokens
 * that are at least a day old and not yet expired; without `force` this waits
 * until the token is a week old, so routine page views don't call Meta.
 */
export async function refreshInstagramToken(
  db: Db,
  api: MetaApi,
  options: { now?: Date; force?: boolean } = {},
): Promise<"refreshed" | "not_due" | "needs_reconnect" | "unavailable" | "not_connected"> {
  const now = options.now ?? new Date();
  const current = await usableToken(db, "instagram", now);
  if (!current) return (await db.socialConnection.count({ where: { provider: "INSTAGRAM" } })) ? "needs_reconnect" : "not_connected";
  const age = now.getTime() - current.row.tokenIssuedAt.getTime();
  if (age < DAY_MS || (!options.force && age < INSTAGRAM_REFRESH_AFTER_MS)) return "not_due";
  const result = await api.instagram.refreshToken(current.token);
  if (!result.ok) return (await handleTokenError(db, "instagram", result.error, now)) ? "needs_reconnect" : "unavailable";
  await db.socialConnection.updateMany({
    where: { provider: "INSTAGRAM", status: "CONNECTED", tokenIssuedAt: current.row.tokenIssuedAt },
    data: { encryptedToken: sealSecret(result.value.accessToken, tokenContext("instagram")), tokenIssuedAt: now, tokenExpiresAt: result.value.expiresAt },
  });
  invalidateInsights("instagram");
  return "refreshed";
}

/* --------------------------------------------------------------- Insights */

export type MetricState = "ok" | "no_data" | "permission" | "unavailable";

export interface SocialInsights {
  state: "ok";
  fetchedAt: Date;
  /** Live profile figures; null when Meta didn't return them. */
  followers: number | null;
  likes: number | null;
  mediaCount: number | null;
  link: string | null;
  metrics: { key: InsightMetric; value: number | null; state: MetricState }[];
  /** Whether the insights permission was granted at all. */
  insightsGranted: boolean;
  posts: SocialPost[] | null;
}

export type InsightsResult = SocialInsights | { state: "not_connected" | "needs_reconnect" | "unavailable" | "rate_limited" };

const insightsCache = new Map<string, { expires: number; value: SocialInsights }>();

function invalidateInsights(provider: SocialProviderKey) {
  for (const key of insightsCache.keys()) if (key.startsWith(`${provider}:`)) insightsCache.delete(key);
}

const metricState = (result: MetaResult<number | null>): { value: number | null; state: MetricState } =>
  result.ok
    ? { value: result.value, state: result.value === null ? "no_data" : "ok" }
    : { value: null, state: result.error.kind === "permission" ? "permission" : "unavailable" };

/**
 * Read-only figures for the insights section: live profile counts, the
 * insight metrics (each on its own, so one Meta rejects or withholds shows as
 * unavailable without hiding the rest) and the latest posts. Cached for ten
 * minutes per connection.
 */
export async function loadInsights(db: Db, api: MetaApi, provider: SocialProviderKey, now = new Date()): Promise<InsightsResult> {
  if (provider === "instagram") await refreshInstagramToken(db, api, { now });
  const current = await usableToken(db, provider, now);
  if (!current) return { state: (await db.socialConnection.count({ where: { provider: providerEnum[provider] } })) ? "needs_reconnect" : "not_connected" };
  const { row, token } = current;

  const cacheKey = `${provider}:${row.id}:${row.tokenIssuedAt.getTime()}`;
  const cached = insightsCache.get(cacheKey);
  if (cached && cached.expires > now.getTime()) return cached.value;

  const insightsGranted = missingScopes(provider, row.grantedScopes, "optional").length === 0;
  const denied = { ok: false, error: { kind: "permission" } } as const;
  let value: SocialInsights;

  if (provider === "facebook") {
    const [profile, posts, ...metrics] = await Promise.all([
      api.facebook.getPage(row.accountId, token),
      api.facebook.recentPosts(row.accountId, token, 5),
      ...insightMetrics.facebook.map((m) => (insightsGranted ? api.facebook.pageInsight(row.accountId, token, m.key, m.period) : Promise.resolve(denied))),
    ]);
    const failed = [profile, posts, ...metrics].find((r) => !r.ok && r.error.kind === "token");
    if (failed && !failed.ok && (await handleTokenError(db, provider, failed.error, now))) return { state: "needs_reconnect" };
    if (!profile.ok) return { state: profile.error.kind === "rate_limited" ? "rate_limited" : "unavailable" };
    value = {
      state: "ok",
      fetchedAt: now,
      followers: profile.value.followers,
      likes: profile.value.likes,
      mediaCount: null,
      link: profile.value.link,
      metrics: insightMetrics.facebook.map((m, i) => ({ key: m.key, ...metricState(metrics[i]) })),
      insightsGranted,
      posts: posts.ok ? posts.value : null,
    };
  } else {
    const until = now;
    const since = new Date(now.getTime() - INSIGHT_WINDOW_DAYS * DAY_MS);
    const [profile, media, ...metrics] = await Promise.all([
      api.instagram.profile(token),
      api.instagram.recentMedia(token, 5),
      ...insightMetrics.instagram.map((m) => (insightsGranted ? api.instagram.accountInsight(row.accountId, token, m.key, since, until) : Promise.resolve(denied))),
    ]);
    const failed = [profile, media, ...metrics].find((r) => !r.ok && r.error.kind === "token");
    if (failed && !failed.ok && (await handleTokenError(db, provider, failed.error, now))) return { state: "needs_reconnect" };
    if (!profile.ok) return { state: profile.error.kind === "rate_limited" ? "rate_limited" : "unavailable" };
    value = {
      state: "ok",
      fetchedAt: now,
      followers: profile.value.followers,
      likes: null,
      mediaCount: profile.value.mediaCount,
      link: `https://www.instagram.com/${encodeURIComponent(profile.value.username)}/`,
      metrics: insightMetrics.instagram.map((m, i) => ({ key: m.key, ...metricState(metrics[i]) })),
      insightsGranted,
      posts: media.ok ? media.value : null,
    };
  }

  if (insightsCache.size > 20) insightsCache.clear();
  insightsCache.set(cacheKey, { expires: now.getTime() + INSIGHTS_TTL_MS, value });
  return value;
}

/* ---------------------------------------------------------- Deauthorize */

/**
 * Meta's deauthorize callback: someone removed the app from their Facebook or
 * Instagram settings. Verifies the signed request with that app's secret and
 * flags the matching connection as revoked. Returns false when the signature
 * doesn't verify; true otherwise (also when no connection matched).
 */
export async function handleDeauthorize(db: Db, config: SocialConfig, provider: SocialProviderKey, signedRequest: string): Promise<boolean> {
  const app = config[provider];
  if (!app || signedRequest.length > 4096) return false;
  const payload = verifySignedRequest(signedRequest, app.appSecret);
  const userId = payload?.user_id;
  if (typeof userId !== "string" && typeof userId !== "number") return false;
  const match = await db.socialConnection.findFirst({ where: { provider: providerEnum[provider], authorizedUserId: String(userId) }, select: { id: true } });
  if (match) await markNeedsReconnect(db, provider, "revoked");
  return true;
}
