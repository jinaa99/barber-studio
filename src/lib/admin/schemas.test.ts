import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fieldErrors } from "./forms";
import { bookingRulesSchema, serviceSchema, staffAppointmentSchema, timeOffSchema, validateBlocks } from "./schemas";

describe("working-hour blocks", () => {
  it("accepts breaks and touching blocks, sorted by day and time", () => {
    const { blocks, errors } = validateBlocks([
      { weekday: "2", start: "14:00", end: "18:00" },
      { weekday: "2", start: "10:00", end: "14:00" },
    ]);
    assert.deepEqual(errors, []);
    assert.deepEqual(blocks.map((b) => [b.startMinute, b.endMinute]), [[600, 840], [840, 1080]]);
  });

  it("reports bad times, reversed blocks and overlaps by row", () => {
    const { errors } = validateBlocks([
      { weekday: "1", start: "25:00", end: "18:00" },
      { weekday: "1", start: "18:00", end: "10:00" },
      { weekday: "3", start: "10:00", end: "15:00" },
      { weekday: "3", start: "14:00", end: "18:00" },
      { weekday: "4", start: "10:00", end: "15:00" },
    ]);
    assert.deepEqual(errors, [
      { index: 0, code: "time" },
      { index: 1, code: "order" },
      { index: 3, code: "overlap" },
    ]);
  });
});

describe("dashboard form validation", () => {
  it("returns field-level codes the client can translate", () => {
    const parsed = serviceSchema.safeParse({
      id: "Bad Slug",
      categoryId: "haircut",
      name: { mn: "", en: "Cut" },
      summary: { mn: "a", en: "b" },
      includes: { mn: ["one", "two"], en: ["one"] },
      durationMinutes: "1",
      priceMnt: "-5",
      featured: false,
      active: true,
      sortOrder: "0",
      barberIds: [],
    });
    assert.equal(parsed.success, false);
    assert.deepEqual(fieldErrors(parsed.error!), {
      id: "slug",
      "name.mn": "required",
      "includes.en": "mismatch",
      durationMinutes: "range",
      priceMnt: "range",
    });
  });

  it("reuses the public booking rules for guest details", () => {
    const parsed = staffAppointmentSchema.safeParse({
      serviceId: "cut",
      barberId: "a",
      date: "2026-11-03",
      time: "10:00",
      status: "CONFIRMED",
      customer: { name: "A", phone: "12", email: "nope", notes: "" },
      notify: false,
    });
    assert.equal(parsed.success, false);
    assert.deepEqual(fieldErrors(parsed.error!), { "customer.name": "invalid", "customer.phone": "phone", "customer.email": "email" });
  });

  it("keeps booking rules inside the database constraints", () => {
    const ok = { slotIntervalMinutes: "30", bookingHorizonDays: "14", minLeadMinutes: "60", bufferMinutes: "0", maxActiveBookingsPerPhone: "3", autoConfirm: true };
    assert.equal(bookingRulesSchema.safeParse(ok).success, true);
    assert.equal(bookingRulesSchema.safeParse({ ...ok, slotIntervalMinutes: "7" }).success, false);
    assert.equal(bookingRulesSchema.safeParse({ ...ok, bookingHorizonDays: "0" }).success, false);
  });

  it("requires a time off window that ends after it starts", () => {
    const base = { barberId: "a", startDate: "2026-11-03", endDate: "2026-11-03", reason: "" };
    assert.equal(timeOffSchema.safeParse({ ...base, allDay: true, startTime: "", endTime: "" }).success, true);
    const reversed = timeOffSchema.safeParse({ ...base, allDay: false, startTime: "15:00", endTime: "11:00" });
    assert.deepEqual(fieldErrors(reversed.error!), { endTime: "range" });
  });
});
