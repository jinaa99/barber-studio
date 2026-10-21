import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createBooking, getAvailability } from "@/lib/server/booking";
import {
  changeAppointmentStatus,
  createStaffAppointment,
  getAppointmentDetail,
  listAppointmentsPage,
  rescheduleAppointment,
  staffSlots,
} from "@/lib/server/appointments";
import { addTimeOff, deleteCategory, replaceWorkingHours, saveCategory, saveService } from "@/lib/server/catalog";
import { getMetrics } from "@/lib/server/metrics";
import { createAccount, updateAccount } from "@/lib/server/staff";
import { readSiteContent, saveSiteContent } from "@/lib/server/content";
import { listCustomers } from "@/lib/server/customers";
import { createStaffUser } from "@/lib/server/accounts";
import type { StaffAppointmentInput } from "@/lib/admin/schemas";
import { createTestClient, DATE, NOW, request, resetDatabase, seedFixtures, ubTime } from "./helpers";

const db = createTestClient();
after(() => db.$disconnect());

let actorId = "";

async function setup(settings: Parameters<typeof seedFixtures>[1] = {}) {
  await resetDatabase(db);
  await seedFixtures(db, settings);
  actorId = (await createStaffUser(db, { email: "desk@studio.test", name: "Desk", password: "a long enough password", role: "STAFF" })).id;
}

let phoneCounter = 0;
function staffInput(overrides: Partial<Omit<StaffAppointmentInput, "customer">> & { customer?: Partial<StaffAppointmentInput["customer"]> } = {}) {
  phoneCounter += 1;
  return {
    serviceId: "cut",
    barberId: "a",
    date: DATE,
    time: "10:00",
    status: "CONFIRMED" as const,
    notify: false,
    actorId,
    locale: "en",
    ...overrides,
    customer: { name: "Walk In", phone: `9900${String(1000 + phoneCounter).slice(-4)}`, email: "", notes: "", ...overrides.customer },
  };
}

const staffBook = (overrides: Parameters<typeof staffInput>[0] = {}, now = NOW) =>
  createStaffAppointment(db, staffInput(overrides), { now, emailProvider: null });

describe("staff-created appointments", () => {
  beforeEach(() => setup());

  it("saves an ADMIN-source appointment with an audit entry", async () => {
    const result = await staffBook({ status: "PENDING", customer: { name: "Saraa", notes: "Phone booking" } });
    assert.ok(result.ok, JSON.stringify(result));
    const row = await db.appointment.findUniqueOrThrow({ where: { id: result.appointmentId } });
    assert.equal(row.source, "ADMIN");
    assert.equal(row.status, "PENDING");
    assert.equal(row.startsAt.toISOString(), ubTime("10:00").toISOString());
    assert.equal(row.priceMnt, 50_000);
    const log = await db.auditLog.findFirstOrThrow({ where: { entityId: row.id } });
    assert.equal(log.action, "appointment.created");
    assert.equal(log.actorId, actorId);
  });

  it("refuses overlaps, working-hour breaks, time off and the past", async () => {
    assert.ok((await staffBook()).ok);
    assert.deepEqual(await staffBook({ time: "10:30" }), { ok: false, error: "slot_taken" });
    // 13:00–14:00 crosses the 13:30 break.
    assert.deepEqual(await staffBook({ time: "13:00" }), { ok: false, error: "outside_hours" });
    // Monday is a day off.
    assert.deepEqual(await staffBook({ date: "2026-11-02", time: "11:00" }), { ok: false, error: "outside_hours" });
    await db.timeOff.create({ data: { barberId: "a", startsAt: ubTime("15:00"), endsAt: ubTime("17:00") } });
    assert.deepEqual(await staffBook({ time: "16:00" }), { ok: false, error: "time_off" });
    assert.deepEqual(await staffBook({ time: "10:00" }, new Date(ubTime("11:00").getTime())), { ok: false, error: "in_past" });
  });

  it("ignores the online notice and horizon but not the catalogue", async () => {
    // 30 days ahead is beyond the 14-day online horizon.
    assert.ok((await staffBook({ date: "2026-12-01" })).ok);
    assert.deepEqual(await staffBook({ serviceId: "retired" }), { ok: false, error: "not_active" });
    assert.deepEqual(await staffBook({ barberId: "c" }), { ok: false, error: "barber_unavailable" });
  });

  it("lets only one of two simultaneous bookings take a slot", async () => {
    const results = await Promise.all([staffBook(), staffBook(), createBooking(db, request({ time: "10:00" }), { now: NOW, emailProvider: null })]);
    assert.equal(results.filter((r) => r.ok).length, 1, JSON.stringify(results));
    assert.equal(await db.appointment.count({ where: { barberId: "a", status: "CONFIRMED" } }), 1);
  });

  it("offers staff the free grid times, with an appointment's own slot freed while moving it", async () => {
    const booked = await staffBook({ time: "11:00" });
    assert.ok(booked.ok);
    const slots = await staffSlots(db, { serviceId: "cut", barberId: "a", date: DATE }, NOW);
    assert.equal(slots.find((s) => s.time === "11:00")?.available, false);
    const moving = await staffSlots(db, { serviceId: "cut", barberId: "a", date: DATE, excludeAppointmentId: booked.appointmentId }, NOW);
    assert.equal(moving.find((s) => s.time === "11:00")?.available, true);
  });
});

