"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { AppointmentStatus } from "@/generated/prisma/enums";
import { hasLocale, localizedPath, type Locale } from "@/i18n/config";
import { routes } from "@/lib/navigation";
import { catalogTag } from "@/lib/data";
import { db } from "@/lib/server/db";
import { authenticate } from "@/lib/server/accounts";
import { audit } from "@/lib/server/audit";
import { authorize, endSession, startSession } from "@/lib/server/auth";
import { changeAppointmentStatus } from "@/lib/server/appointments";
import { clientAddress, rateLimit } from "@/lib/server/rate-limit";

/*
 * Every action authorizes itself against the session in the database.
 * The admin UI hides what a role can't do, but that is only a convenience.
 */

export type AdminNotice = "forbidden" | "invalidTransition" | "generic";

function localeFrom(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "");
  return hasLocale(value) ? value : "mn";
}

/** Only ever return to the admin dashboard of the same locale (no open redirects). */
function backTo(formData: FormData, locale: Locale, notice?: AdminNotice): never {
  const base = localizedPath(locale, routes.admin);
  const requested = String(formData.get("returnTo") ?? "");
  const url = new URL(requested.startsWith(`${base}?`) || requested === base ? requested : base, "http://local");
  if (notice) url.searchParams.set("notice", notice);
  else url.searchParams.delete("notice");
  redirect(`${url.pathname}${url.search}`);
}

export interface LoginState {
  error: "invalid" | "locked" | "rateLimited" | null;
}

export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const locale = localeFrom(formData);
  const email = String(formData.get("email") ?? "").slice(0, 254);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  const requestHeaders = await headers();

  if (!rateLimit(`login:${clientAddress(requestHeaders)}`, 10, 15 * 60_000)) return { error: "rateLimited" };

  const result = await authenticate(db, email, password);
  if (!result.ok) {
    await audit(db, {
      actorId: null,
      action: "auth.login_failed",
      entityType: "User",
      metadata: { email: email.trim().toLowerCase(), reason: result.reason },
    });
    return { error: result.reason };
  }

  await startSession(result.user.id, requestHeaders.get("user-agent"));
  await audit(db, { actorId: result.user.id, action: "auth.login", entityType: "User", entityId: result.user.id });
  redirect(localizedPath(locale, routes.admin));
}

export async function logoutAction(formData: FormData) {
  const locale = localeFrom(formData);
  const userId = await endSession();
  if (userId) await audit(db, { actorId: userId, action: "auth.logout", entityType: "User", entityId: userId });
  redirect(localizedPath(locale, routes.adminLogin));
}

export async function changeStatusAction(formData: FormData) {
  const locale = localeFrom(formData);
  const user = await authorize("STAFF");
  if (!user) redirect(localizedPath(locale, routes.adminLogin));

  const appointmentId = String(formData.get("appointmentId") ?? "");
  const to = String(formData.get("status") ?? "");
  if (!appointmentId || !(to in AppointmentStatus)) backTo(formData, locale, "generic");

  const result = await changeAppointmentStatus(db, {
    appointmentId,
    to: to as AppointmentStatus,
    actorId: user.id,
  });
  backTo(formData, locale, result.ok ? undefined : "invalidTransition");
}

export async function setServiceActiveAction(formData: FormData) {
  const locale = localeFrom(formData);
  const user = await authorize("ADMIN");
  if (!user) {
    // Signed in without the role, or not signed in at all.
    if (!(await authorize("STAFF"))) redirect(localizedPath(locale, routes.adminLogin));
    backTo(formData, locale, "forbidden");
  }

  const serviceId = String(formData.get("serviceId") ?? "");
  const active = formData.get("active") === "true";
  const updated = await db.service.updateMany({ where: { id: serviceId }, data: { active } });
  if (updated.count === 0) backTo(formData, locale, "generic");

  await audit(db, {
    actorId: user.id,
    action: active ? "service.activated" : "service.deactivated",
    entityType: "Service",
    entityId: serviceId,
  });
  updateTag(catalogTag);
  backTo(formData, locale);
}
