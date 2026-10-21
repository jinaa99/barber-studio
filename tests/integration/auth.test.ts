import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { authenticate, createStaffUser, hasRole, MAX_FAILED_LOGINS } from "@/lib/server/accounts";
import { createTestClient, resetDatabase } from "./helpers";

const db = createTestClient();
after(() => db.$disconnect());

describe("staff authentication", () => {
  beforeEach(async () => {
    await resetDatabase(db);
    await createStaffUser(db, { email: "Owner@Studio.test", name: "Owner", password: "a long enough password", role: "ADMIN" });
  });

  it("signs in with the right password, case-insensitive email", async () => {
    const result = await authenticate(db, "owner@studio.test", "a long enough password");
    assert.ok(result.ok);
    assert.equal(result.user.role, "ADMIN");
  });

  it("gives the same answer for an unknown email and a wrong password", async () => {
    assert.deepEqual(await authenticate(db, "nobody@studio.test", "whatever"), { ok: false, reason: "invalid" });
    assert.deepEqual(await authenticate(db, "owner@studio.test", "wrong"), { ok: false, reason: "invalid" });
  });

  it("locks the account after repeated failures, even for the right password", async () => {
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) await authenticate(db, "owner@studio.test", "wrong");
    assert.deepEqual(await authenticate(db, "owner@studio.test", "wrong"), { ok: false, reason: "locked" });
    assert.deepEqual(await authenticate(db, "owner@studio.test", "a long enough password"), { ok: false, reason: "locked" });
    const later = new Date(Date.now() + 16 * 60_000);
    assert.ok((await authenticate(db, "owner@studio.test", "a long enough password", later)).ok);
  });

  it("refuses deactivated accounts and short passwords", async () => {
    await db.user.updateMany({ data: { active: false } });
    assert.deepEqual(await authenticate(db, "owner@studio.test", "a long enough password"), { ok: false, reason: "invalid" });
    await assert.rejects(createStaffUser(db, { email: "x@studio.test", name: "X", password: "short", role: "STAFF" }), /at least 12/);
  });

  it("treats ADMIN as a superset of STAFF, never the other way round", () => {
    assert.equal(hasRole({ role: "ADMIN" }, "STAFF"), true);
    assert.equal(hasRole({ role: "STAFF" }, "ADMIN"), false);
  });
});
