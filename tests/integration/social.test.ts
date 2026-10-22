import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { readSocialConfig, type MetaResult } from "@/lib/social/meta";
import { createStaffUser } from "@/lib/server/accounts";
import type { MetaApi } from "@/lib/server/meta-api";
import { hasTokenKey, openSecret, sealSecret } from "@/lib/server/social-crypto";
import {
  beginConnection,
  checkConnection,
  choosePage,
  completeConnection,
  disconnect,
  handleDeauthorize,
  listSocialAccounts,
  loadInsights,
  pendingPageChoice,
  refreshInstagramToken,
} from "@/lib/server/social";
import { createTestClient, NOW, resetDatabase } from "./helpers";

/*
 * The connection lifecycle against the test database, with Meta replaced by a
 * fake `MetaApi` that answers like the documented endpoints. No real
 * credentials or network.
 */

const db = createTestClient();
after(() => db.$disconnect());

process.env.SOCIAL_TOKEN_KEY = randomBytes(32).toString("base64");
const env = {
  NEXT_PUBLIC_SITE_URL: "https://studio08.mn",
  META_APP_ID: "1234567890",
  META_APP_SECRET: "fb-app-secret",
  INSTAGRAM_APP_ID: "9876543210",
  INSTAGRAM_APP_SECRET: "ig-app-secret",
};
const config = readSocialConfig(env, hasTokenKey());

const ok = <T,>(value: T): Promise<MetaResult<T>> => Promise.resolve({ ok: true, value });
const fail = (kind: "token" | "permission" | "invalid_request" | "unavailable", subcode?: number) =>
  Promise.resolve({ ok: false as const, error: { kind, code: kind === "token" ? 190 : 100, subcode } });

const pageToken = (id: string) => `EAAB-page-token-${id}`;
const FB_SCOPES = ["pages_show_list", "pages_read_engagement", "read_insights"];
const IG_SCOPES = ["instagram_business_basic", "instagram_business_manage_insights"];

/** A Meta that grants everything; tests override single methods. */
function fakeMeta(over: { facebook?: Partial<MetaApi["facebook"]>; instagram?: Partial<MetaApi["instagram"]> } = {}) {
  const calls: string[] = [];
  const track = <A extends unknown[], R>(name: string, fn: (...args: A) => R) => (...args: A) => {
    calls.push(name);
    return fn(...args);
  };
  const api: MetaApi = {
    facebook: {
      exchangeCode: track("fb.exchangeCode", () => ok({ accessToken: "EAAB-short-user" })),
      extendUserToken: track("fb.extendUserToken", () => ok({ accessToken: "EAAB-long-user", expiresAt: new Date(NOW.getTime() + 60 * 86_400_000) })),
      inspectToken: track("fb.inspectToken", () =>
        ok({ appId: "1234567890", isValid: true, userId: "fb-user-42", profileId: null, scopes: FB_SCOPES, expiresAt: null, dataAccessExpiresAt: new Date(NOW.getTime() + 90 * 86_400_000) }),
      ),
      listPages: track("fb.listPages", () => ok([{ id: "111", name: "STUDIO / 08", category: "Barber Shop", accessToken: pageToken("111"), tasks: ["ANALYZE"] }])),
      getPage: track("fb.getPage", (id: string) => ok({ id, name: "STUDIO / 08", link: `https://www.facebook.com/${id}`, category: "Barber Shop", followers: 1500, likes: 1400 })),
      recentPosts: track("fb.recentPosts", () => ok([{ id: "111_1", text: "Open Saturday", createdAt: "2026-10-20T03:00:00.000Z", permalink: "https://www.facebook.com/111/posts/1" }])),
      pageInsight: track("fb.pageInsight", () => ok(120)),
      ...over.facebook,
    },
    instagram: {
      exchangeCode: track("ig.exchangeCode", () => ok({ accessToken: "IGQ-short", userId: "ig-user-7", permissions: IG_SCOPES })),
      extendToken: track("ig.extendToken", () => ok({ accessToken: "IGQ-long-1", expiresAt: new Date(NOW.getTime() + 60 * 86_400_000) })),
      refreshToken: track("ig.refreshToken", () => ok({ accessToken: "IGQ-long-2", expiresAt: new Date(NOW.getTime() + 67 * 86_400_000) })),
      profile: track("ig.profile", () =>
        ok({ accountId: "17841400000000001", username: "studio08", name: "STUDIO / 08", accountType: "BUSINESS", followers: 980, follows: 120, mediaCount: 64 }),
      ),
      recentMedia: track("ig.recentMedia", () => ok([])),
      accountInsight: track("ig.accountInsight", () => ok(310)),
      ...over.instagram,
    },
  };
  return { api, calls };
}

