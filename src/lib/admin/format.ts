import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { formatLongDate, minutesToTime } from "@/lib/booking/dates";
import { zonedParts } from "@/lib/booking/time";

/*
 * Dashboard formatting. Built by hand from dictionary strings (like the rest of
 * the site) so server and client output always match.
 */

/** "21 Oct" / "10/21": compact, for axes and dense lists. */
export function shortDate(iso: string, locale: Locale, dict: Dictionary): string {
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  return locale === "mn" ? `${month}/${day}` : `${day} ${dict.calendar.monthsShort[month - 1]}`;
}

/** "21 Oct 2026" / "2026.10.21": dates in tables, where the year matters. */
export function tableDate(iso: string, locale: Locale, dict: Dictionary): string {
  const [y, m, d] = iso.split("-");
  return locale === "mn" ? `${y}.${m}.${d}` : `${Number(d)} ${dict.calendar.monthsShort[Number(m) - 1]} ${y}`;
}

export function longDate(iso: string, dict: Dictionary): string {
  return formatLongDate(iso, { weekdays: dict.weekdays, monthsLong: dict.calendar.monthsLong, dateLong: dict.calendar.dateLong });
}

/** Studio-zone date and HH:MM of an instant. */
export function zoned(instant: Date, timeZone: string): { date: string; time: string; minutes: number } {
  const parts = zonedParts(instant, timeZone);
  return { date: parts.date, time: minutesToTime(parts.minutes), minutes: parts.minutes };
}

/** "21 Oct 2026, 14:05" in the studio zone. */
export function dateTime(instant: Date, timeZone: string, locale: Locale, dict: Dictionary): string {
  const { date, time } = zoned(instant, timeZone);
  return `${tableDate(date, locale, dict)}, ${time}`;
}

export function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

/** Only the last four digits: enough to tell customers apart in a list. */
export function maskPhone(phone: string): string {
  return phone.length <= 4 ? "••••" : `•••• ${phone.slice(-4)}`;
}

/** Digits grouped for reading: 97688112233 → 976 8811 2233. */
export function displayPhone(phone: string): string {
  if (phone.length === 11 && phone.startsWith("976")) return `+976 ${phone.slice(3, 7)} ${phone.slice(7)}`;
  if (phone.length === 8) return `${phone.slice(0, 4)} ${phone.slice(4)}`;
  return phone;
}

/** 750 → "12.5 h" (unit from the dictionary). */
export function hours(minutes: number, unit: string): string {
  const value = minutes / 60;
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`;
}
