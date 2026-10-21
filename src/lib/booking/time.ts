/*
 * Time-zone arithmetic for the studio's wall clock. Working hours and slot
 * times are "minutes after midnight" on a calendar date in the studio zone
 * (Asia/Ulaanbaatar by default); appointments are stored as UTC instants.
 * Uses Intl only, so it runs the same on the server and in the browser.
 */

export const STUDIO_TIME_ZONE = "Asia/Ulaanbaatar";

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** The studio-zone calendar date, wall-clock minutes and weekday (0 = Sunday) of an instant. */
export function zonedParts(instant: Date, timeZone: string): { date: string; minutes: number; weekday: number } {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return {
    date,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: isoWeekday(date),
  };
}

/** Milliseconds the zone is ahead of UTC at `instant`. */
function offsetAt(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(new Date(instant))
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** The UTC instant of wall-clock `minutes` after midnight on `date` (YYYY-MM-DD) in `timeZone`. */
export function zonedTimeToUtc(date: string, minutes: number, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minutes);
  // Two passes settle the offset across a DST change (Ulaanbaatar has none today).
  let utc = wall - offsetAt(wall, timeZone);
  utc = wall - offsetAt(utc, timeZone);
  return new Date(utc);
}

/** Weekday of a calendar date, 0 = Sunday. Independent of any time zone. */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Calendar arithmetic on `YYYY-MM-DD` strings. */
export function addCalendarDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** `HH:MM` (24h) → minutes, or null when malformed. */
export function parseTime(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}