describe("rescheduling", () => {
  beforeEach(() => setup());

  it("moves an appointment and releases its old time", async () => {
    const booked = await staffBook();
    assert.ok(booked.ok);
    const moved = await rescheduleAppointment(
      db,
      { appointmentId: booked.appointmentId, barberId: "b", date: DATE, time: "15:00", notify: false, actorId, scope: "all" },
      { now: NOW, emailProvider: null },
    );
    assert.ok(moved.ok, JSON.stringify(moved));
    const row = await db.appointment.findUniqueOrThrow({ where: { id: booked.appointmentId } });
    assert.equal(row.barberId, "b");
    assert.equal(row.startsAt.toISOString(), ubTime("15:00").toISOString());
    const free = await getAvailability(db, { date: DATE, serviceId: "cut", barberId: "a" }, NOW);
    assert.equal(free?.find((s) => s.time === "10:00")?.available, true);
    assert.equal((await db.auditLog.findFirstOrThrow({ where: { entityId: row.id, action: "appointment.rescheduled" } })).actorId, actorId);
  });

  it("can shift into its own old time but never onto someone else's", async () => {
    const first = await staffBook({ time: "10:00" });
    const second = await staffBook({ time: "11:00" });
    assert.ok(first.ok && second.ok);
    const shift = (id: string, time: string) =>
      rescheduleAppointment(db, { appointmentId: id, barberId: "a", date: DATE, time, notify: false, actorId, scope: "all" }, { now: NOW, emailProvider: null });
    assert.ok((await shift(first.appointmentId, "10:30")).ok === false, "10:30–11:30 overlaps the 11:00 booking");
    assert.deepEqual(await shift(second.appointmentId, "10:30"), { ok: false, error: "slot_taken" });
    assert.ok((await shift(second.appointmentId, "11:30")).ok, "overlapping its own previous time is fine");
  });

  it("refuses final appointments and other barbers' appointments for a barber login", async () => {
    const booked = await staffBook();
    assert.ok(booked.ok);
    const asBarber = await rescheduleAppointment(
      db,
      { appointmentId: booked.appointmentId, barberId: "a", date: DATE, time: "15:00", notify: false, actorId, scope: "b" },
      { now: NOW, emailProvider: null },
    );
    assert.deepEqual(asBarber, { ok: false, error: "not_found" });

    await changeAppointmentStatus(db, { appointmentId: booked.appointmentId, to: "CANCELLED", actorId }, NOW);
    const cancelled = await rescheduleAppointment(
      db,
      { appointmentId: booked.appointmentId, barberId: "a", date: DATE, time: "15:00", notify: false, actorId, scope: "all" },
      { now: NOW, emailProvider: null },
    );
    assert.deepEqual(cancelled, { ok: false, error: "invalid_transition" });
  });
});

describe("barber-scoped access", () => {
  beforeEach(() => setup());

  it("hides other barbers' appointments and refuses their status changes", async () => {
    const theirs = await staffBook({ barberId: "b" });
    assert.ok(theirs.ok);
    assert.equal(await getAppointmentDetail(db, theirs.appointmentId, "a", false), null);
    assert.equal((await listAppointmentsPage(db, { scope: "a", includeDemo: true }, 1)).total, 0);
    assert.equal((await listAppointmentsPage(db, { scope: null, includeDemo: true }, 1)).total, 0, "no linked barber, no rows");
    assert.deepEqual(
      await changeAppointmentStatus(db, { appointmentId: theirs.appointmentId, to: "CANCELLED", actorId, scope: "a" }, NOW),
      { ok: false, error: "not_found" },
    );
    assert.equal((await db.appointment.findUniqueOrThrow({ where: { id: theirs.appointmentId } })).status, "CONFIRMED");
  });

  it("leaves contact details out unless the caller may see customers", async () => {
    const booked = await staffBook({ customer: { email: "guest@example.test" } });
    assert.ok(booked.ok);
    const limited = await getAppointmentDetail(db, booked.appointmentId, "a", false);
    assert.equal(limited?.customer.phone, null);
    assert.equal(limited?.customerEmail, null);
    const full = await getAppointmentDetail(db, booked.appointmentId, "all", true);
    assert.match(full?.customer.phone ?? "", /^9900/);
  });
});

