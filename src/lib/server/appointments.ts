import "server-only";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import type { Db } from "./db";
import { addCalendarDays, zonedTimeToUtc } from "@/lib/booking/time";
import { canTransition } from "@/lib/booking/status";
import { audit } from "./audit";
import { getBookingRules } from "./settings";

/* Staff-side appointment queries and updates. Callers must authorize first. */

export async function listAppointmentsForDay(db: Db, date: string, options: { includeDemo: boolean }) {
  const { timeZone } = await getBookingRules(db);
  return db.appointment.findMany({
    where: {
      startsAt: { gte: zonedTimeToUtc(date, 0, timeZone), lt: zonedTimeToUtc(addCalendarDays(date, 1), 0, timeZone) },
      ...(options.includeDemo ? {} : { isDemo: false }),
    },
    orderBy: [{ startsAt: "asc" }, { barberId: "asc" }],
    select: {
      id: true,
      reference: true,
      startsAt: true,
      endsAt: true,
      status: true,
      isDemo: true,
      source: true,
      notes: true,
      customerName: true,
      customerEmail: true,
      priceMnt: true,
      service: { select: { name: true } },
      barber: { select: { name: true } },
      customer: { select: { phone: true } },
      notifications: { select: { channel: true, status: true }, orderBy: { createdAt: "desc" } },
    },
  });
}

export type StatusChangeResult = { ok: true } | { ok: false; error: "not_found" | "invalid_transition" };

/**
 * Move an appointment to `to` if the lifecycle allows it. The row is locked
 * so two staff members clicking at once can't apply conflicting changes.
 */
export async function changeAppointmentStatus(
  db: Db,
  input: { appointmentId: string; to: AppointmentStatus; actorId: string; reason?: string },
  now = new Date(),
): Promise<StatusChangeResult> {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string; status: AppointmentStatus; startsAt: Date }[]>`
      SELECT "id", "status", "startsAt" FROM "appointments" WHERE "id" = ${input.appointmentId} FOR UPDATE`;
    const current = locked[0];
    if (!current) return { ok: false, error: "not_found" } as const;
    if (!canTransition(current.status, input.to, current.startsAt, now)) return { ok: false, error: "invalid_transition" } as const;

    await tx.appointment.update({
      where: { id: current.id },
      data: {
        status: input.to,
        statusChangedAt: now,
        ...(input.to === "CANCELLED" ? { cancelReason: input.reason?.slice(0, 300) || null } : {}),
      },
    });
    await audit(tx, {
      actorId: input.actorId,
      action: "appointment.status_changed",
      entityType: "Appointment",
      entityId: current.id,
      metadata: { from: current.status, to: input.to },
    });
    return { ok: true } as const;
  });
}
