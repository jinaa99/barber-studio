import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createBooking, getAvailability } from "@/lib/server/booking";
import { changeAppointmentStatus } from "@/lib/server/appointments";
import type { EmailProvider } from "@/lib/server/notifications";
import { createTestClient, DATE, NOW, request, resetDatabase, seedFixtures, ubTime } from "./helpers";

const db = createTestClient();
after(() => db.$disconnect());

const book = (overrides: Parameters<typeof request>[0] = {}, now = NOW) =>
  createBooking(db, request(overrides), { now, emailProvider: null });

describe("booking persistence", () => {
  beforeEach(async () => {
    await resetDatabase(db);
    await seedFixtures(db);
  });

  it("stores the appointment in PostgreSQL and returns a reference", async () => {
    const result = await book({ customer: { name: "Saraa", phone: "+976 8811 2233", notes: "Short on the sides" } });
    assert.ok(result.ok, JSON.stringify(result));
    assert.match(result.booking.reference, /^S08-[2-9A-Z]{6}$/);
    assert.deepEqual(
      { ...result.booking, reference: undefined },
      { reference: undefined, status: "CONFIRMED", barberId: "a", date: DATE, time: "10:00", email: "not_requested" },
    );

    const row = await db.appointment.findUniqueOrThrow({ where: { reference: result.booking.reference }, include: { customer: true } });
    assert.equal(row.startsAt.toISOString(), "2026-11-03T02:00:00.000Z");
    assert.equal(row.endsAt.toISOString(), "2026-11-03T03:00:00.000Z");
    assert.equal(row.customer.phone, "97688112233");
    assert.equal(row.customerName, "Saraa");
    assert.equal(row.notes, "Short on the sides");
    assert.equal(row.priceMnt, 50_000);
    assert.equal(row.isDemo, false);
    assert.equal(row.source, "ONLINE");
  });

  it("starts as PENDING when the studio confirms manually", async () => {
    await db.businessSettings.update({ where: { id: "default" }, data: { autoConfirm: false } });
    const result = await book();
    assert.ok(result.ok);
    assert.equal(result.booking.status, "PENDING");
  });

  it("removes a booked time from availability", async () => {
    const before = await getAvailability(db, { date: DATE, serviceId: "cut", barberId: "a" }, NOW);
    assert.equal(before?.find((s) => s.time === "10:00")?.available, true);
    assert.ok((await book()).ok);
    const afterBooking = await getAvailability(db, { date: DATE, serviceId: "cut", barberId: "a" }, NOW);
    const state = Object.fromEntries(afterBooking!.map((s) => [s.time, s.available]));
    assert.equal(state["10:00"], false);
    assert.equal(state["10:30"], false);
    assert.equal(state["11:00"], true);
  });
});

describe("double-booking protection", () => {
  beforeEach(async () => {
    await resetDatabase(db);
    await seedFixtures(db);
  });

  it("lets exactly one of many simultaneous requests for the same barber and time succeed", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => book()));
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.deepEqual(new Set(results.filter((r) => !r.ok).map((r) => !r.ok && r.error)), new Set(["slot_taken"]));
    assert.equal(await db.appointment.count(), 1);
  });

  it("rejects simultaneous requests that overlap without starting at the same time", async () => {
    const results = await Promise.all([book({ time: "10:00" }), book({ time: "10:30" }), book({ time: "10:30", serviceId: "shave" })]);
    assert.equal(results.filter((r) => r.ok).length, 1);
    assert.equal(await db.appointment.count(), 1);
  });

  it("rejects an overlapping booking and allows an adjacent one", async () => {
    assert.ok((await book({ time: "10:00" })).ok);
    assert.deepEqual(await book({ time: "10:30" }), { ok: false, error: "slot_taken" });
    assert.ok((await book({ time: "11:00" })).ok);
  });

  it("does not block a different barber at the same time", async () => {
    assert.ok((await book({ barberId: "a" })).ok);
    assert.ok((await book({ barberId: "b" })).ok);
  });

  it("spreads simultaneous 'any barber' requests across free barbers, then reports the slot as taken", async () => {
    const results = await Promise.all(Array.from({ length: 3 }, () => book({ barberId: "any" })));
    const ok = results.filter((r) => r.ok);
    assert.equal(ok.length, 2);
    assert.deepEqual(new Set(ok.map((r) => r.ok && r.booking.barberId)), new Set(["a", "b"]));
    assert.equal(results.filter((r) => !r.ok && r.error === "slot_taken").length, 1);
  });

  it("is enforced by the database even if application checks are bypassed", async () => {
    const result = await book();
    assert.ok(result.ok);
    const existing = await db.appointment.findUniqueOrThrow({ where: { reference: result.booking.reference } });
    const overlapping = {
      ...existing,
      id: undefined,
      reference: "S08-RAWXXX",
      idempotencyKey: null,
      startsAt: ubTime("10:30"),
      endsAt: ubTime("11:30"),
      createdAt: undefined,
      updatedAt: undefined,
    };
    await assert.rejects(db.appointment.create({ data: overlapping }), /appointments_no_overlap|23P01|exclusion/i);
    // Cancelled appointments don't hold time.
    await db.appointment.create({ data: { ...overlapping, status: "CANCELLED" } });
  });

  it("frees the time when an appointment is cancelled", async () => {
    const first = await book();
    assert.ok(first.ok);
    const row = await db.appointment.findUniqueOrThrow({ where: { reference: first.booking.reference } });
    const admin = await db.user.create({ data: { email: "admin@test.local", name: "Admin", role: "ADMIN", passwordHash: "x" } });
    assert.deepEqual(await changeAppointmentStatus(db, { appointmentId: row.id, to: "CANCELLED", actorId: admin.id }, NOW), { ok: true });
    assert.ok((await book()).ok);
  });

  it("honours the buffer between appointments", async () => {
    await db.businessSettings.update({ where: { id: "default" }, data: { bufferMinutes: 15 } });
    assert.ok((await book({ time: "10:00" })).ok);
    assert.deepEqual(await book({ time: "11:00" }), { ok: false, error: "slot_taken" });
    assert.ok((await book({ time: "11:30" })).ok);
  });
});