let userId = "";
let otherId = "";

beforeEach(async () => {
  await resetDatabase(db);
  userId = (await createStaffUser(db, { email: "owner@studio.test", name: "Owner", password: "a long enough password", role: "ADMIN" })).id;
  otherId = (await createStaffUser(db, { email: "other@studio.test", name: "Other", password: "a long enough password", role: "ADMIN" })).id;
});

async function start(provider: "facebook" | "instagram", who = userId, now = NOW) {
  const begun = await beginConnection(db, config, { provider, userId: who, locale: "en", now });
  assert.ok(begun.ok);
  return new URL(begun.url).searchParams.get("state")!;
}

async function connectInstagram(api = fakeMeta().api, now = NOW) {
  const state = await start("instagram", userId, now);
  return completeConnection(db, api, config, { provider: "instagram", userId, state, code: "ig-code", error: null, now });
}

describe("starting a connection", () => {
  it("stores only a hash of a state that expires in ten minutes", async () => {
    const state = await start("facebook");
    const rows = await db.socialOAuthState.findMany();
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].stateHash, state);
    assert.equal(rows[0].userId, userId);
    assert.equal(rows[0].expiresAt.getTime() - NOW.getTime(), 10 * 60_000);
  });

  it("refuses when the provider isn't configured", async () => {
    const result = await beginConnection(db, readSocialConfig({}, false), { provider: "instagram", userId, locale: "en", now: NOW });
    assert.deepEqual(result, { ok: false, error: "not_configured" });
  });
});

