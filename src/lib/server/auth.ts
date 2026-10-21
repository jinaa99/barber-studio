import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { localizedPath, type Locale } from "@/i18n/config";
import { routes } from "@/lib/navigation";
import { db } from "./db";
import { can, type Permission } from "@/lib/admin/permissions";
import type { StaffUser } from "./accounts";

/*
 * Staff sessions. The browser holds a random 256-bit token in an httpOnly
 * cookie; the database keeps only its SHA-256 hash, so a leaked sessions
 * table can't be replayed. Every admin page and Server Action calls
 * `requireUser` / `authorize` itself: hiding a button is never the check.
 */

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** `__Host-` pins the cookie to this origin over HTTPS; it can't be used on plain-HTTP localhost. */
const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-studio08_session" : "studio08_session";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function startSession(userId: string, userAgent: string | null): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt, userAgent: userAgent?.slice(0, 300) } });
  // Opportunistic cleanup of this user's expired sessions.
  await db.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, select: { userId: true } });
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  return session?.userId ?? null;
}

/** The signed-in staff member for this request, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<StaffUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, active: true, barber: { select: { id: true } } } },
    },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.active) return null;
  const { id, name, email, role, barber } = session.user;
  return { id, name, email, role, barberId: barber?.id ?? null };
});

/** For pages: the signed-in user, or a redirect to the login screen. */
export async function requireUser(locale: Locale): Promise<StaffUser> {
  const user = await getCurrentUser();
  if (!user) redirect(localizedPath(locale, routes.adminLogin));
  return user;
}

/** For Server Actions: the signed-in user if they hold `permission` (or are signed in at all), otherwise null. */
export async function authorize(permission?: Permission): Promise<StaffUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return !permission || can(user, permission) ? user : null;
}
