export const locales = ["mn", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "mn";

/** Cookie that remembers an explicit language choice for unprefixed URLs. */
export const localeCookie = "NEXT_LOCALE";

export const localeNames: Record<Locale, { short: string; native: string }> = {
  mn: { short: "MN", native: "Монгол" },
  en: { short: "EN", native: "English" },
};

/** BCP 47 tags used for `<html lang>`, Open Graph and Intl formatting. */
export const localeTags: Record<Locale, string> = {
  mn: "mn-MN",
  en: "en-GB",
};

export function hasLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}

/** Text that exists in every supported language. */
export type LocalizedText = Record<Locale, string>;

/** Prefix an app path (e.g. "/services") with a locale. */
export function localizedPath(locale: Locale, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}

/** Swap the locale segment of a pathname, keeping the rest of the route. */
export function switchLocalePath(pathname: string, next: Locale): string {
  const segments = pathname.split("/");
  if (hasLocale(segments[1])) {
    segments[1] = next;
    return segments.join("/") || `/${next}`;
  }
  return localizedPath(next, pathname);
}