describe("booking rules", () => {
  beforeEach(async () => {
    await resetDatabase(db);
    await seedFixtures(db);
  });

  const rejects = async (overrides: Parameters<typeof request>[0], error: string, now = NOW) => {
    const result = await book(overrides, now);
    assert.equal(result.ok, false, `expected ${error} for ${JSON.stringify(overrides)}`);
    assert.equal(!result.ok && result.error, error);
  };

  it("rejects stale requests for times that have passed or are inside the notice period", async () => {
    await rejects({ time: "10:00" }, "slot_taken", new Date(ubTime("09:30").getTime()));
    await rejects({ time: "10:00" }, "slot_taken", new Date(ubTime("11:00").getTime()));
    await rejects({ date: "2026-11-01" }, "slot_taken");
  });

  it("rejects times outside working hours, across the break, on days off and beyond the horizon", async () => {
    await rejects({ time: "09:00" }, "slot_taken");
    await rejects({ time: "13:00" }, "slot_taken"); // 60 min would run into the 13:30 break
    await rejects({ time: "17:30" }, "slot_taken"); // would end after 18:00
    await rejects({ date: "2026-11-09" }, "slot_taken"); // Monday: nobody works
    await rejects({ date: "2026-11-17" }, "slot_taken"); // outside the 14-day horizon
    await rejects({ time: "10:15" }, "slot_taken"); // off the 30-minute grid
  });

  it("rejects bookings during time off and studio closures", async () => {
    await db.timeOff.create({ data: { barberId: "a", startsAt: ubTime("00:00"), endsAt: ubTime("23:59") } });
    await rejects({}, "slot_taken");
    assert.ok((await book({ barberId: "b" })).ok);
    await db.timeOff.create({ data: { barberId: null, startsAt: ubTime("00:00"), endsAt: ubTime("23:59") } });
    await rejects({ barberId: "any", time: "11:00" }, "slot_taken");
  });

  it("rejects inactive services, unknown barbers and barbers who don't offer the service", async () => {
    await rejects({ serviceId: "retired" }, "invalid");
    await rejects({ serviceId: "nope" }, "invalid");
    await rejects({ barberId: "zed" }, "invalid");
    await rejects({ barberId: "c", serviceId: "cut" }, "invalid");
    await db.barber.update({ where: { id: "b" }, data: { active: false } });
    await rejects({ barberId: "b" }, "invalid");
  });

  it("validates customer details on the server", async () => {
    const result = await book({ customer: { name: "A", phone: "12", email: "bad@", notes: "x".repeat(600) } });
    assert.deepEqual(result, { ok: false, error: "invalid", fields: ["name", "phone", "email", "notes"] });
    await rejects({ date: "2026-02-30" }, "invalid");
    await rejects({ time: "25:00" }, "invalid");
    assert.deepEqual(await createBooking(db, { nonsense: true }, { now: NOW, emailProvider: null }), { ok: false, error: "invalid" });
  });

  it("limits how many upcoming bookings one phone number can hold", async () => {
    await db.businessSettings.update({ where: { id: "default" }, data: { maxActiveBookingsPerPhone: 2 } });
    const customer = { phone: "88990011" };
    assert.ok((await book({ time: "10:00", customer })).ok);
    assert.ok((await book({ time: "11:00", customer })).ok);
    await rejects({ time: "12:00", customer }, "limit_reached");
  });

  it("returns the original booking when a submit is retried with the same key", async () => {
    const original = request({ customer: { phone: "88112233" } });
    const [first, second] = await Promise.all([
      createBooking(db, original, { now: NOW, emailProvider: null }),
      createBooking(db, original, { now: NOW, emailProvider: null }),
    ]);
    assert.ok(first.ok && second.ok);
    assert.equal(first.booking.reference, second.booking.reference);
    assert.equal(await db.appointment.count(), 1);

    const hijack = { ...original, customer: { ...original.customer, phone: "88445566" } };
    assert.deepEqual(await createBooking(db, hijack, { now: NOW, emailProvider: null }), { ok: false, error: "invalid" });
  });
});