describe("the OAuth callback", () => {
  it("connects an Instagram professional account and encrypts its token", async () => {
    const outcome = await connectInstagram();
    assert.deepEqual(outcome, { result: "connected", locale: "en" });
    const row = await db.socialConnection.findUniqueOrThrow({ where: { provider: "INSTAGRAM" } });
    assert.equal(row.status, "CONNECTED");
    assert.equal(row.username, "studio08");
    assert.equal(row.accountId, "17841400000000001");
    assert.equal(row.authorizedUserId, "ig-user-7");
    assert.deepEqual(row.grantedScopes, IG_SCOPES);
    assert.equal(row.encryptedToken?.includes("IGQ-long-1"), false);
    assert.equal(openSecret(row.encryptedToken!, "token:INSTAGRAM"), "IGQ-long-1");
    assert.equal(await db.socialOAuthState.count(), 0);
    assert.equal(await db.auditLog.count({ where: { action: "social.connected", actorId: userId } }), 1);
  });

  it("uses a state once only", async () => {
    const { api } = fakeMeta();
    const state = await start("instagram");
    const input = { provider: "instagram" as const, userId, state, code: "ig-code", error: null, now: NOW };
    assert.equal((await completeConnection(db, api, config, input)).result, "connected");
    assert.equal((await completeConnection(db, api, config, input)).result, "invalid_state");
  });

  it("rejects a state from another login, another provider, an expired one or none", async () => {
    const { api, calls } = fakeMeta();
    const state = await start("instagram");
    assert.equal((await completeConnection(db, api, config, { provider: "instagram", userId: otherId, state, code: "c", error: null, now: NOW })).result, "invalid_state");
    assert.equal((await completeConnection(db, api, config, { provider: "facebook", userId, state, code: "c", error: null, now: NOW })).result, "invalid_state");
    const late = new Date(NOW.getTime() + 11 * 60_000);
    assert.equal((await completeConnection(db, api, config, { provider: "instagram", userId, state, code: "c", error: null, now: late })).result, "invalid_state");
    assert.equal((await completeConnection(db, api, config, { provider: "instagram", userId, state: null, code: "c", error: null, now: NOW })).result, "invalid_state");
    assert.equal(calls.length, 0, "no code is exchanged without a valid state");
    assert.equal(await db.socialConnection.count(), 0);
  });

  it("stores nothing when the person cancels", async () => {
    const { api, calls } = fakeMeta();
    const state = await start("facebook");
    const outcome = await completeConnection(db, api, config, { provider: "facebook", userId, state, code: null, error: "access_denied", now: NOW });
    assert.equal(outcome.result, "denied");
    assert.equal(calls.length, 0);
    assert.equal(await db.socialConnection.count(), 0);
  });

  it("refuses a personal Instagram account", async () => {
    const { api } = fakeMeta({ instagram: { profile: () => ok({ accountId: "1", username: "me", name: null, accountType: "PERSONAL", followers: null, follows: null, mediaCount: null }) } });
    assert.equal((await connectInstagram(api)).result, "not_eligible");
    assert.equal(await db.socialConnection.count(), 0);
  });

  it("refuses when a required permission wasn't granted", async () => {
    const { api } = fakeMeta({ instagram: { exchangeCode: () => ok({ accessToken: "IGQ-short", userId: "7", permissions: ["instagram_business_manage_insights"] }) } });
    assert.equal((await connectInstagram(api)).result, "missing_permission");
    assert.equal(await db.socialConnection.count(), 0);
  });

  it("connects the only Facebook Page directly, with the Page token", async () => {
    const { api } = fakeMeta();
    const state = await start("facebook");
    const outcome = await completeConnection(db, api, config, { provider: "facebook", userId, state, code: "fb-code", error: null, now: NOW });
    assert.equal(outcome.result, "connected");
    const row = await db.socialConnection.findUniqueOrThrow({ where: { provider: "FACEBOOK" } });
    assert.equal(row.accountId, "111");
    assert.equal(row.authorizedUserId, "fb-user-42");
    assert.equal(row.tokenExpiresAt, null);
    assert.ok(row.dataAccessExpiresAt);
    assert.equal(openSecret(row.encryptedToken!, "token:FACEBOOK"), pageToken("111"));
  });

  it("rejects a token issued to another app", async () => {
    const { api } = fakeMeta({
      facebook: { inspectToken: () => ok({ appId: "999", isValid: true, userId: "1", profileId: null, scopes: FB_SCOPES, expiresAt: null, dataAccessExpiresAt: null }) },
    });
    const state = await start("facebook");
    assert.equal((await completeConnection(db, api, config, { provider: "facebook", userId, state, code: "c", error: null, now: NOW })).result, "wrong_app");
  });

  it("reports when no Page was shared", async () => {
    const { api } = fakeMeta({ facebook: { listPages: () => ok([]) } });
    const state = await start("facebook");
    assert.equal((await completeConnection(db, api, config, { provider: "facebook", userId, state, code: "c", error: null, now: NOW })).result, "no_pages");
  });

  it("lets the person pick one of several Pages, once", async () => {
    const { api } = fakeMeta({
      facebook: {
        listPages: () =>
          ok([
            { id: "111", name: "STUDIO / 08", category: "Barber Shop", accessToken: pageToken("111"), tasks: ["ANALYZE"] },
            { id: "222", name: "Side project", category: null, accessToken: pageToken("222"), tasks: ["CREATE_CONTENT"] },
          ]),
      },
    });
    const state = await start("facebook");
    const outcome = await completeConnection(db, api, config, { provider: "facebook", userId, state, code: "c", error: null, now: NOW });
    assert.equal(outcome.result, "choose");
    const pendingId = outcome.pendingId!;

    const choice = await pendingPageChoice(db, pendingId, userId, NOW);
    assert.deepEqual(choice, [
      { id: "111", name: "STUDIO / 08", category: "Barber Shop", canAnalyze: true },
      { id: "222", name: "Side project", category: null, canAnalyze: false },
    ]);
    assert.equal(JSON.stringify(choice).includes("EAAB"), false, "no tokens in the choice");
    assert.equal(await pendingPageChoice(db, pendingId, otherId, NOW), null);
    const stored = await db.socialOAuthState.findUniqueOrThrow({ where: { id: pendingId } });
    assert.equal(stored.encryptedPending?.includes("EAAB"), false);

    assert.equal(await choosePage(db, api, config, { pendingId, pageId: "222", userId: otherId, now: NOW }), "invalid_state");
    assert.equal(await choosePage(db, api, config, { pendingId, pageId: "222", userId, now: NOW }), "connected");
    assert.equal((await db.socialConnection.findUniqueOrThrow({ where: { provider: "FACEBOOK" } })).accountId, "222");
    assert.equal(await choosePage(db, api, config, { pendingId, pageId: "111", userId, now: NOW }), "invalid_state");
  });
});

