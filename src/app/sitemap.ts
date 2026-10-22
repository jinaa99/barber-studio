import type { MetadataRoute } from "next";
import { localeTags, locales, localizedPath } from "@/i18n/config";
import { routes } from "@/lib/navigation";
import { siteOrigin } from "@/lib/metadata";

/** Public pages, every language, each listing its translations (the same pairs as the pages' hreflang links). */
const publicRoutes = [routes.home, routes.services, routes.barbers, routes.gallery, routes.booking, routes.visit];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  const url = (path: string) => new URL(path, origin).toString();
  return publicRoutes.flatMap((path) =>
    locales.map((locale) => ({
      url: url(localizedPath(locale, path)),
      changeFrequency: path === routes.booking ? "daily" : "weekly",
      priority: path === routes.home ? 1 : 0.7,
      alternates: { languages: Object.fromEntries(locales.map((l) => [localeTags[l], url(localizedPath(l, path))])) },
    })),
  );
}
