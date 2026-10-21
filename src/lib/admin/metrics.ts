import type { AppointmentStatus } from "@/generated/prisma/enums";
import { addCalendarDays, isISODate, isoWeekday, zonedParts, zonedTimeToUtc } from "@/lib/booking/time";

/*
 * Business metrics, computed from appointment rows. Pure and unit-tested; the
 * server loads the rows (lib/server/metrics.ts) and this does the arithmetic.
 *
 * Definitions (also shown in the dashboard and docs/ADMIN.md):
 *
 *  - An appointment belongs to the studio-zone day it STARTS on.
 *  - Completed-service revenue = sum of the price snapshot (`priceMnt`, the
 *    price at booking time) of COMPLETED appointments. Nothing else counts:
 *    not PENDING/CONFIRMED (not yet delivered), not CANCELLED, not NO_SHOW.
 *    There is no payment ledger yet, so this assumes a completed service was
 *    paid at its listed price (no discounts, tips or refunds recorded).
 *  - Scheduled value = sum of `priceMnt` of PENDING/CONFIRMED appointments:
 *    expected, not collected, and always shown separately from revenue.
 *  - Cancellation rate = CANCELLED / all appointments in the range.
 *  - No-show rate = NO_SHOW / (COMPLETED + NO_SHOW): of the guests who were
 *    due to arrive and whose outcome is recorded, how many didn't.
 *  - Utilization = booked minutes / scheduled minutes, per barber. Booked
 *    minutes: duration of every appointment that held the chair (PENDING,
 *    CONFIRMED, COMPLETED, NO_SHOW; not CANCELLED). Scheduled minutes: weekly
 *    working blocks on each day of the range, minus time off and studio closures.
 *  - Returning customers: of the customers with a COMPLETED visit in the
 *    range, the share with at least two COMPLETED visits up to the end of the
 *    range. Only reported from MIN_RETURNING_SAMPLE customers up.
 *
 * Demo appointments are excluded unless the caller asks for them, and the
 * dashboard labels any figure that includes them.
 */

export const MIN_RETURNING_SAMPLE = 20;
/** Longest range the dashboard computes in one go. */
export const MAX_RANGE_DAYS = 366;

export interface MetricAppointment {
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  priceMnt: number;
  barberId: string;
  serviceId: string;
  customerId: string;
}

export interface DateRange {
  /** Inclusive studio-zone dates, YYYY-MM-DD. */
  from: string;
  to: string;
}

export type RangePreset = "today" | "7d" | "30d" | "90d" | "month" | "custom";
export const rangePresets: RangePreset[] = ["today", "7d", "30d", "90d", "month"];

