import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { NavItem } from "@/components/layout/site-header";

/** Public routes, in navigation order. Booking is surfaced separately as the primary CTA. */
export const routes = {
  home: "/",
  services: "/services",
  barbers: "/barbers",
  gallery: "/gallery",
  booking: "/booking",
  visit: "/visit",
  admin: "/admin",
  adminLogin: "/admin/login",
  adminAppointments: "/admin/appointments",
  adminNewAppointment: "/admin/appointments/new",
  adminBarbers: "/admin/barbers",
  adminServices: "/admin/services",
  adminCustomers: "/admin/customers",
  adminAnalytics: "/admin/analytics",
  adminContent: "/admin/content",
  adminMedia: "/admin/media",
  adminSettings: "/admin/settings",
  adminSocial: "/admin/social",
  adminActivity: "/admin/activity",
} as const;

export function getNavItems(locale: Locale, dict: Dictionary): NavItem[] {
  return [
    { href: localizedPath(locale, routes.services), label: dict.nav.services },
    { href: localizedPath(locale, routes.barbers), label: dict.nav.barbers },
    { href: localizedPath(locale, routes.gallery), label: dict.nav.gallery },
    { href: localizedPath(locale, routes.visit), label: dict.nav.visit },
  ];
}
