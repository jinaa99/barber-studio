import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("correct horse battery staple");
    assert.match(hash, /^scrypt\$32768\$8\$1\$/);
    assert.equal(await verifyPassword("correct horse battery staple", hash), true);
    assert.equal(await verifyPassword("correct horse battery stapl", hash), false);
  });

  it("salts every hash", async () => {
    assert.notEqual(await hashPassword("same password!"), await hashPassword("same password!"));
  });

  it("rejects malformed stored hashes", async () => {
    assert.equal(await verifyPassword("anything", "plain-text"), false);
  });
});
