import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { UserRole } from "@/generated/prisma/enums";
import type { Db } from "./db";
import { audit } from "./audit";
import { createStaffUser } from "./accounts";
import { hashPassword } from "./password";

/*
 * Staff account management (`staff.manage`, ADMIN only). Guards:
 *  - nobody changes their own role or deactivates themself here;
 *  - the last active ADMIN can't be demoted or deactivated;
 *  - a BARBER login must be linked to a barber profile (that link is its scope);
 *  - deactivating or resetting a password ends that user's sessions.
 */

export type StaffError = "taken" | "not_found" | "self_change" | "last_admin" | "barber_required" | "barber_taken";
export type StaffResult = { ok: true; userId: string } | { ok: false; error: StaffError };

export async function listStaff(db: Db) {
  return db.user.findMany({
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      lastLoginAt: true,
      lockedUntil: true,
      barber: { select: { id: true, name: true } },
    },
  });
}

async function linkBarber(tx: Prisma.TransactionClient, userId: string, barberId: string | null) {
  await tx.barber.updateMany({ where: { userId, ...(barberId ? { id: { not: barberId } } : {}) }, data: { userId: null } });
  if (!barberId) return true;
  const barber = await tx.barber.findUnique({ where: { id: barberId }, select: { userId: true } });
  if (!barber) return false;
  if (barber.userId && barber.userId !== userId) throw new BarberTaken();
  await tx.barber.update({ where: { id: barberId }, data: { userId } });
  return true;
}

class BarberTaken extends Error {}

export async function createAccount(
  db: Db,
  input: { name: string; email: string; role: UserRole; password: string; barberId: string },
  actorId: string,
): Promise<StaffResult> {
  if (input.role === "BARBER" && !input.barberId) return { ok: false, error: "barber_required" };
  if (await db.user.findUnique({ where: { email: input.email.trim().toLowerCase() }, select: { id: true } })) {
    return { ok: false, error: "taken" };
  }
  try {
    const user = await createStaffUser(db, input);
    await db.$transaction(async (tx) => {
      if (input.barberId) await linkBarber(tx, user.id, input.barberId);
      await audit(tx, {
        actorId,
        action: "user.created",
        entityType: "User",
        entityId: user.id,
        metadata: { email: user.email, role: user.role, barberId: input.barberId || null },
      });
    });
    return { ok: true, userId: user.id };
  } catch (error) {
    if (error instanceof BarberTaken) return { ok: false, error: "barber_taken" };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { ok: false, error: "taken" };
    throw error;
  }
}

export async function updateAccount(
  db: Db,
  input: { userId: string; role: UserRole; active: boolean; barberId: string },
  actorId: string,
): Promise<StaffResult> {
  if (input.role === "BARBER" && !input.barberId) return { ok: false, error: "barber_required" };
  try {
    return await db.$transaction(async (tx) => {
      // Serialize admin changes so two admins can't demote each other at once.
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "role" = 'ADMIN' ORDER BY "id" FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true, role: true, active: true } });
      if (!user) return { ok: false, error: "not_found" } as const;
      const changesAccess = user.role !== input.role || user.active !== input.active;
      if (user.id === actorId && changesAccess) return { ok: false, error: "self_change" } as const;
      const losesAdmin = user.role === "ADMIN" && user.active && (input.role !== "ADMIN" || !input.active);
      if (losesAdmin && (await tx.user.count({ where: { role: "ADMIN", active: true } })) <= 1) {
        return { ok: false, error: "last_admin" } as const;
      }

      await tx.user.update({ where: { id: user.id }, data: { role: input.role, active: input.active } });
      if (!(await linkBarber(tx, user.id, input.barberId || null))) return { ok: false, error: "not_found" } as const;
      if (!input.active || user.role !== input.role) await tx.session.deleteMany({ where: { userId: user.id } });
      await audit(tx, {
        actorId,
        action: "user.updated",
        entityType: "User",
        entityId: user.id,
        metadata: { from: { role: user.role, active: user.active }, to: { role: input.role, active: input.active }, barberId: input.barberId || null },
      });
      return { ok: true, userId: user.id } as const;
    });
  } catch (error) {
    if (error instanceof BarberTaken) return { ok: false, error: "barber_taken" };
    throw error;
  }
}

export async function resetPassword(db: Db, input: { userId: string; password: string }, actorId: string): Promise<StaffResult> {
  const user = await db.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) return { ok: false, error: "not_found" };
  const passwordHash = await hashPassword(input.password);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, failedLogins: 0, lockedUntil: null } });
    // Other people's sessions end at once; an admin resetting their own keeps the current one.
    if (user.id !== actorId) await tx.session.deleteMany({ where: { userId: user.id } });
  });
  await audit(db, { actorId, action: "user.password_reset", entityType: "User", entityId: user.id });
  return { ok: true, userId: user.id };
}
