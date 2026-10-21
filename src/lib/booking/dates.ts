import type { Weekday } from "@/content/types";

const weekdayByIndex: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Parse `YYYY-MM-DD` as a local calendar date (never UTC). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function weekdayOf(iso: string): Weekday {
  return weekdayByIndex[parseISODate(iso).getDay()];
}

/** The next `count` calendar days starting today, as ISO dates. */
export function upcomingDates(count: number, from = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => toISODate(addDays(from, i)));
}

export interface CalendarLabels {
  weekdays: Record<Weekday, string>;
  monthsLong: string[];
  /** Pattern with {weekday}, {day} and {month}. */
  dateLong: string;
}

/** Locale-aware long date built from dictionary strings, identical on server and client. */
export function formatLongDate(iso: string, labels: CalendarLabels): string {
  const date = parseISODate(iso);
  return labels.dateLong
    .replace("{weekday}", labels.weekdays[weekdayOf(iso)])
    .replace("{day}", String(date.getDate()))
    .replace("{month}", labels.monthsLong[date.getMonth()]);
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}
