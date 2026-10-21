import "server-only";
import type { Locale } from "@/i18n/config";
import { appointmentScope, can, type Permission } from "@/lib/admin/permissions";
import { zonedParts } from "@/lib/booking/time";
import { requireUser } from "./auth";
import { db } from "./db";
import { getBookingRules } from "./settings";
import type { StaffUser } from "./accounts";
import type { Scope } from "./appointments";

export interface AdminContext {
  user: StaffUser;
  scope: Scope;
  /** Studio time zone and today's date in it. */
  timeZone: string;
  today: string;
  now: Date;
  can: (permission: Permission) => boolean;
}

/**
 * Everything an admin page needs to start rendering: the signed-in user (or a
 * redirect to sign-in), their appointment scope and the studio's "today".
 * Call it inside a <Suspense> boundary: it reads the session cookie, and only
 * after that may the current time be read.
 */
export async function adminContext(locale: Locale): Promise<AdminContext> {
  const user = await requireUser(locale);
  const now = new Date();
  const { timeZone } = await getBookingRules(db);
  return {
    user,
    scope: appointmentScope(user),
    timeZone,
    today: zonedParts(now, timeZone).date,
    now,
    can: (permission) => can(user, permission),
  };
}