describe("metrics from real records", () => {
  beforeEach(() => setup());

  it("counts only completed, non-demo appointments as revenue", async () => {
    const past = new Date("2026-11-04T00:00:00Z");
    const ids: string[] = [];
    for (const time of ["10:00", "11:00", "12:00", "14:00"]) {
      const r = await staffBook({ time });
      assert.ok(r.ok);
      ids.push(r.appointmentId);
    }
    await changeAppointmentStatus(db, { appointmentId: ids[0], to: "COMPLETED", actorId }, past);
    await changeAppointmentStatus(db, { appointmentId: ids[1], to: "NO_SHOW", actorId }, past);
    await changeAppointmentStatus(db, { appointmentId: ids[2], to: "CANCELLED", actorId }, past);
    // ids[3] stays CONFIRMED: scheduled value, not revenue.
    await db.appointment.update({ where: { id: ids[3] }, data: { priceMnt: 70_000 } });

    const customer = await db.customer.create({ data: { phone: "97600000999", name: "Demo", isDemo: true } });
    await db.appointment.create({
      data: {
        reference: "DEMO-00001",
        serviceId: "cut",
        barberId: "b",
        customerId: customer.id,
        startsAt: ubTime("10:00"),
        endsAt: ubTime("11:00"),
        status: "COMPLETED",
        source: "DEMO_SEED",
        isDemo: true,
        priceMnt: 999_000,
        durationMinutes: 60,
        customerName: "Demo",
      },
    });

    const range = { from: DATE, to: DATE };
    const real = await getMetrics(db, range, { includeDemo: false, scope: "all" });
    assert.equal(real.totals.completedRevenue, 50_000);
    assert.equal(real.totals.scheduledValue, 70_000);
    assert.equal(real.totals.byStatus.CANCELLED, 1);
    assert.equal(real.totals.noShowRate, 0.5);
    const a = real.barbers.find((b) => b.barberId === "a")!;
    // Tuesday hours: 10:00–13:30 + 14:00–18:00 = 450 minutes; 3 × 60 minutes held the chair.
    assert.equal(a.scheduledMinutes, 450);
    assert.equal(a.bookedMinutes, 180);

    const withDemo = await getMetrics(db, range, { includeDemo: true, scope: "all" });
    assert.equal(withDemo.totals.completedRevenue, 50_000 + 999_000);
    const scoped = await getMetrics(db, range, { includeDemo: true, scope: "b" });
    assert.equal(scoped.totals.appointments, 1);
  });
});

describe("catalogue management", () => {
  beforeEach(() => setup());

  const service = {
    id: "hot-towel",
    categoryId: "haircut",
    name: { mn: "Халуун алчуур", en: "Hot towel" },
    summary: { mn: "Тайлбар", en: "Summary" },
    includes: { mn: ["Алчуур"], en: ["Towel"] },
    durationMinutes: 30,
    priceMnt: 30_000,
    featured: false,
    active: true,
    sortOrder: 5,
    barberIds: ["b"],
  };

  it("creates a service bookable only with its eligible barbers", async () => {
    assert.deepEqual(await saveService(db, service, actorId, "create"), { ok: true, value: null });
    assert.deepEqual(await saveService(db, service, actorId, "create"), { ok: false, error: "taken" });
    assert.equal((await getAvailability(db, { date: DATE, serviceId: "hot-towel", barberId: "a" }, NOW))?.length, 0);
    assert.ok(((await getAvailability(db, { date: DATE, serviceId: "hot-towel", barberId: "b" }, NOW)) ?? []).length > 0);

    await saveService(db, { ...service, priceMnt: 35_000, barberIds: ["a"] }, actorId, "update");
    const links = await db.barberService.findMany({ where: { serviceId: "hot-towel" } });
    assert.deepEqual(links.map((l) => l.barberId), ["a"]);
    assert.equal(await db.auditLog.count({ where: { entityId: "hot-towel" } }), 2);
  });

  it("keeps the booked price when the list price changes", async () => {
    const booked = await staffBook();
    assert.ok(booked.ok);
    await db.service.update({ where: { id: "cut" }, data: { priceMnt: 99_000 } });
    assert.equal((await db.appointment.findUniqueOrThrow({ where: { id: booked.appointmentId } })).priceMnt, 50_000);
  });

  it("deletes only empty categories", async () => {
    assert.deepEqual(await deleteCategory(db, "haircut", actorId), { ok: false, error: "in_use" });
    await saveCategory(db, { id: "colour", name: { mn: "Будаг", en: "Colour" }, sortOrder: 3 }, actorId, "create");
    assert.deepEqual(await deleteCategory(db, "colour", actorId), { ok: true, value: null });
  });

  it("applies new working hours to availability and reports stranded bookings", async () => {
    const booked = await staffBook({ time: "16:00" });
    assert.ok(booked.ok);
    const result = await replaceWorkingHours(db, "a", [{ weekday: 2, startMinute: 600, endMinute: 900 }], actorId, NOW);
    assert.deepEqual(result, { ok: true, value: { outside: 1 } });
    const slots = await getAvailability(db, { date: DATE, serviceId: "cut", barberId: "a" }, NOW);
    assert.equal(slots?.some((s) => s.time === "16:00"), false);
  });

  it("blocks time off in availability and counts the bookings it overlaps", async () => {
    const booked = await staffBook({ time: "10:00" });
    assert.ok(booked.ok);
    const result = await addTimeOff(
      db,
      { barberId: "studio", startDate: DATE, endDate: DATE, allDay: true, startTime: "", endTime: "", reason: "Holiday" },
      actorId,
    );
    assert.deepEqual(result, { ok: true, value: { affected: 1 } });
    const slots = await getAvailability(db, { date: DATE, serviceId: "cut", barberId: "b" }, NOW);
    assert.equal(slots?.some((s) => s.available), false);
  });
});

