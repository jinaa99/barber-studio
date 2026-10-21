import "server-only";
import { redirect } from "next/navigation";
import { hasLocale, localizedPath, type Locale } from "@/i18n/config";
import { routes } from "@/lib/navigation";
import { can, type Permission } from "@/lib/admin/permissions";
import type { FormMessage } from "@/lib/admin/forms";
import { getCurrentUser } from "@/lib/server/auth";
import type { StaffUser } from "@/lib/server/accounts";

/*
 * Helpers for the dashboard's Server Actions. Not an action module itself
 * ("use server" files may only export actions).
 */

export function localeFrom(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "");
  return hasLocale(value) ? value : "mn";
}

/**
 * The signed-in user if they hold `permission`; null if they don't. Without a
 * session at all (expired, signed out elsewhere) this redirects to sign-in.
 */
export async function permitted(permission: Permission, formData: FormData): Promise<StaffUser | null> {
  const user = await getCurrentUser();
  if (!user) redirect(localizedPath(localeFrom(formData), routes.adminLogin));
  return can(user, permission) ? user : null;
}

export const bookingErrorMessage: Record<string, FormMessage> = {
  not_found: "notFound",
  not_active: "notActive",
  barber_unavailable: "barberUnavailable",
  in_past: "inPast",
  outside_hours: "outsideHours",
  time_off: "timeOff",
  slot_taken: "slotTaken",
  invalid_transition: "invalidTransition",
  taken: "invalid",
  in_use: "inUse",
  invalid_image: "invalid",
  invalid_category: "invalid",
  self_change: "selfChange",
  last_admin: "lastAdmin",
  barber_required: "invalid",
  barber_taken: "invalid",
};
