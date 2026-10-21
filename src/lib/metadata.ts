import type { Metadata } from "next";
import { localeTags, locales, localizedPath, type Locale } from "@/i18n/config";

/** Per-page metadata with language alternates so search engines pair /mn and /en. */
export function pageMetadata({
  locale,
  path,
  title,
  description,
}: {
  locale: Locale;
  path: string;
  title?: string;
  description?: string;
}): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: localizedPath(locale, path),
      languages: Object.fromEntries(locales.map((l) => [localeTags[l], localizedPath(l, path)])),
    },
    openGraph: {
      title,
      description,
      locale: localeTags[locale].replace("-", "_"),
      type: "website",
    },
  };
}