export function daysBetween(from: string, to: string): number {
  const [a, b] = [from, to].map((d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

/** A range from URL parameters. Invalid or oversized input falls back to the last 30 days. */
export function resolveRange(
  params: { range?: string; from?: string; to?: string },
  today: string,
): DateRange & { preset: RangePreset } {
  const last = (days: number) => ({ from: addCalendarDays(today, -(days - 1)), to: today });
  switch (params.range) {
    case "today":
      return { preset: "today", from: today, to: today };
    case "7d":
      return { preset: "7d", ...last(7) };
    case "90d":
      return { preset: "90d", ...last(90) };
    case "month":
      return { preset: "month", from: `${today.slice(0, 8)}01`, to: today };
    case "custom": {
      const { from, to } = params;
      if (from && to && isISODate(from) && isISODate(to) && from <= to && daysBetween(from, to) < MAX_RANGE_DAYS) {
        return { preset: "custom", from, to };
      }
      break;
    }
  }
  return { preset: "30d", ...last(30) };
}

export function datesIn(range: DateRange): string[] {
  const dates: string[] = [];
  for (let d = range.from; d <= range.to; d = addCalendarDays(d, 1)) dates.push(d);
  return dates;
}

/** UTC bounds `[start, end)` of a studio-zone date range. */
export function rangeBounds(range: DateRange, timeZone: string): { start: Date; end: Date } {
  return { start: zonedTimeToUtc(range.from, 0, timeZone), end: zonedTimeToUtc(addCalendarDays(range.to, 1), 0, timeZone) };
}

/* ------------------------------------------------------------------ Totals */

const statuses: AppointmentStatus[] = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];
const holdsChair = (s: AppointmentStatus) => s !== "CANCELLED";

export interface Totals {
  appointments: number;
  byStatus: Record<AppointmentStatus, number>;
  completedRevenue: number;
  scheduledValue: number;
  /** Mean price of completed appointments, or null without any. */
  averageTicket: number | null;
  /** 0–1, or null when the denominator is zero. */
  cancellationRate: number | null;
  noShowRate: number | null;
}

export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

export function computeTotals(rows: MetricAppointment[]): Totals {
  const byStatus = Object.fromEntries(statuses.map((s) => [s, 0])) as Record<AppointmentStatus, number>;
  let completedRevenue = 0;
  let scheduledValue = 0;
  for (const row of rows) {
    byStatus[row.status] += 1;
    if (row.status === "COMPLETED") completedRevenue += row.priceMnt;
    if (row.status === "PENDING" || row.status === "CONFIRMED") scheduledValue += row.priceMnt;
  }
  return {
    appointments: rows.length,
    byStatus,
    completedRevenue,
    scheduledValue,
    averageTicket: byStatus.COMPLETED > 0 ? Math.round(completedRevenue / byStatus.COMPLETED) : null,
    cancellationRate: ratio(byStatus.CANCELLED, rows.length),
    noShowRate: ratio(byStatus.NO_SHOW, byStatus.COMPLETED + byStatus.NO_SHOW),
  };
}

/* ------------------------------------------------------------------ Trends */

export type Granularity = "day" | "week" | "month";

export function granularityFor(range: DateRange): Granularity {
  const days = daysBetween(range.from, range.to) + 1;
  return days <= 31 ? "day" : days <= 120 ? "week" : "month";
}

/** The first date of the bucket `date` falls in. Weeks start on Monday. */
export function bucketStart(date: string, granularity: Granularity): string {
  if (granularity === "day") return date;
  if (granularity === "month") return `${date.slice(0, 8)}01`;
  const weekday = isoWeekday(date);
  return addCalendarDays(date, -((weekday + 6) % 7));
}

export interface TrendBucket {
  /** First date of the bucket (clamped to the range start). */
  start: string;
  end: string;
  appointments: number;
  completed: number;
  /** PENDING + CONFIRMED. */
  upcoming: number;
  cancelled: number;
  noShow: number;
  completedRevenue: number;
}

export function computeTrend(rows: MetricAppointment[], range: DateRange, timeZone: string): {
  granularity: Granularity;
  buckets: TrendBucket[];
} {
  const granularity = granularityFor(range);
  const buckets = new Map<string, TrendBucket>();
  for (const date of datesIn(range)) {
    const key = bucketStart(date, granularity);
    const bucket = buckets.get(key);
    if (bucket) bucket.end = date;
    else {
      buckets.set(key, {
        start: date,
        end: date,
        appointments: 0,
        completed: 0,
        upcoming: 0,
        cancelled: 0,
        noShow: 0,
        completedRevenue: 0,
      });
    }
  }
  for (const row of rows) {
    const bucket = buckets.get(bucketStart(zonedParts(row.startsAt, timeZone).date, granularity));
    if (!bucket) continue;
    bucket.appointments += 1;
    if (row.status === "COMPLETED") {
      bucket.completed += 1;
      bucket.completedRevenue += row.priceMnt;
    } else if (row.status === "CANCELLED") bucket.cancelled += 1;
    else if (row.status === "NO_SHOW") bucket.noShow += 1;
    else bucket.upcoming += 1;
  }
  return { granularity, buckets: [...buckets.values()] };
}

/* ------------------------------------------------------- Services, barbers */

export interface ServiceStat {
  serviceId: string;
  /** Appointments that weren't cancelled. */
  booked: number;
  completed: number;
  completedRevenue: number;
}

export function computeServiceStats(rows: MetricAppointment[]): ServiceStat[] {
  const stats = new Map<string, ServiceStat>();
  for (const row of rows) {
    const stat = stats.get(row.serviceId) ?? { serviceId: row.serviceId, booked: 0, completed: 0, completedRevenue: 0 };
    if (holdsChair(row.status)) stat.booked += 1;
    if (row.status === "COMPLETED") {
      stat.completed += 1;
      stat.completedRevenue += row.priceMnt;
    }
    stats.set(row.serviceId, stat);
  }
  return [...stats.values()].sort((a, b) => b.booked - a.booked || b.completedRevenue - a.completedRevenue);
}

export interface ScheduleInput {
  barberId: string;
  blocks: { weekday: number; startMinute: number; endMinute: number }[];
  /** The barber's own time off plus studio closures. */
  timeOff: { startsAt: Date; endsAt: Date }[];
}

/** Working minutes in `range`, minus time off. */
export function scheduledMinutes(schedule: ScheduleInput, range: DateRange, timeZone: string): number {
  const MINUTE = 60_000;
  let total = 0;
  for (const date of datesIn(range)) {
    const weekday = isoWeekday(date);
    for (const block of schedule.blocks) {
      if (block.weekday !== weekday) continue;
      const start = zonedTimeToUtc(date, block.startMinute, timeZone).getTime();
      const end = zonedTimeToUtc(date, block.endMinute, timeZone).getTime();
      // Subtract the union of time off overlapping the block.
      const cuts = schedule.timeOff
        .map((t) => [Math.max(start, t.startsAt.getTime()), Math.min(end, t.endsAt.getTime())] as const)
        .filter(([a, b]) => b > a)
        .sort((a, b) => a[0] - b[0]);
      let off = 0;
      let cursor = start;
      for (const [a, b] of cuts) {
        const from = Math.max(a, cursor);
        if (b > from) {
          off += b - from;
          cursor = b;
        }
      }
      total += (end - start - off) / MINUTE;
    }
  }
  return Math.round(total);
}

export interface BarberStat {
  barberId: string;
  appointments: number;
  completed: number;
  noShows: number;
  cancelled: number;
  completedRevenue: number;
  bookedMinutes: number;
  scheduledMinutes: number;
  /** 0–1 (capped), or null with no scheduled time. */
  utilization: number | null;
}

export function computeBarberStats(
  rows: MetricAppointment[],
  schedules: ScheduleInput[],
  range: DateRange,
  timeZone: string,
): BarberStat[] {
  const ids = new Set([...schedules.map((s) => s.barberId), ...rows.map((r) => r.barberId)]);
  return [...ids].map((barberId) => {
    const own = rows.filter((r) => r.barberId === barberId);
    const schedule = schedules.find((s) => s.barberId === barberId);
    const scheduled = schedule ? scheduledMinutes(schedule, range, timeZone) : 0;
    const booked = own
      .filter((r) => holdsChair(r.status))
      .reduce((sum, r) => sum + (r.endsAt.getTime() - r.startsAt.getTime()) / 60_000, 0);
    return {
      barberId,
      appointments: own.length,
      completed: own.filter((r) => r.status === "COMPLETED").length,
      noShows: own.filter((r) => r.status === "NO_SHOW").length,
      cancelled: own.filter((r) => r.status === "CANCELLED").length,
      completedRevenue: own.filter((r) => r.status === "COMPLETED").reduce((sum, r) => sum + r.priceMnt, 0),
      bookedMinutes: Math.round(booked),
      scheduledMinutes: scheduled,
      utilization: scheduled > 0 ? Math.min(1, booked / scheduled) : null,
    };
  });
}

/* --------------------------------------------------------------- Returning */

export type ReturningResult =
  | { status: "ok"; customers: number; returning: number; rate: number }
  | { status: "insufficient"; customers: number; needed: number };

/**
 * `completedThroughEnd` maps each customer to their number of COMPLETED visits
 * up to the end of the range (any time before, plus inside it).
 */
export function computeReturning(rows: MetricAppointment[], completedThroughEnd: Map<string, number>): ReturningResult {
  const customers = [...new Set(rows.filter((r) => r.status === "COMPLETED").map((r) => r.customerId))];
  if (customers.length < MIN_RETURNING_SAMPLE) {
    return { status: "insufficient", customers: customers.length, needed: MIN_RETURNING_SAMPLE };
  }
  const returning = customers.filter((id) => (completedThroughEnd.get(id) ?? 0) >= 2).length;
  return { status: "ok", customers: customers.length, returning, rate: returning / customers.length };
}
