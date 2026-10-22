import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyMetaError,
  cleanCode,
  debugTokenResponse,
  facebookAuthorizeUrl,
  instagramAuthorizeUrl,
  instagramCodeResponse,
  instagramInsightResponse,
  instagramProfileResponse,
  missingScopes,
  pageInsightResponse,
  pagesResponse,
  parseOrigin,
  readSocialConfig,
} from "./meta";

/* Fixtures follow the response shapes in Meta's documentation (Graph API v26.0), trimmed to the fields used. */

const env = {
  NEXT_PUBLIC_SITE_URL: "https://studio08.mn",
  META_APP_ID: "1234567890",
  META_APP_SECRET: "fb-secret",
  INSTAGRAM_APP_ID: "9876543210",
  INSTAGRAM_APP_SECRET: "ig-secret",
};

describe("social configuration", () => {
  it("derives the redirect URIs from the configured origin", () => {
    const config = readSocialConfig(env, true);
    assert.equal(config.facebook?.redirectUri, "https://studio08.mn/api/social/facebook/callback");
    assert.equal(config.instagram?.redirectUri, "https://studio08.mn/api/social/instagram/callback");
    assert.equal(config.graphVersion, "v26.0");
    assert.deepEqual(config.missing, { facebook: [], instagram: [] });
  });

  it("names what is missing and stays unconfigured", () => {
    const config = readSocialConfig({ NEXT_PUBLIC_SITE_URL: "https://studio08.mn", META_APP_ID: "123" }, false);
    assert.equal(config.facebook, null);
    assert.equal(config.instagram, null);
    assert.deepEqual(config.missing.facebook, ["META_APP_ID", "META_APP_SECRET", "SOCIAL_TOKEN_KEY"]);
    assert.ok(config.missing.instagram.includes("INSTAGRAM_APP_ID"));
  });

  it("only accepts a bare https origin (http on localhost)", () => {
    assert.equal(parseOrigin("https://studio08.mn/"), "https://studio08.mn");
    assert.equal(parseOrigin("http://localhost:3000"), "http://localhost:3000");
    assert.equal(parseOrigin("http://studio08.mn"), null);
    assert.equal(parseOrigin("https://studio08.mn/app"), null);
    assert.equal(parseOrigin("https://studio08.mn/?x=1"), null);
    assert.equal(parseOrigin("javascript:alert(1)"), null);
    assert.equal(parseOrigin(undefined), null);
  });

  it("ignores a malformed Graph API version", () => {
    assert.equal(readSocialConfig({ ...env, META_GRAPH_VERSION: "v25.0" }, true).graphVersion, "v25.0");
    assert.equal(readSocialConfig({ ...env, META_GRAPH_VERSION: "../evil" }, true).graphVersion, "v26.0");
  });
});

describe("authorization URLs", () => {
  const config = readSocialConfig(env, true);

  it("builds the Facebook Login dialog with the state and only the needed scopes", () => {
    const url = new URL(facebookAuthorizeUrl(config.facebook!, config.graphVersion, "state-123"));
    assert.equal(url.origin + url.pathname, "https://www.facebook.com/v26.0/dialog/oauth");
    assert.equal(url.searchParams.get("client_id"), "1234567890");
    assert.equal(url.searchParams.get("redirect_uri"), "https://studio08.mn/api/social/facebook/callback");
    assert.equal(url.searchParams.get("state"), "state-123");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.deepEqual(url.searchParams.get("scope")?.split(","), ["pages_show_list", "pages_read_engagement", "read_insights"]);
    assert.equal(url.searchParams.has("client_secret"), false);
  });

  it("uses a Facebook Login for Business configuration instead of scope when set", () => {
    const withConfig = readSocialConfig({ ...env, META_LOGIN_CONFIG_ID: "555000111" }, true);
    const url = new URL(facebookAuthorizeUrl(withConfig.facebook!, withConfig.graphVersion, "s"));
    assert.equal(url.searchParams.get("config_id"), "555000111");
    assert.equal(url.searchParams.has("scope"), false);
  });

  it("builds the Business Login for Instagram window", () => {
    const url = new URL(instagramAuthorizeUrl(config.instagram!, "state-456"));
    assert.equal(url.origin + url.pathname, "https://www.instagram.com/oauth/authorize");
    assert.equal(url.searchParams.get("client_id"), "9876543210");
    assert.equal(url.searchParams.get("state"), "state-456");
    assert.deepEqual(url.searchParams.get("scope")?.split(","), ["instagram_business_basic", "instagram_business_manage_insights"]);
    assert.equal(url.toString().includes("ig-secret"), false);
  });

  it("strips Instagram's #_ suffix from the code", () => {
    assert.equal(cleanCode("AQBx#_"), "AQBx");
    assert.equal(cleanCode("AQBx"), "AQBx");
  });

  it("reports missing scopes", () => {
    assert.deepEqual(missingScopes("facebook", ["pages_show_list"], "required"), ["pages_read_engagement"]);
    assert.deepEqual(missingScopes("instagram", ["instagram_business_basic"], "optional"), ["instagram_business_manage_insights"]);
  });
});

