import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { zonedTimeToUtc } from "@/lib/booking/time";
import {
  bucketStart,
  computeBarberStats,
  computeReturning,
  computeServiceStats,
  computeTotals,
  computeTrend,
  granularityFor,
  MIN_RETURNING_SAMPLE,
  resolveRange,
  scheduledMinutes,
  type MetricAppointment,
} from "./metrics";

const TZ = "Asia/Ulaanbaatar";
const at = (date: string, time: string) => zonedTimeToUtc(date, Number(time.slice(0, 2)) * 60 + Number(time.slice(3)), TZ);

let n = 0;
function row(status: AppointmentStatus, overrides: Partial<MetricAppointment> = {}): MetricAppointment {
  n += 1;
  const startsAt = overrides.startsAt ?? at("2026-11-03", "10:00");
  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + 60 * 60_000),
    status,
    priceMnt: 50_000,
    barberId: "a",
    serviceId: "cut",
    customerId: `c${n}`,
    ...overrides,
  };
}

describe("revenue and totals", () => {
  it("counts only completed appointments as revenue", () => {
    const totals = computeTotals([
      row("COMPLETED"),
      row("COMPLETED", { priceMnt: 70_000 }),
      row("CANCELLED", { priceMnt: 1_000_000 }),
      row("NO_SHOW", { priceMnt: 1_000_000 }),
      row("CONFIRMED", { priceMnt: 30_000 }),
      row("PENDING", { priceMnt: 20_000 }),
    ]);
    assert.equal(totals.completedRevenue, 120_000);
    assert.equal(totals.scheduledValue, 50_000, "pending + confirmed are scheduled, never revenue");
    assert.equal(totals.averageTicket, 60_000);
    assert.equal(totals.appointments, 6);
  });

  it("defines the rates and returns null instead of dividing by zero", () => {
    const totals = computeTotals([row("COMPLETED"), row("COMPLETED"), row("COMPLETED"), row("NO_SHOW"), row("CANCELLED")]);
    assert.equal(totals.cancellationRate, 1 / 5);
    assert.equal(totals.noShowRate, 1 / 4);
    const empty = computeTotals([]);
    assert.equal(empty.cancellationRate, null);
    assert.equal(empty.noShowRate, null);
    assert.equal(empty.averageTicket, null);
  });
});

describe("date ranges", () => {
  it("resolves presets relative to the studio's today", () => {
    assert.deepEqual(resolveRange({ range: "7d" }, "2026-11-10"), { preset: "7d", from: "2026-11-04", to: "2026-11-10" });
    assert.deepEqual(resolveRange({ range: "month" }, "2026-11-10"), { preset: "month", from: "2026-11-01", to: "2026-11-10" });
    assert.deepEqual(resolveRange({ range: "custom", from: "2026-10-01", to: "2026-10-05" }, "2026-11-10"), {
      preset: "custom",
      from: "2026-10-01",
      to: "2026-10-05",
    });
  });

  it("falls back to the last 30 days for bad or oversized input", () => {
    const fallback = { preset: "30d", from: "2026-10-12", to: "2026-11-10" };
    assert.deepEqual(resolveRange({ range: "custom", from: "2026-11-05", to: "2026-11-01" }, "2026-11-10"), fallback);
    assert.deepEqual(resolveRange({ range: "custom", from: "2020-01-01", to: "2026-11-01" }, "2026-11-10"), fallback);
    assert.deepEqual(resolveRange({ range: "nonsense" }, "2026-11-10"), fallback);
  });

  it("buckets by day, Monday-started week or month", () => {
    assert.equal(granularityFor({ from: "2026-11-01", to: "2026-11-30" }), "day");
    assert.equal(granularityFor({ from: "2026-09-01", to: "2026-11-30" }), "week");
    assert.equal(granularityFor({ from: "2026-01-01", to: "2026-11-30" }), "month");
    assert.equal(bucketStart("2026-11-08", "week"), "2026-11-02", "Sunday belongs to the week starting Monday");
    assert.equal(bucketStart("2026-11-08", "month"), "2026-11-01");
  });
});

describe("trends", () => {
  it("places appointments on the studio-zone day they start", () => {
    // 07:30 in Ulaanbaatar on 4 Nov is still 3 Nov in UTC.
    const early = row("COMPLETED", { startsAt: at("2026-11-04", "07:30") });
    const trend = computeTrend([early, row("CANCELLED")], { from: "2026-11-03", to: "2026-11-04" }, TZ);
    assert.deepEqual(
      trend.buckets.map((b) => [b.start, b.appointments, b.completedRevenue, b.cancelled]),
      [
        ["2026-11-03", 1, 0, 1],
        ["2026-11-04", 1, 50_000, 0],
      ],
    );
  });

  it("ranks services by bookings that weren't cancelled", () => {
    const stats = computeServiceStats([row("CANCELLED", { serviceId: "shave" }), row("CANCELLED", { serviceId: "shave" }), row("COMPLETED")]);
    assert.deepEqual(stats.map((s) => [s.serviceId, s.booked]), [["cut", 1], ["shave", 0]]);
  });
});

describe("utilization", () => {
  const schedule = {
    barberId: "a",
    // Tuesday 10:00–18:00 (480 minutes).
    blocks: [{ weekday: 2, startMinute: 600, endMinute: 1080 }],
    timeOff: [] as { startsAt: Date; endsAt: Date }[],
  };

  it("sums working blocks over the range and subtracts time off once", () => {
    assert.equal(scheduledMinutes(schedule, { from: "2026-11-02", to: "2026-11-08" }, TZ), 480);
    const off = { ...schedule, timeOff: [{ startsAt: at("2026-11-03", "09:00"), endsAt: at("2026-11-03", "12:00") }, { startsAt: at("2026-11-03", "11:00"), endsAt: at("2026-11-03", "13:00") }] };
    assert.equal(scheduledMinutes(off, { from: "2026-11-03", to: "2026-11-03" }, TZ), 480 - 180, "10:00–13:00 removed, overlap counted once");
  });

  it("divides chair-holding minutes by scheduled minutes", () => {
    const [stat] = computeBarberStats(
      [row("COMPLETED"), row("NO_SHOW", { startsAt: at("2026-11-03", "12:00") }), row("CANCELLED", { startsAt: at("2026-11-03", "14:00") })],
      [schedule],
      { from: "2026-11-03", to: "2026-11-03" },
      TZ,
    );
    assert.equal(stat.bookedMinutes, 120, "cancelled time doesn't count");
    assert.equal(stat.utilization, 120 / 480);
    assert.equal(stat.completedRevenue, 50_000);
  });

  it("reports no utilization without scheduled hours", () => {
    const [stat] = computeBarberStats([row("COMPLETED", { barberId: "x" })], [], { from: "2026-11-03", to: "2026-11-03" }, TZ);
    assert.equal(stat.utilization, null);
  });
});

describe("returning customers", () => {
  it("refuses to report a rate from a small sample", () => {
    const result = computeReturning([row("COMPLETED")], new Map());
    assert.deepEqual(result, { status: "insufficient", customers: 1, needed: MIN_RETURNING_SAMPLE });
  });

  it("counts customers with two or more completed visits", () => {
    const rows = Array.from({ length: MIN_RETURNING_SAMPLE }, (_, i) => row("COMPLETED", { customerId: `r${i}` }));
    const visits = new Map(rows.map((r, i) => [r.customerId, i < 5 ? 3 : 1]));
    const result = computeReturning(rows, visits);
    assert.equal(result.status, "ok");
    assert.equal(result.status === "ok" && result.returning, 5);
  });
});
