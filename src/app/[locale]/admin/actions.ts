"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasLocale, localizedPath, type Locale } from "@/i18n/config";
import { routes } from "@/lib/navigation";
import { db } from "@/lib/server/db";
import { authenticate } from "@/lib/server/accounts";
import { audit } from "@/lib/server/audit";
import { endSession, startSession } from "@/lib/server/auth";
import { clientAddress, rateLimit } from "@/lib/server/rate-limit";

/*
 * Sign-in and sign-out. Dashboard actions live in ./actions/, and each one
 * authorizes itself against the session in the database.
 */

function localeFrom(formData: FormData): Locale {
  const value = String(formData.get("locale") ?? "");
  return hasLocale(value) ? value : "mn";
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