describe("staff accounts", () => {
  beforeEach(() => setup());

  it("never removes the last active admin, and nobody changes their own access", async () => {
    const owner = await createStaffUser(db, { email: "owner@studio.test", name: "Owner", password: "a long enough password", role: "ADMIN" });
    assert.deepEqual(await updateAccount(db, { userId: owner.id, role: "STAFF", active: true, barberId: "" }, actorId), { ok: false, error: "last_admin" });
    assert.deepEqual(await updateAccount(db, { userId: owner.id, role: "ADMIN", active: false, barberId: "" }, owner.id), { ok: false, error: "self_change" });
  });

  it("requires a barber profile for the barber role and ends sessions on deactivation", async () => {
    assert.deepEqual(
      await createAccount(db, { name: "B", email: "b@studio.test", role: "BARBER", password: "a long enough password", barberId: "" }, actorId),
      { ok: false, error: "barber_required" },
    );
    const created = await createAccount(db, { name: "B", email: "b@studio.test", role: "BARBER", password: "a long enough password", barberId: "b" }, actorId);
    assert.ok(created.ok);
    assert.equal((await db.barber.findUniqueOrThrow({ where: { id: "b" } })).userId, created.userId);
    assert.deepEqual(
      await createAccount(db, { name: "C", email: "c@studio.test", role: "BARBER", password: "a long enough password", barberId: "b" }, actorId),
      { ok: false, error: "barber_taken" },
    );

    await db.session.create({ data: { userId: created.userId, tokenHash: "x".repeat(64), expiresAt: new Date(Date.now() + 60_000) } });
    assert.ok((await updateAccount(db, { userId: created.userId, role: "BARBER", active: false, barberId: "b" }, actorId)).ok);
    assert.equal(await db.session.count({ where: { userId: created.userId } }), 0);
  });
});

describe("website content and customers", () => {
  beforeEach(() => setup());

  it("stores the studio profile and reads defaults before anything is saved", async () => {
    const initial = await readSiteContent(db);
    assert.equal(initial.profile.isDemo, true);
    await saveSiteContent(db, "profile", { ...initial.profile, name: "Chair & Co", isDemo: false }, actorId);
    const saved = await readSiteContent(db);
    assert.equal(saved.profile.name, "Chair & Co");
    assert.equal(saved.profile.isDemo, false);
    assert.equal(await db.auditLog.count({ where: { action: "content.profile_updated" } }), 1);
  });

  it("finds customers by phone digits and filters returning guests", async () => {
    const first = await staffBook({ customer: { phone: "+976 8811 2233", name: "Bat" } });
    const second = await staffBook({ time: "15:00", customer: { phone: "97688112233", name: "Bat" } });
    assert.ok(first.ok && second.ok);
    const later = new Date("2026-11-04T00:00:00Z");
    for (const r of [first, second]) await changeAppointmentStatus(db, { appointmentId: r.appointmentId, to: "COMPLETED", actorId }, later);
    await staffBook({ time: "11:00", customer: { name: "Other" } });

    const byPhone = await listCustomers(db, { q: "8811 22", filter: "all", includeDemo: false, page: 1 }, NOW);
    assert.deepEqual(byPhone.rows.map((r) => [r.name, r.completed]), [["Bat", 2]]);
    const returning = await listCustomers(db, { filter: "returning", includeDemo: false, page: 1 }, NOW);
    assert.deepEqual(returning.rows.map((r) => r.name), ["Bat"]);
  });
});
