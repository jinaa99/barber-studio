import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appointmentScope, can, canAccessBarber } from "./permissions";

describe("dashboard permissions", () => {
  it("gives admins everything", () => {
    for (const p of ["finance.view", "catalog.manage", "staff.manage", "settings.manage", "media.manage", "social.manage", "audit.view", "customers.view"] as const) {
      assert.equal(can({ role: "ADMIN" }, p), true, p);
    }
  });

  it("keeps front desk away from money and configuration", () => {
    const staff = { role: "STAFF" } as const;
    assert.equal(can(staff, "appointments.manage"), true);
    assert.equal(can(staff, "customers.view"), true);
    for (const p of ["finance.view", "catalog.manage", "staff.manage", "settings.manage", "media.manage", "social.manage", "audit.view"] as const) {
      assert.equal(can(staff, p), false, p);
    }
  });

  it("limits a barber login to their own appointments", () => {
    const barber = { role: "BARBER", barberId: "enkhjin" } as const;
    assert.equal(can(barber, "appointments.updateStatus"), true);
    for (const p of ["appointments.viewAll", "appointments.manage", "customers.view", "finance.view", "media.manage", "social.manage"] as const) {
      assert.equal(can(barber, p), false, p);
    }
    assert.equal(appointmentScope(barber), "enkhjin");
    assert.equal(canAccessBarber(barber, "enkhjin"), true);
    assert.equal(canAccessBarber(barber, "temuulen"), false);
  });

  it("gives an unlinked barber login no appointments at all", () => {
    assert.equal(appointmentScope({ role: "BARBER", barberId: null }), null);
    assert.equal(canAccessBarber({ role: "BARBER", barberId: null }, "enkhjin"), false);
  });

  it("lets everyone else see every barber", () => {
    assert.equal(appointmentScope({ role: "STAFF", barberId: null }), "all");
    assert.equal(appointmentScope({ role: "ADMIN", barberId: "enkhjin" }), "all");
  });
});