describe("connection status", () => {
  it("never exposes tokens", async () => {
    await connectInstagram();
    const views = await listSocialAccounts(db, config, NOW);
    const json = JSON.stringify(views);
    assert.equal(json.includes("IGQ"), false);
    assert.equal(json.includes("v1."), false, "no ciphertext either");
    const ig = views.find((v) => v.provider === "instagram")!;
    assert.equal(ig.connection?.status, "connected");
    assert.equal(ig.connection?.profileUrl, "https://www.instagram.com/studio08/");
    assert.equal(views.find((v) => v.provider === "facebook")!.connection, null);
  });

  it("shows an expired token as needing reconnection", async () => {
    await connectInstagram();
    const later = new Date(NOW.getTime() + 61 * 86_400_000);
    const ig = (await listSocialAccounts(db, config, later)).find((v) => v.provider === "instagram")!;
    assert.equal(ig.connection?.status, "needs_reconnect");
    assert.equal(ig.connection?.problem, "token_expired");
    assert.deepEqual(await loadInsights(db, fakeMeta().api, "instagram", later), { state: "needs_reconnect" });
    const row = await db.socialConnection.findUniqueOrThrow({ where: { provider: "INSTAGRAM" } });
    assert.equal(row.status, "NEEDS_RECONNECT");
    assert.equal(row.encryptedToken, null);
  });

  it("flags and erases a token Meta rejects", async () => {
    await connectInstagram();
    const { api } = fakeMeta({ instagram: { profile: () => fail("token", 460) } });
    assert.equal(await checkConnection(db, api, config, "instagram", NOW), "needs_reconnect");
    const row = await db.socialConnection.findUniqueOrThrow({ where: { provider: "INSTAGRAM" } });
    assert.equal(row.status, "NEEDS_RECONNECT");
    assert.equal(row.problem, "token_invalid");
    assert.equal(row.encryptedToken, null);
    assert.equal(await db.auditLog.count({ where: { action: "social.needs_reconnect" } }), 1);
  });

  it("keeps the connection when Meta is only unreachable", async () => {
    await connectInstagram();
    const { api } = fakeMeta({ instagram: { profile: () => fail("unavailable") } });
    assert.equal(await checkConnection(db, api, config, "instagram", NOW), "unavailable");
    assert.equal((await db.socialConnection.findUniqueOrThrow({ where: { provider: "INSTAGRAM" } })).status, "CONNECTED");
  });

  it("flags a removed required Facebook permission", async () => {
    const state = await start("facebook");
    await completeConnection(db, fakeMeta().api, config, { provider: "facebook", userId, state, code: "c", error: null, now: NOW });
    const { api } = fakeMeta({
      facebook: { inspectToken: () => ok({ appId: "1234567890", isValid: true, userId: "fb-user-42", profileId: null, scopes: ["pages_show_list"], expiresAt: null, dataAccessExpiresAt: null }) },
    });
    assert.equal(await checkConnection(db, api, config, "facebook", NOW), "needs_reconnect");
    assert.equal((await db.socialConnection.findUniqueOrThrow({ where: { provider: "FACEBOOK" } })).problem, "permission_removed");
  });

  it("flags a token that can no longer be decrypted", async () => {
    await connectInstagram();
    await db.socialConnection.update({ where: { provider: "INSTAGRAM" }, data: { encryptedToken: sealSecret("IGQ-long-1", "token:FACEBOOK") } });
    assert.equal(await checkConnection(db, fakeMeta().api, config, "instagram", NOW), "needs_reconnect");
    assert.equal((await db.socialConnection.findUniqueOrThrow({ where: { provider: "INSTAGRAM" } })).problem, "key_changed");
  });
});

describe("token refresh", () => {
  it("refreshes an Instagram token once it is a week old", async () => {
    await connectInstagram();
    const { api, calls } = fakeMeta();
    assert.equal(await refreshInstagramToken(db, api, { now: new Date(NOW.getTime() + 3 * 86_400_000) }), "not_due");
    assert.equal(await refreshInstagramToken(db, api, { now: new Date(NOW.getTime() + 3600_000), force: true }), "not_due", "Meta requires 24 hours");
    assert.equal(calls.length, 0);
    const later = new Date(NOW.getTime() + 8 * 86_400_000);
    assert.equal(await refreshInstagramToken(db, api, { now: later }), "refreshed");
    const row = await db.socialConnection.findUniqueOrThrow({ where: { provider: "INSTAGRAM" } });
    assert.equal(openSecret(row.encryptedToken!, "token:INSTAGRAM"), "IGQ-long-2");
    assert.equal(row.tokenIssuedAt.getTime(), later.getTime());
  });
});

