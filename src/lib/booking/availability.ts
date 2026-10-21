import type { TimeSlot } from "./types";
import { minutesToTime } from "./dates";
import { addCalendarDays, zonedParts, zonedTimeToUtc } from "./time";

/*
 * The availability engine. Pure: callers load working hours, time off and
 * appointments, and this decides which start times are free. The server runs
 * it twice — once to list slots, and again inside the booking transaction
 * (with the barbers locked) before an appointment is written.
 */

export interface BookingRules {
  timeZone: string;
  slotIntervalMinutes: number;
  bookingHorizonDays: number;
  minLeadMinutes: number;
  bufferMinutes: number;
}

/** Half-open `[start, end)` interval in epoch milliseconds. */
export interface Interval {
  start: number;
  end: number;
}

export interface BarberDay {
  id: string;
  /** Working blocks for the requested weekday, minutes after midnight. Gaps are breaks. */
  blocks: { startMinute: number; endMinute: number }[];
  /** Active appointments (they get the buffer added on both sides). */
  appointments: Interval[];
  /** The barber's own time off plus studio-wide closures. */
  timeOff: Interval[];
}

export interface SlotQuery {
  /** Studio-zone calendar date, `YYYY-MM-DD`. */
  date: string;
  durationMinutes: number;
  barbers: BarberDay[];
  rules: BookingRules;
  now: Date;
}

const MINUTE = 60_000;

/** Whether `date` is within today … today + horizon − 1 in the studio zone. */
export function isWithinHorizon(date: string, rules: BookingRules, now: Date): boolean {
  const today = zonedParts(now, rules.timeZone).date;
  const last = addCalendarDays(today, rules.bookingHorizonDays - 1);
  return date >= today && date <= last;
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Whether `barber` can take the whole service starting at `startMinute` on the query date. */
export function isBarberFree(barber: BarberDay, startMinute: number, query: SlotQuery): boolean {
  const { date, durationMinutes, rules } = query;
  const endMinute = startMinute + durationMinutes;
  if (!barber.blocks.some((b) => startMinute >= b.startMinute && endMinute <= b.endMinute)) return false;

  const start = zonedTimeToUtc(date, startMinute, rules.timeZone).getTime();
  const candidate = { start, end: start + durationMinutes * MINUTE };
  const buffer = rules.bufferMinutes * MINUTE;

  if (barber.timeOff.some((t) => overlaps(candidate, t))) return false;
  return !barber.appointments.some((a) => overlaps(candidate, { start: a.start - buffer, end: a.end + buffer }));
}

/**
 * Start times on the grid of each working block, with the barbers free for
 * the whole service at each. Times before the minimum notice are omitted;
 * a date outside the booking horizon has no slots.
 */
export function computeSlots(query: SlotQuery): TimeSlot[] {
  const { date, durationMinutes, barbers, rules, now } = query;
  if (!isWithinHorizon(date, rules, now)) return [];

  const earliest = now.getTime() + rules.minLeadMinutes * MINUTE;
  const free = new Map<number, string[]>();

  for (const barber of barbers) {
    for (const block of barber.blocks) {
      for (let m = block.startMinute; m + durationMinutes <= block.endMinute; m += rules.slotIntervalMinutes) {
        if (zonedTimeToUtc(date, m, rules.timeZone).getTime() < earliest) continue;
        const list = free.get(m) ?? [];
        if (isBarberFree(barber, m, query)) list.push(barber.id);
        free.set(m, list);
      }
    }
  }

  return [...free.entries()]
    .sort(([a], [b]) => a - b)
    .map(([m, ids]) => ({ time: minutesToTime(m), available: ids.length > 0, barberIds: [...new Set(ids)] }));
}
