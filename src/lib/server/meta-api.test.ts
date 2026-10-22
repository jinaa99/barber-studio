import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { readSocialConfig } from "@/lib/social/meta";
import { createMetaApi, type Http } from "./meta-api";
import { appSecretProof } from "./social-crypto";

/* The HTTP transport against a fake `fetch`: endpoints, parameters, error mapping, and that secrets never reach the logs. */

const config = readSocialConfig(
  {
    NEXT_PUBLIC_SITE_URL: "https://studio08.mn",
    META_APP_ID: "1234567890",
    META_APP_SECRET: "fb-app-secret",
    INSTAGRAM_APP_ID: "9876543210",
    INSTAGRAM_APP_SECRET: "ig-app-secret",
  },
  true,
);

interface Call {
  url: URL;
  init: RequestInit;
}

function fakeHttp(respond: (call: Call) => { status?: number; body: unknown }) {
  const calls: Call[] = [];
  const http: Http = async (url, init) => {
    const call = { url: new URL(url), init };
    calls.push(call);
    const { status = 200, body } = respond(call);
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  };
  return { http, calls };
}

let logged: string[] = [];
beforeEach(() => {
  logged = [];
  mock.method(console, "error", (...args: unknown[]) => logged.push(args.map(String).join(" ")));
});
afterEach(() => mock.restoreAll());

describe("Meta API client", () => {
  it("exchanges a Facebook code with the registered redirect URI", async () => {
    const { http, calls } = fakeHttp(() => ({ body: { access_token: "EAAB-short-token", token_type: "bearer" } }));
    const result = await createMetaApi(config, http).facebook.exchangeCode("the-code");
    assert.deepEqual(result, { ok: true, value: { accessToken: "EAAB-short-token" } });
    const { url } = calls[0];
    assert.equal(url.origin + url.pathname, "https://graph.facebook.com/v26.0/oauth/access_token");
    assert.equal(url.searchParams.get("redirect_uri"), "https://studio08.mn/api/social/facebook/callback");
    assert.equal(url.searchParams.get("code"), "the-code");
  });

  it("signs Graph calls with appsecret_proof", async () => {
    const { http, calls } = fakeHttp(() => ({ body: { data: [] } }));
    await createMetaApi(config, http).facebook.listPages("EAAB-user-token");
    const { url } = calls[0];
    assert.equal(url.pathname, "/v26.0/me/accounts");
    assert.equal(url.searchParams.get("appsecret_proof"), appSecretProof("EAAB-user-token", "fb-app-secret"));
  });

  it("posts the Instagram code exchange as a form", async () => {
    const { http, calls } = fakeHttp(() => ({ body: { data: [{ access_token: "IGQ-short", user_id: "1789", permissions: "instagram_business_basic" }] } }));
    const result = await createMetaApi(config, http).instagram.exchangeCode("ig-code");
    assert.equal(result.ok && result.value.userId, "1789");
    assert.equal(calls[0].url.toString(), "https://api.instagram.com/oauth/access_token");
    assert.equal(calls[0].init.method, "POST");
    const body = new URLSearchParams(String(calls[0].init.body));
    assert.equal(body.get("grant_type"), "authorization_code");
    assert.equal(body.get("redirect_uri"), "https://studio08.mn/api/social/instagram/callback");
  });

  it("asks for total_value account insights over the given window", async () => {
    const { http, calls } = fakeHttp(() => ({ body: { data: [{ name: "reach", period: "day", total_value: { value: 77 } }] } }));
    const since = new Date("2026-09-24T00:00:00Z");
    const until = new Date("2026-10-22T00:00:00Z");
    const result = await createMetaApi(config, http).instagram.accountInsight("1789", "IGQ-long", "reach", since, until);
    assert.deepEqual(result, { ok: true, value: 77 });
    const { url } = calls[0];
    assert.equal(url.origin + url.pathname, "https://graph.instagram.com/v26.0/1789/insights");
    assert.equal(url.searchParams.get("metric_type"), "total_value");
    assert.equal(url.searchParams.get("since"), String(since.getTime() / 1000));
  });

  it("maps an expired token and logs no secrets", async () => {
    const { http } = fakeHttp(() => ({
      status: 400,
      body: { error: { message: "Error validating access token: Session has expired", type: "OAuthException", code: 190, error_subcode: 463 } },
    }));
    const api = createMetaApi(config, http);
    const result = await api.facebook.getPage("111", "EAAB-page-token");
    assert.deepEqual(result, { ok: false, error: { kind: "token", code: 190, subcode: 463 } });
    await api.facebook.extendUserToken("EAAB-user-token");
    assert.ok(logged.length >= 2);
    for (const line of logged) {
      for (const secret of ["EAAB-page-token", "EAAB-user-token", "fb-app-secret", "appsecret_proof"]) {
        assert.equal(line.includes(secret), false, `log line leaks ${secret}: ${line}`);
      }
      assert.equal(line.includes("?"), false, `log line includes a query string: ${line}`);
    }
  });

  it("treats network failures and unexpected bodies as unavailable", async () => {
    const failing: Http = async () => {
      throw new TypeError("fetch failed");
    };
    assert.deepEqual(await createMetaApi(config, failing).instagram.profile("IGQ-long"), { ok: false, error: { kind: "unavailable" } });
    const { http } = fakeHttp(() => ({ body: { unexpected: true } }));
    assert.deepEqual(await createMetaApi(config, http).instagram.profile("IGQ-long"), { ok: false, error: { kind: "unavailable" } });
  });

  it("does nothing for a provider that isn't configured", async () => {
    const { http, calls } = fakeHttp(() => ({ body: {} }));
    const api = createMetaApi(readSocialConfig({}, false), http);
    assert.equal((await api.facebook.exchangeCode("x")).ok, false);
    assert.equal((await api.instagram.exchangeCode("x")).ok, false);
    assert.equal(calls.length, 0);
  });
});