describe("appointment status changes", () => {
  beforeEach(async () => {
    await resetDatabase(db);
    await seedFixtures(db);
  });

  it("follows the lifecycle and records an audit entry", async () => {
    const result = await book();
    assert.ok(result.ok);
    const { id } = await db.appointment.findUniqueOrThrow({ where: { reference: result.booking.reference } });
    const actor = await db.user.create({ data: { email: "staff@test.local", name: "Staff", passwordHash: "x" } });

    const change = (to: "COMPLETED" | "CANCELLED" | "NO_SHOW", now = NOW) => changeAppointmentStatus(db, { appointmentId: id, to, actorId: actor.id }, now);
    assert.deepEqual(await change("COMPLETED"), { ok: false, error: "invalid_transition" }, "can't complete before it starts");
    assert.deepEqual(await change("COMPLETED", ubTime("11:00")), { ok: true });
    assert.deepEqual(await change("CANCELLED", ubTime("11:00")), { ok: false, error: "invalid_transition" }, "completed is final");

    const log = await db.auditLog.findMany({ where: { entityId: id } });
    assert.equal(log.length, 1);
    assert.deepEqual(log[0].metadata, { from: "CONFIRMED", to: "COMPLETED" });
    assert.equal(log[0].actorId, actor.id);
  });
});

describe("confirmation emails", () => {
  beforeEach(async () => {
    await resetDatabase(db);
    await seedFixtures(db);
  });

  const withEmail = { customer: { email: "Guest@Example.com" } };

  it("records SKIPPED and never claims an email was sent when no provider is configured", async () => {
    const result = await createBooking(db, request(withEmail), { now: NOW, emailProvider: null });
    assert.ok(result.ok);
    assert.equal(result.booking.email, "not_sent");
    const notification = await db.notification.findFirstOrThrow();
    assert.equal(notification.status, "SKIPPED");
    assert.equal(notification.error, "provider_not_configured");
    assert.equal(notification.recipient, "guest@example.com");
  });

  it("records SENT when the provider accepts the message", async () => {
    const sent: string[] = [];
    const provider: EmailProvider = {
      name: "fake",
      async send(message) {
        sent.push(message.to);
        return { ok: true, messageId: "msg_1" };
      },
    };
    const result = await createBooking(db, request(withEmail), { now: NOW, emailProvider: provider });
    assert.ok(result.ok);
    assert.equal(result.booking.email, "sent");
    assert.deepEqual(sent, ["guest@example.com"]);
    const notification = await db.notification.findFirstOrThrow();
    assert.equal(notification.status, "SENT");
    assert.equal(notification.providerMessageId, "msg_1");
  });

  it("keeps the booking but reports not_sent when the provider fails", async () => {
    const provider: EmailProvider = {
      name: "fake",
      async send() {
        return { ok: false, error: "HTTP 503: unavailable" };
      },
    };
    const result = await createBooking(db, request(withEmail), { now: NOW, emailProvider: provider });
    assert.ok(result.ok);
    assert.equal(result.booking.email, "not_sent");
    assert.equal(await db.appointment.count(), 1);
    const notification = await db.notification.findFirstOrThrow();
    assert.equal(notification.status, "FAILED");
    assert.equal(notification.attempts, 1);
  });
});