describe("Meta errors", () => {
  const err = (code: number, subcode?: number) => ({ error: { message: "x", type: "OAuthException", code, error_subcode: subcode, fbtrace_id: "A" } });

  it("classifies documented error codes", () => {
    assert.deepEqual(classifyMetaError(400, err(190, 463)), { kind: "token", code: 190, subcode: 463 });
    assert.equal(classifyMetaError(400, err(190, 460)).kind, "token");
    assert.equal(classifyMetaError(403, err(10)).kind, "permission");
    assert.equal(classifyMetaError(400, err(200)).kind, "permission");
    assert.equal(classifyMetaError(400, err(4)).kind, "rate_limited");
    assert.equal(classifyMetaError(400, err(613)).kind, "rate_limited");
    assert.equal(classifyMetaError(400, err(100)).kind, "invalid_request");
    assert.equal(classifyMetaError(500, err(2)).kind, "unavailable");
    assert.equal(classifyMetaError(502, null).kind, "unavailable");
    assert.equal(classifyMetaError(429, null).kind, "rate_limited");
  });

  it("reads the Instagram OAuth endpoints' flat error shape", () => {
    assert.equal(classifyMetaError(400, { error_type: "OAuthException", code: 400, error_message: "Invalid code" }).kind, "invalid_request");
  });
});

describe("Meta responses", () => {
  it("reads the Instagram code exchange in both documented shapes", () => {
    const wrapped = instagramCodeResponse.parse({ data: [{ access_token: "IGQ-short", user_id: "1789", permissions: "instagram_business_basic,instagram_business_manage_insights" }] });
    assert.deepEqual(wrapped, { accessToken: "IGQ-short", userId: "1789", permissions: ["instagram_business_basic", "instagram_business_manage_insights"] });
    const flat = instagramCodeResponse.parse({ access_token: "IGQ-short", user_id: 1789, permissions: ["instagram_business_basic"] });
    assert.equal(flat.userId, "1789");
    assert.deepEqual(flat.permissions, ["instagram_business_basic"]);
  });

  it("reads debug_token, with 0 meaning no expiry", () => {
    const info = debugTokenResponse.parse({
      data: { app_id: "1234567890", type: "PAGE", is_valid: true, expires_at: 0, data_access_expires_at: 1798000000, scopes: ["pages_show_list"], user_id: "42" },
    });
    assert.equal(info.expiresAt, null);
    assert.equal(info.dataAccessExpiresAt?.toISOString(), new Date(1798000000 * 1000).toISOString());
    assert.equal(info.appId, "1234567890");
  });

  it("reads the Page list", () => {
    const pages = pagesResponse.parse({ data: [{ id: "111", name: "STUDIO / 08", category: "Barber Shop", access_token: "EAAB-page", tasks: ["ANALYZE", "MODERATE"] }], paging: {} });
    assert.deepEqual(pages, [{ id: "111", name: "STUDIO / 08", category: "Barber Shop", accessToken: "EAAB-page", tasks: ["ANALYZE", "MODERATE"] }]);
  });

  it("reads the Instagram profile and upper-cases the account type", () => {
    const profile = instagramProfileResponse.parse({ id: "app-scoped", user_id: "1789", username: "studio08", account_type: "Business", followers_count: 1200, media_count: 85 });
    assert.equal(profile.accountId, "1789");
    assert.equal(profile.accountType, "BUSINESS");
    assert.equal(profile.followers, 1200);
    assert.equal(profile.follows, null);
  });

  it("returns null, not 0, when insights have no data", () => {
    assert.equal(pageInsightResponse.parse({ data: [] }), null);
    assert.equal(pageInsightResponse.parse({ data: [{ name: "page_media_view", values: [{ value: 10 }, { value: 42, end_time: "2026-10-21T07:00:00+0000" }] }] }), 42);
    assert.equal(instagramInsightResponse.parse({ data: [] }), null);
    assert.equal(instagramInsightResponse.parse({ data: [{ name: "reach", period: "day", total_value: { value: 310 } }] }), 310);
  });
});
