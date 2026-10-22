import type { MetadataRoute } from "next";
import { locales, localizedPath } from "@/i18n/config";
import { routes } from "@/lib/navigation";
import { siteOrigin } from "@/lib/metadata";

/** The public site is crawlable; the staff dashboard and the APIs are not (their pages are noindex as well). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", ...locales.map((l) => localizedPath(l, routes.admin))],
    },
    sitemap: new URL("/sitemap.xml", siteOrigin()).toString(),
  };
}
