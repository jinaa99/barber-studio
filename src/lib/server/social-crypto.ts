import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/*
 * Encryption for the Meta access tokens kept in `social_connections`:
 * AES-256-GCM with a random 96-bit IV per value, keyed by SOCIAL_TOKEN_KEY
 * (32 random bytes, base64). The provider and purpose are bound in as
 * associated data, so a ciphertext copied into another row or column fails to
 * decrypt. Plaintext tokens only ever exist in server memory.
 *
 *   openssl rand -base64 32
 */

const VERSION = "v1";

function key(): Buffer | null {
  const value = process.env.SOCIAL_TOKEN_KEY?.trim();
  if (!value) return null;
  const bytes = Buffer.from(value, "base64");
  return bytes.length === 32 ? bytes : null;
}

export function hasTokenKey(): boolean {
  return key() !== null;
}

/** Encrypt `plaintext` for `context` (e.g. "token:FACEBOOK"). Throws without a valid key. */
export function sealSecret(plaintext: string, context: string): string {
  const k = key();
  if (!k) throw new Error("SOCIAL_TOKEN_KEY is missing or not 32 bytes of base64.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  cipher.setAAD(Buffer.from(context));
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

/** Decrypt a value from `sealSecret`, or null if the key changed, the context differs or it was tampered with. */
export function openSecret(sealed: string, context: string): string | null {
  const k = key();
  const [version, iv, tag, body] = sealed.split(".");
  if (!k || version !== VERSION || !iv || !tag || body === undefined) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** A new OAuth state value (sent to Meta) and the hash that is stored. */
export function newState(): { state: string; hash: string } {
  const state = randomBytes(32).toString("base64url");
  return { state, hash: hashState(state) };
}

export function hashState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

/** `appsecret_proof` for Graph API calls: HMAC-SHA256 of the access token keyed by the app secret. */
export function appSecretProof(accessToken: string, appSecret: string): string {
  return createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

/**
 * Verify a Meta `signed_request` (deauthorize callbacks): base64url signature
 * and payload joined by a dot, HMAC-SHA256 of the payload with the app secret.
 * Returns the payload, or null when the signature or algorithm is wrong.
 */
export function verifySignedRequest(signedRequest: string, appSecret: string): Record<string, unknown> | null {
  const [signature, payload] = signedRequest.split(".");
  if (!signature || !payload || signedRequest.split(".").length !== 2) return null;
  const expected = createHmac("sha256", appSecret).update(payload).digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    if (!data || typeof data !== "object") return null;
    const algorithm = (data as { algorithm?: unknown }).algorithm;
    if (typeof algorithm !== "string" || algorithm.toUpperCase() !== "HMAC-SHA256") return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}
