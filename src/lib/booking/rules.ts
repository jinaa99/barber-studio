import type { BookingCatalog } from "./types";
import { timeToMinutes, toISODate, weekdayOf } from "./dates";

/** Lead time before the first bookable slot on the current day. */
export const SAME_DAY_BUFFER_MINUTES = 60;

/**
 * Whether a service of `durationMinutes` can still start on `date`: the studio
 * is open that day and, for today, there is time left after the lead buffer.
 */
export function isDateBookable(
  hours: BookingCatalog["hours"],
  date: string,
  durationMinutes: number,
  now = new Date(),
): boolean {
  const day = hours.find((h) => h.day === weekdayOf(date));
  if (!day?.open || !day.close) return false;
  if (toISODate(now) !== date) return true;
  const earliest = now.getHours() * 60 + now.getMinutes() + SAME_DAY_BUFFER_MINUTES;
  return earliest <= timeToMinutes(day.close) - durationMinutes;
}