describe("insights", () => {
  it("shows each metric on its own, marking the ones Meta withholds", async () => {
    await connectInstagram();
    const { api } = fakeMeta({ instagram: { accountInsight: (_id, _token, metric) => (metric === "views" ? fail("invalid_request") : metric === "reach" ? ok(null) : ok(42)) } });
    const result = await loadInsights(db, api, "instagram", NOW);
    assert.equal(result.state, "ok");
    if (result.state !== "ok") return;
    assert.deepEqual(
      result.metrics.map((m) => [m.key, m.state, m.value]),
      [
        ["reach", "no_data", null],
        ["views", "unavailable", null],
        ["accounts_engaged", "ok", 42],
        ["total_interactions", "ok", 42],
      ],
    );
    assert.equal(result.followers, 980);
  });

  it("doesn't ask for insights the person didn't grant", async () => {
    const { api, calls } = fakeMeta({ instagram: { exchangeCode: () => ok({ accessToken: "IGQ-short", userId: "7", permissions: ["instagram_business_basic"] }) } });
    await connectInstagram(api);
    const result = await loadInsights(db, api, "instagram", NOW);
    assert.equal(result.state === "ok" && result.insightsGranted, false);
    assert.ok(result.state === "ok" && result.metrics.every((m) => m.state === "permission"));
    assert.equal(calls.includes("ig.accountInsight"), false);
  });

  it("returns nothing for an account that isn't connected", async () => {
    assert.deepEqual(await loadInsights(db, fakeMeta().api, "facebook", NOW), { state: "not_connected" });
  });

  it("flags the connection when Meta rejects the token mid-way", async () => {
    const state = await start("facebook");
    await completeConnection(db, fakeMeta().api, config, { provider: "facebook", userId, state, code: "c", error: null, now: NOW });
    const { api } = fakeMeta({ facebook: { pageInsight: () => fail("token") } });
    assert.deepEqual(await loadInsights(db, api, "facebook", new Date(NOW.getTime() + 1000)), { state: "needs_reconnect" });
    assert.equal((await db.socialConnection.findUniqueOrThrow({ where: { provider: "FACEBOOK" } })).status, "NEEDS_RECONNECT");
  });
});

describe("disconnecting and revocation", () => {
  it("deletes the connection and records who did it", async () => {
    await connectInstagram();
    assert.equal(await disconnect(db, "instagram", userId), true);
    assert.equal(await db.socialConnection.count(), 0);
    assert.equal(await db.auditLog.count({ where: { action: "social.disconnected", actorId: userId } }), 1);
    assert.equal(await disconnect(db, "instagram", userId), false);
  });

  it("marks a connection revoked on a verified deauthorize callback only", async () => {
    await connectInstagram();
    const signed = (payload: object, secret: string) => {
      const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
      return `${createHmac("sha256", secret).update(body).digest("base64url")}.${body}`;
    };
    assert.equal(await handleDeauthorize(db, config, "instagram", signed({ algorithm: "HMAC-SHA256", user_id: "ig-user-7" }, "wrong-secret")), false);
    assert.equal((await db.socialConnection.findUniqueOrThrow({ where: { provider: "INSTAGRAM" } })).status, "CONNECTED");
    assert.equal(await handleDeauthorize(db, config, "instagram", signed({ algorithm: "HMAC-SHA256", user_id: "someone-else" }, "ig-app-secret")), true);
    assert.equal((await db.socialConnection.findUniqueOrThrow({ where: { provider: "INSTAGRAM" } })).status, "CONNECTED");
    assert.equal(await handleDeauthorize(db, config, "instagram", signed({ algorithm: "HMAC-SHA256", user_id: "ig-user-7" }, "ig-app-secret")), true);
    const row = await db.socialConnection.findUniqueOrThrow({ where: { provider: "INSTAGRAM" } });
    assert.equal(row.status, "NEEDS_RECONNECT");
    assert.equal(row.problem, "revoked");
    assert.equal(row.encryptedToken, null);
  });
});
