import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeSlots, type BarberDay, type BookingRules, type SlotQuery } from "./availability";
import { zonedTimeToUtc } from "./time";

const UB = "Asia/Ulaanbaatar";
const DATE = "2026-10-21"; // a Wednesday
const rules: BookingRules = { timeZone: UB, slotIntervalMinutes: 30, bookingHorizonDays: 14, minLeadMinutes: 60, bufferMinutes: 0 };
/** 08:00 on Tuesday the 20th in Ulaanbaatar. */
const NOW = new Date("2026-10-20T00:00:00Z");

const at = (time: string, date = DATE) => {
  const [h, m] = time.split(":").map(Number);
  return zonedTimeToUtc(date, h * 60 + m, UB).getTime();
};
const barber = (id: string, partial: Partial<BarberDay> = {}): BarberDay => ({
  id,
  blocks: [{ startMinute: 10 * 60, endMinute: 14 * 60 }],
  appointments: [],
  timeOff: [],
  ...partial,
});
const query = (partial: Partial<SlotQuery> = {}): SlotQuery => ({
  date: DATE,
  durationMinutes: 60,
  barbers: [barber("a")],
  rules,
  now: NOW,
  ...partial,
});
const free = (q: SlotQuery) => computeSlots(q).filter((s) => s.available).map((s) => s.time);

describe("computeSlots", () => {
  it("offers start times on the grid where the whole service fits the working block", () => {
    assert.deepEqual(free(query()), ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00"]);
  });

  it("never lets a service run into a break", () => {
    const withBreak = barber("a", {
      blocks: [
        { startMinute: 10 * 60, endMinute: 13 * 60 + 30 },
        { startMinute: 14 * 60, endMinute: 16 * 60 },
      ],
    });
    const times = free(query({ barbers: [withBreak] }));
    assert.ok(times.includes("12:30"));
    assert.ok(!times.includes("13:00"));
    assert.ok(times.includes("14:00"));
    assert.ok(!times.includes("15:30"));
  });

  it("blocks times that overlap an existing appointment (half-open intervals)", () => {
    const busy = barber("a", { appointments: [{ start: at("11:00"), end: at("12:00") }] });
    const slots = computeSlots(query({ barbers: [busy] }));
    const state = Object.fromEntries(slots.map((s) => [s.time, s.available]));
    assert.equal(state["10:00"], true, "ending exactly when the next starts is fine");
    assert.equal(state["10:30"], false);
    assert.equal(state["11:00"], false);
    assert.equal(state["11:30"], false);
    assert.equal(state["12:00"], true, "starting exactly when the previous ends is fine");
  });

  it("keeps the configured buffer free around appointments", () => {
    const busy = barber("a", { appointments: [{ start: at("11:00"), end: at("12:00") }] });
    const times = free(query({ barbers: [busy], rules: { ...rules, bufferMinutes: 15 } }));
    assert.ok(!times.includes("10:00"));
    assert.ok(!times.includes("12:00"));
    assert.ok(times.includes("12:30"));
  });

  it("respects time off and studio closures", () => {
    const off = barber("a", { timeOff: [{ start: at("00:00"), end: at("00:00", "2026-10-22") }] });
    assert.deepEqual(free(query({ barbers: [off] })), []);
    const partial = barber("a", { timeOff: [{ start: at("12:00"), end: at("14:00") }] });
    assert.deepEqual(free(query({ barbers: [partial] })), ["10:00", "10:30", "11:00"]);
  });

  it("applies the minimum notice on the current day", () => {
    // 10:20 in Ulaanbaatar with 60 minutes' notice: 11:30 is the first start.
    const now = new Date(at("10:20"));
    assert.deepEqual(free(query({ now })).slice(0, 2), ["11:30", "12:00"]);
  });

  it("returns nothing outside the booking horizon or in the past", () => {
    assert.deepEqual(computeSlots(query({ date: "2026-11-03" })), []);
    assert.deepEqual(computeSlots(query({ date: "2026-10-19" })), []);
    assert.ok(computeSlots(query({ date: "2026-11-02" })).length > 0);
  });

  it("lists every barber free at a time for 'any barber'", () => {
    const a = barber("a", { appointments: [{ start: at("10:00"), end: at("11:00") }] });
    const b = barber("b");
    const slot = computeSlots(query({ barbers: [a, b] })).find((s) => s.time === "10:00");
    assert.deepEqual(slot, { time: "10:00", available: true, barberIds: ["b"] });
  });

  it("has no slots when the service is longer than every working block", () => {
    assert.deepEqual(free(query({ durationMinutes: 5 * 60 })), []);
  });
});
