import "server-only";
import type { UserRole } from "@/generated/prisma/enums";
import type { Db } from "./db";
import { getDummyHash, hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "./password";

/*
 * Staff account rules, independent of Next.js so scripts and tests can use them.
 * After MAX_FAILED_LOGINS wrong passwords an account is locked for LOCK_MINUTES.
 * Failures never say whether the email exists.
 */

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** The barber profile linked to this login, if any. */
  barberId: string | null;
}

export type AuthResult = { ok: true; user: StaffUser } | { ok: false; reason: "invalid" | "locked" };

export async function authenticate(db: Db, emailInput: string, password: string, now = new Date()): Promise<AuthResult> {
  const email = emailInput.trim().toLowerCase();
  const user = email
    ? await db.user.findUnique({ where: { email }, include: { barber: { select: { id: true } } } })
    : null;

  if (!user || !user.active) {
    await verifyPassword(password, await getDummyHash());
    return { ok: false, reason: "invalid" };
  }
  if (user.lockedUntil && user.lockedUntil > now) return { ok: false, reason: "locked" };

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failures = user.failedLogins + 1;
    const lock = failures >= MAX_FAILED_LOGINS;
    await db.user.update({
      where: { id: user.id },
      data: lock
        ? { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) }
        : { failedLogins: failures },
    });
    return { ok: false, reason: lock ? "locked" : "invalid" };
  }

  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: now } });
  return {
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, barberId: user.barber?.id ?? null },
  };
}

export async function createStaffUser(
  db: Db,
  input: { email: string; name: string; password: string; role: UserRole },
): Promise<StaffUser> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A valid email address is required.");
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  const user = await db.user.create({
    data: { email, name: input.name.trim() || email, role: input.role, passwordHash: await hashPassword(input.password) },
  });
  return { id: user.id, name: user.name, email: user.email, role: user.role, barberId: null };
}

const rank: Record<UserRole, number> = { BARBER: 1, STAFF: 2, ADMIN: 3 };

/**
 * ADMIN can do everything STAFF can, and STAFF everything a BARBER can (except
 * that a BARBER's access is scoped to their own appointments). For finer checks
 * use `can()` from `lib/admin/permissions.ts`.
 */
export function hasRole(user: Pick<StaffUser, "role">, required: UserRole): boolean {
  return rank[user.role] >= rank[required];
}
