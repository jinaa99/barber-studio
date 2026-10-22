import type { Locale } from "@/i18n/config";

/** Fill `{key}` placeholders in a dictionary string. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/**
 * Prices are stored as whole tögrög. Formatting is done by hand rather than
 * with Intl so server and client output is always identical.
 */
export function formatPrice(amount: number, locale: Locale): string {
  const separator = locale === "mn" ? " " : ",";
  const grouped = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return locale === "mn" ? `${grouped} ₮` : `₮${grouped}`;
}

/** A service price; 0 means it is agreed with the barber at the visit. */
export function formatServicePrice(amount: number, locale: Locale, onRequest: string): string {
  return amount === 0 ? onRequest : formatPrice(amount, locale);
}

export function formatDuration(minutes: number, unit: string): string {
  return `${minutes} ${unit}`;
}
