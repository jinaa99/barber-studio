import type { UserRole } from "@/generated/prisma/enums";

/*
 * Role-based permissions for the staff dashboard. Pure, so the server (the
 * authority) and the admin UI (which only hides what a role can't use) share
 * one definition.
 *
 *   ADMIN   owner or manager: everything.
 *   STAFF   front desk: every appointment and customer, creates and reschedules
 *           bookings. No revenue, analytics, catalogue, team or settings.
 *   BARBER  a barber's own login: their own appointments only (status updates),
 *           customer names and notes on those appointments, no phone numbers,
 *           no business financials.
 */

export type Permission =
  /** See every barber's appointments (otherwise only the linked barber's). */
  | "appointments.viewAll"
  /** Create and reschedule appointments. */
  | "appointments.manage"
  /** Confirm, complete, cancel, mark no-show (scoped by `appointments.viewAll`). */
  | "appointments.updateStatus"
  /** Customer records and contact details. */
  | "customers.view"
  /** Revenue, booked value and analytics. */
  | "finance.view"
  /** Services, categories, barbers, schedules and time off. */
  | "catalog.manage"
  /** Staff accounts. */
  | "staff.manage"
  /** Booking rules and website content. */
  | "settings.manage"
  /** The audit log. */
  | "audit.view";

const grants: Record<UserRole, readonly Permission[]> = {
  ADMIN: [
    "appointments.viewAll",
    "appointments.manage",
    "appointments.updateStatus",
    "customers.view",
    "finance.view",
    "catalog.manage",
    "staff.manage",
    "settings.manage",
    "audit.view",
  ],
  STAFF: ["appointments.viewAll", "appointments.manage", "appointments.updateStatus", "customers.view"],
  BARBER: ["appointments.updateStatus"],
};

export interface PermissionSubject {
  role: UserRole;
  /** The barber profile linked to this login, if any. */
  barberId: string | null;
}

export function can(user: Pick<PermissionSubject, "role">, permission: Permission): boolean {
  return grants[user.role].includes(permission);
}

export function permissionsOf(role: UserRole): readonly Permission[] {
  return grants[role];
}

/**
 * Which barbers' appointments `user` may see: `"all"`, one barber id, or
 * `null` for none (a BARBER login with no linked profile).
 */
export function appointmentScope(user: PermissionSubject): "all" | string | null {
  if (can(user, "appointments.viewAll")) return "all";
  return user.role === "BARBER" ? user.barberId : null;
}

/** Whether `user` may act on an appointment that belongs to `barberId`. */
export function canAccessBarber(user: PermissionSubject, barberId: string): boolean {
  const scope = appointmentScope(user);
  return scope === "all" || scope === barberId;
}
