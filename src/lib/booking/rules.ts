import type { BookingConfig } from "./types";
import { addCalendarDays, isoWeekday, zonedParts } from "./time";

/*
 * Browser-side hints for the date picker. They only disable obviously
 * unbookable days; the server decides what is actually available.
 */

/** Today's date in the studio zone, then the following days of the booking horizon. */
export function bookableDates(config: BookingConfig, now = new Date()): string[] {
  const today = zonedParts(now, config.timeZone).date;
  return Array.from({ length: config.bookingHorizonDays }, (_, i) => addCalendarDays(today, i));
}

/**
 * Whether anyone could take the service on `date`: one of `barberWeekdays`
 * (0 = Sunday) is that day, and for today there's still time after the notice period.
 */
export function isDateBookable(
  config: BookingConfig,
  date: string,
  workingWeekdays: Set<number>,
  latestStartMinute: number | null,
  now = new Date(),
): boolean {
  if (!workingWeekdays.has(isoWeekday(date))) return false;
  const current = zonedParts(now, config.timeZone);
  if (current.date !== date || latestStartMinute === null) return true;
  return current.minutes + config.minLeadMinutes <= latestStartMinute;
}
