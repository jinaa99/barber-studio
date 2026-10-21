import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { allowedTransitions, canTransition, isActiveStatus } from "./status";

const start = new Date("2026-10-21T02:00:00Z");
const before = new Date("2026-10-21T01:00:00Z");
const after = new Date("2026-10-21T03:00:00Z");

describe("appointment status transitions", () => {
  it("allows confirming or cancelling a pending booking", () => {
    assert.deepEqual(allowedTransitions("PENDING", start, before), ["CONFIRMED", "CANCELLED"]);
  });

  it("only records completed / no-show once the appointment has started", () => {
    assert.deepEqual(allowedTransitions("CONFIRMED", start, before), ["CANCELLED"]);
    assert.deepEqual(allowedTransitions("CONFIRMED", start, after), ["COMPLETED", "NO_SHOW", "CANCELLED"]);
  });

  it("treats completed, cancelled and no-show as final", () => {
    for (const status of ["COMPLETED", "CANCELLED", "NO_SHOW"] as const) {
      assert.deepEqual(allowedTransitions(status, start, after), []);
    }
    assert.equal(canTransition("CANCELLED", "CONFIRMED", start, before), false);
  });

  it("never skips straight from pending to completed", () => {
    assert.equal(canTransition("PENDING", "COMPLETED", start, after), false);
  });

  it("counts only pending and confirmed as holding the barber's time", () => {
    assert.equal(isActiveStatus("PENDING"), true);
    assert.equal(isActiveStatus("CONFIRMED"), true);
    assert.equal(isActiveStatus("CANCELLED"), false);
  });
});
