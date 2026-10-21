import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { invalidCustomerFields, normalizePhone } from "./validation";

const valid = { name: "Bat", phone: "8800 1234", email: "", notes: "" };

describe("customer validation", () => {
  it("accepts the minimum required details", () => {
    assert.deepEqual(invalidCustomerFields(valid), []);
  });

  it("normalizes phone numbers to digits", () => {
    assert.equal(normalizePhone("+976 (88) 00-1234"), "97688001234");
  });

  it("rejects short names, bad phones, malformed emails and long notes", () => {
    assert.deepEqual(invalidCustomerFields({ name: " B ", phone: "123", email: "nope@", notes: "x".repeat(501) }), [
      "name",
      "phone",
      "email",
      "notes",
    ]);
  });
});
