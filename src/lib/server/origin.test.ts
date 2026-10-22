import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSameOrigin } from "./origin";

const headers = (values: Record<string, string>) => new Headers(values);

describe("same-origin check", () => {
  it("accepts this site and rejects others", () => {
    assert.equal(isSameOrigin(headers({ host: "studio.mn", origin: "https://studio.mn" })), true);
    assert.equal(isSameOrigin(headers({ host: "studio.mn", origin: "https://evil.example" })), false);
    assert.equal(isSameOrigin(headers({ host: "studio.mn", origin: "https://studio.mn.evil.example" })), false);
  });

  it("prefers the proxy's forwarded host", () => {
    const behindProxy = { host: "127.0.0.1:3000", "x-forwarded-host": "studio.mn", origin: "https://studio.mn" };
    assert.equal(isSameOrigin(headers(behindProxy)), true);
  });

  it("never throws on an opaque or malformed Origin", () => {
    assert.equal(isSameOrigin(headers({ host: "studio.mn", origin: "null" })), false);
    assert.equal(isSameOrigin(headers({ host: "studio.mn", origin: "not a url" })), false);
  });

  it("allows a missing Origin only when asked to", () => {
    assert.equal(isSameOrigin(headers({ host: "studio.mn" })), false);
    assert.equal(isSameOrigin(headers({ host: "studio.mn" }), { allowMissing: true }), true);
  });
});
