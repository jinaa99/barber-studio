import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { appSecretProof, hashState, hasTokenKey, newState, openSecret, sealSecret, verifySignedRequest } from "./social-crypto";

const original = process.env.SOCIAL_TOKEN_KEY;
beforeEach(() => {
  process.env.SOCIAL_TOKEN_KEY = randomBytes(32).toString("base64");
});
afterEach(() => {
  if (original === undefined) delete process.env.SOCIAL_TOKEN_KEY;
  else process.env.SOCIAL_TOKEN_KEY = original;
});

describe("token encryption", () => {
  it("round-trips and never contains the plaintext", () => {
    const sealed = sealSecret("EAAB-secret-token", "token:FACEBOOK");
    assert.equal(sealed.includes("EAAB-secret-token"), false);
    assert.equal(openSecret(sealed, "token:FACEBOOK"), "EAAB-secret-token");
    assert.notEqual(sealSecret("EAAB-secret-token", "token:FACEBOOK"), sealed, "fresh IV each time");
  });

  it("refuses another context, a tampered value or another key", () => {
    const sealed = sealSecret("EAAB-secret-token", "token:FACEBOOK");
    assert.equal(openSecret(sealed, "token:INSTAGRAM"), null);
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    assert.equal(openSecret(parts.join("."), "token:FACEBOOK"), null);
    process.env.SOCIAL_TOKEN_KEY = randomBytes(32).toString("base64");
    assert.equal(openSecret(sealed, "token:FACEBOOK"), null);
  });

  it("requires a 32-byte key", () => {
    process.env.SOCIAL_TOKEN_KEY = Buffer.from("too short").toString("base64");
    assert.equal(hasTokenKey(), false);
    assert.throws(() => sealSecret("x", "token:FACEBOOK"));
    delete process.env.SOCIAL_TOKEN_KEY;
    assert.equal(hasTokenKey(), false);
  });
});

describe("OAuth state and request signing", () => {
  it("stores only a hash of the state", () => {
    const { state, hash } = newState();
    assert.ok(state.length >= 43);
    assert.equal(hash, hashState(state));
    assert.notEqual(hash, state);
  });

  it("computes appsecret_proof as HMAC-SHA256(token, secret)", () => {
    assert.equal(appSecretProof("token", "secret"), createHmac("sha256", "secret").update("token").digest("hex"));
  });

  it("verifies a signed_request and rejects a forged one", () => {
    const payload = Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "42", issued_at: 1 })).toString("base64url");
    const signature = createHmac("sha256", "app-secret").update(payload).digest("base64url");
    assert.deepEqual(verifySignedRequest(`${signature}.${payload}`, "app-secret")?.user_id, "42");
    assert.equal(verifySignedRequest(`${signature}.${payload}`, "other-secret"), null);
    const forged = Buffer.from(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "43" })).toString("base64url");
    assert.equal(verifySignedRequest(`${signature}.${forged}`, "app-secret"), null);
    const none = Buffer.from(JSON.stringify({ algorithm: "none", user_id: "42" })).toString("base64url");
    assert.equal(verifySignedRequest(`${createHmac("sha256", "app-secret").update(none).digest("base64url")}.${none}`, "app-secret"), null);
    assert.equal(verifySignedRequest("garbage", "app-secret"), null);
  });
});
