import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import type { Db } from "./db";
import { addCalendarDays, isISODate, parseTime, zonedParts, zonedTimeToUtc } from "@/lib/booking/time";
import { computeSlots, isBarberFree, type BookingRules } from "@/lib/booking/availability";
import { canTransition } from "@/lib/booking/status";
import { LIMITS, normalizePhone } from "@/lib/booking/validation";
import type { TimeSlot } from "@/lib/booking/types";
import type { RescheduleInput, StaffAppointmentInput } from "@/lib/admin/schemas";
import { audit } from "./audit";
import { generateReference, isOverlapViolation, loadBarberDays } from "./booking";
import { deliverNotification, type EmailProvider } from "./notifications";
import { getBookingRules } from "./settings";

/*
 * Staff-side appointment queries and changes. Callers authorize first and pass
 * the user's appointment scope (`"all"`, one barber id, or null for none);
 * every query and mutation here applies it, so a BARBER login can never read
 * or change another barber's appointments, whatever the UI sends.
 *
 * Creating and rescheduling follow the same protections as online booking
 * (docs/BOOKING.md): lock the barber rows, recompute availability inside the
 * transaction, and let the `appointments_no_overlap` constraint have the last
 * word. Staff may book outside the online booking horizon and minimum notice,
 * and above the per-phone limit, but never in the past, outside working hours,
 * during time off or over another active appointment.
 */

type Tx = Prisma.TransactionClient;
export type Scope = "all" | string | null;

/** Prisma filter for a scope. `null` matches nothing. */
export function scopeWhere(scope: Scope): Prisma.AppointmentWhereInput {
  if (scope === "all") return {};
  return scope ? { barberId: scope } : { barberId: { in: [] } };
}

/** Furthest ahead staff can book. */
const STAFF_HORIZON_DAYS = 365;

/* -------------------------------------------------------------------------- */
/*                                   Queries                                  */
/* -------------------------------------------------------------------------- */

export const appointmentListSelect = {
  id: true,
  reference: true,
  startsAt: true,
  endsAt: true,
  status: true,
  isDemo: true,
  source: true,
  priceMnt: true,
  customerName: true,
  barberId: true,
  serviceId: true,
  service: { select: { name: true } },
  barber: { select: { name: true } },
} satisfies Prisma.AppointmentSelect;

export type AppointmentListRow = Prisma.AppointmentGetPayload<{ select: typeof appointmentListSelect }>;

export interface AppointmentFilters {
  scope: Scope;
  includeDemo: boolean;
  /** Studio-zone dates, inclusive. */
  from?: string;
  to?: string;
  barberId?: string;
  status?: AppointmentStatus;
  /** Reference, customer name or phone digits. */
  q?: string;
}

function filtersWhere(filters: AppointmentFilters, timeZone: string): Prisma.AppointmentWhereInput {
  const and: Prisma.AppointmentWhereInput[] = [scopeWhere(filters.scope)];
  if (!filters.includeDemo) and.push({ isDemo: false });
  if (filters.from && isISODate(filters.from)) and.push({ startsAt: { gte: zonedTimeToUtc(filters.from, 0, timeZone) } });
  if (filters.to && isISODate(filters.to)) {
    and.push({ startsAt: { lt: zonedTimeToUtc(addCalendarDays(filters.to, 1), 0, timeZone) } });
  }
  if (filters.barberId) and.push({ barberId: filters.barberId });
  if (filters.status) and.push({ status: filters.status });
  const q = filters.q?.trim().slice(0, 80);
  if (q) {
    const digits = normalizePhone(q);
    and.push({
      OR: [
        { reference: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
        ...(/^\d{3,}$/.test(digits) && filters.scope === "all" ? [{ customer: { phone: { contains: digits } } }] : []),
      ],
    });
  }
  return { AND: and };
}

/** Every appointment between two dates (calendar views). Capped; the list view paginates. */
export async function listAppointmentsBetween(db: Db, filters: AppointmentFilters & { from: string; to: string }) {
  const { timeZone } = await getBookingRules(db);
  return db.appointment.findMany({
    where: filtersWhere(filters, timeZone),
    orderBy: [{ startsAt: "asc" }, { barberId: "asc" }],
    select: appointmentListSelect,
    take: 2000,
  });
}

export async function listAppointmentsPage(db: Db, filters: AppointmentFilters, page: number, pageSize = 25) {
  const { timeZone } = await getBookingRules(db);
  const where = filtersWhere(filters, timeZone);
  const [total, rows] = await Promise.all([
    db.appointment.count({ where }),
    db.appointment.findMany({
      where,
      orderBy: [{ startsAt: "desc" }, { id: "asc" }],
      select: appointmentListSelect,
      skip: (Math.max(1, page) - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { total, rows, page: Math.max(1, page), pageSize };
}

/** Kept for the Phase 03 integration tests and scripts. */
export async function listAppointmentsForDay(db: Db, date: string, options: { includeDemo: boolean }) {
  return listAppointmentsBetween(db, { scope: "all", includeDemo: options.includeDemo, from: date, to: date });
}

/**
 * One appointment with what the detail view needs. Contact details are only
 * included for scopes that may see every customer (`withContact`).
 */
export async function getAppointmentDetail(db: Db, id: string, scope: Scope, withContact: boolean) {
  const row = await db.appointment.findFirst({
    where: { AND: [{ id }, scopeWhere(scope)] },
    select: {
      ...appointmentListSelect,
      notes: true,
      cancelReason: true,
      statusChangedAt: true,
      createdAt: true,
      durationMinutes: true,
      customerEmail: true,
      customerId: true,
      locale: true,
      customer: { select: { phone: true } },
      notifications: { select: { type: true, channel: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!row) return null;
  const history = await db.auditLog.findMany({
    where: { entityType: "Appointment", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, action: true, metadata: true, createdAt: true, actor: { select: { name: true } } },
  });
  if (withContact) return { ...row, history };
  return { ...row, customerEmail: null, customer: { phone: null as string | null }, history };
}

/** Recently created or changed appointments, newest first. */
export async function recentAppointmentActivity(db: Db, scope: Scope, includeDemo: boolean, take = 8) {
  return db.appointment.findMany({
    where: { AND: [scopeWhere(scope), includeDemo ? {} : { isDemo: false }] },
    orderBy: { updatedAt: "desc" },
    take,
    select: { ...appointmentListSelect, createdAt: true, updatedAt: true, statusChangedAt: true },
  });
}

/* -------------------------------------------------------------------------- */
/*                               Status changes                               */
/* -------------------------------------------------------------------------- */

export type StatusChangeResult = { ok: true } | { ok: false; error: "not_found" | "invalid_transition" };

/**
 * Move an appointment to `to` if the lifecycle allows it. The row is locked
 * so two staff members clicking at once can't apply conflicting changes.
 * Appointments outside `scope` are reported as not found.
 */
export async function changeAppointmentStatus(
  db: Db,
  input: { appointmentId: string; to: AppointmentStatus; actorId: string; reason?: string; scope?: Scope },
  now = new Date(),
): Promise<StatusChangeResult> {
  const scope = input.scope ?? "all";
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string; status: AppointmentStatus; startsAt: Date; barberId: string }[]>`
      SELECT "id", "status", "startsAt", "barberId" FROM "appointments" WHERE "id" = ${input.appointmentId} FOR UPDATE`;
    const current = locked[0];
    if (!current || (scope !== "all" && current.barberId !== scope)) return { ok: false, error: "not_found" } as const;
    if (!canTransition(current.status, input.to, current.startsAt, now)) return { ok: false, error: "invalid_transition" } as const;

    const reason = input.to === "CANCELLED" ? input.reason?.trim().slice(0, 300) || null : undefined;
    await tx.appointment.update({
      where: { id: current.id },
      data: { status: input.to, statusChangedAt: now, ...(reason !== undefined ? { cancelReason: reason } : {}) },
    });
    await audit(tx, {
      actorId: input.actorId,
      action: "appointment.status_changed",
      entityType: "Appointment",
      entityId: current.id,
      metadata: { from: current.status, to: input.to, ...(reason ? { reason } : {}) },
    });
    return { ok: true } as const;
  });
}

/* -------------------------------------------------------------------------- */
/*                         Staff availability and booking                     */
/* -------------------------------------------------------------------------- */

export type StaffBookingError =
  | "not_found"
  | "not_active"
  | "barber_unavailable"
  | "in_past"
  | "outside_hours"
  | "time_off"
  | "slot_taken"
  | "invalid_transition";

export type StaffBookingResult = { ok: true; appointmentId: string; reference: string } | { ok: false; error: StaffBookingError };

/** The studio rules, relaxed for staff: no minimum notice, a year ahead. */
function staffRules(rules: BookingRules): BookingRules {
  return { ...rules, minLeadMinutes: 0, bookingHorizonDays: STAFF_HORIZON_DAYS };
}

/**
 * Free start times for staff on `date` (on the slot grid). `excludeAppointmentId`
 * frees an appointment's own time while it is being rescheduled.
 */
export async function staffSlots(
  db: Db,
  query: { serviceId: string; barberId: string; date: string; excludeAppointmentId?: string },
  now = new Date(),
): Promise<TimeSlot[]> {
  if (!isISODate(query.date)) return [];
  const [rules, service, barber] = await Promise.all([
    getBookingRules(db),
    db.service.findUnique({ where: { id: query.serviceId }, select: { durationMinutes: true } }),
    db.barber.findFirst({
      where: { id: query.barberId, active: true, services: { some: { serviceId: query.serviceId } } },
      select: { id: true },
    }),
  ]);
  if (!service || !barber) return [];
  const relaxed = staffRules(rules);
  const days = await loadBarberDays(db, query.date, [barber.id], relaxed, query.excludeAppointmentId);
  return computeSlots({ date: query.date, durationMinutes: service.durationMinutes, barbers: days, rules: relaxed, now });
}

/**
 * Why `barberId` can't take `durationMinutes` at `startsAt`, or null if they can.
 * Must run inside a transaction that holds the barber's row lock.
 */
async function checkStaffSlot(
  tx: Tx,
  input: { barberId: string; date: string; startMinute: number; durationMinutes: number; excludeAppointmentId?: string },
  rules: BookingRules,
  now: Date,
): Promise<StaffBookingError | null> {
  const startsAt = zonedTimeToUtc(input.date, input.startMinute, rules.timeZone);
  if (startsAt.getTime() < now.getTime()) return "in_past";
  const today = zonedParts(now, rules.timeZone).date;
  if (input.date > addCalendarDays(today, STAFF_HORIZON_DAYS)) return "outside_hours";

  const relaxed = staffRules(rules);
  const [day] = await loadBarberDays(tx, input.date, [input.barberId], relaxed, input.excludeAppointmentId);
  const query = { date: input.date, durationMinutes: input.durationMinutes, barbers: [day], rules: relaxed, now };
  const end = input.startMinute + input.durationMinutes;
  if (!day.blocks.some((b) => input.startMinute >= b.startMinute && end <= b.endMinute)) return "outside_hours";

  const interval = { start: startsAt.getTime(), end: startsAt.getTime() + input.durationMinutes * 60_000 };
  if (day.timeOff.some((t) => t.start < interval.end && interval.start < t.end)) return "time_off";
  if (!isBarberFree(day, input.startMinute, query)) return "slot_taken";
  return null;
}

async function lockBarbers(tx: Tx, barberIds: string[]) {
  const ids = [...new Set(barberIds)].sort();
  await tx.$queryRaw`SELECT "id" FROM "barbers" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`;
}

class Rejected extends Error {
  constructor(readonly code: StaffBookingError) {
    super(code);
  }
}

const transactionOptions = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10_000, timeout: 15_000 };

function mapError(error: unknown): StaffBookingResult {
  if (error instanceof Rejected) return { ok: false, error: error.code };
  if (isOverlapViolation(error)) return { ok: false, error: "slot_taken" };
  throw error;
}

/** A booking entered by staff (phone, walk-in). Source ADMIN, audited. */
export async function createStaffAppointment(
  db: Db,
  input: StaffAppointmentInput & { actorId: string; locale: string },
  options: { now?: Date; emailProvider?: EmailProvider | null } = {},
): Promise<StaffBookingResult> {
  const now = options.now ?? new Date();
  const startMinute = parseTime(input.time)!;
  const phone = normalizePhone(input.customer.phone);
  const name = input.customer.name.trim();
  const email = input.customer.email.trim().toLowerCase() || null;
  const notes = input.customer.notes.trim().slice(0, LIMITS.notes) || null;

  let created: { appointmentId: string; reference: string; notificationId: string | null };
  try {
    created = await db.$transaction(async (tx) => {
      const rules = await getBookingRules(tx);
      const service = await tx.service.findUnique({ where: { id: input.serviceId } });
      if (!service) throw new Rejected("not_found");
      if (!service.active) throw new Rejected("not_active");
      const barber = await tx.barber.findUnique({
        where: { id: input.barberId },
        select: { id: true, active: true, services: { where: { serviceId: service.id }, select: { serviceId: true } } },
      });
      if (!barber) throw new Rejected("not_found");
      if (!barber.active || barber.services.length === 0) throw new Rejected("barber_unavailable");

      await lockBarbers(tx, [barber.id]);
      const problem = await checkStaffSlot(
        tx,
        { barberId: barber.id, date: input.date, startMinute, durationMinutes: service.durationMinutes },
        rules,
        now,
      );
      if (problem) throw new Rejected(problem);

      const startsAt = zonedTimeToUtc(input.date, startMinute, rules.timeZone);
      const customer = await tx.customer.upsert({ where: { phone }, create: { phone, name, email }, update: {} });

      let reference = generateReference();
      while (await tx.appointment.findUnique({ where: { reference }, select: { id: true } })) reference = generateReference();

      const appointment = await tx.appointment.create({
        data: {
          reference,
          serviceId: service.id,
          barberId: barber.id,
          customerId: customer.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + service.durationMinutes * 60_000),
          status: input.status,
          statusChangedAt: now,
          source: "ADMIN",
          priceMnt: service.priceMnt,
          durationMinutes: service.durationMinutes,
          customerName: name,
          customerEmail: email,
          notes,
          locale: input.locale === "en" ? "en" : "mn",
        },
      });
      const notification =
        email && input.notify
          ? await tx.notification.create({
              data: { appointmentId: appointment.id, channel: "EMAIL", type: "BOOKING_CONFIRMATION", recipient: email },
            })
          : null;
      await audit(tx, {
        actorId: input.actorId,
        action: "appointment.created",
        entityType: "Appointment",
        entityId: appointment.id,
        metadata: { reference, status: input.status, barberId: barber.id, serviceId: service.id, startsAt: startsAt.toISOString() },
      });
      return { appointmentId: appointment.id, reference, notificationId: notification?.id ?? null };
    }, transactionOptions);
  } catch (error) {
    return mapError(error);
  }

  if (created.notificationId) {
    await deliverNotification(db, created.notificationId, options.emailProvider).catch((error) => {
      console.error("[appointments] confirmation email delivery threw", error);
    });
  }
  return { ok: true, appointmentId: created.appointmentId, reference: created.reference };
}

/**
 * Move an active appointment to another time and/or barber. Both barbers'
 * rows and the appointment's row are locked; the old slot is released and the
 * new one checked in the same transaction.
 */
export async function rescheduleAppointment(
  db: Db,
  input: RescheduleInput & { actorId: string; scope: Scope },
  options: { now?: Date; emailProvider?: EmailProvider | null } = {},
): Promise<StaffBookingResult> {
  const now = options.now ?? new Date();
  const startMinute = parseTime(input.time)!;

  let result: { appointmentId: string; reference: string; notificationId: string | null };
  try {
    result = await db.$transaction(async (tx) => {
      const rules = await getBookingRules(tx);
      const existing = await tx.appointment.findFirst({
        where: { AND: [{ id: input.appointmentId }, scopeWhere(input.scope)] },
        select: { id: true, barberId: true, serviceId: true, durationMinutes: true, customerEmail: true, startsAt: true, reference: true },
      });
      if (!existing) throw new Rejected("not_found");
      // A barber login may only move appointments within their own column.
      if (input.scope !== "all" && input.barberId !== existing.barberId) throw new Rejected("not_found");

      const barber = await tx.barber.findUnique({
        where: { id: input.barberId },
        select: { id: true, active: true, services: { where: { serviceId: existing.serviceId }, select: { serviceId: true } } },
      });
      if (!barber) throw new Rejected("not_found");
      if (!barber.active || barber.services.length === 0) throw new Rejected("barber_unavailable");

      await lockBarbers(tx, [existing.barberId, barber.id]);
      const [locked] = await tx.$queryRaw<{ status: AppointmentStatus }[]>`
        SELECT "status" FROM "appointments" WHERE "id" = ${existing.id} FOR UPDATE`;
      if (locked.status !== "PENDING" && locked.status !== "CONFIRMED") throw new Rejected("invalid_transition");

      const problem = await checkStaffSlot(
        tx,
        {
          barberId: barber.id,
          date: input.date,
          startMinute,
          durationMinutes: existing.durationMinutes,
          excludeAppointmentId: existing.id,
        },
        rules,
        now,
      );
      if (problem) throw new Rejected(problem);

      const startsAt = zonedTimeToUtc(input.date, startMinute, rules.timeZone);
      await tx.appointment.update({
        where: { id: existing.id },
        data: { barberId: barber.id, startsAt, endsAt: new Date(startsAt.getTime() + existing.durationMinutes * 60_000) },
      });
      const notification =
        existing.customerEmail && input.notify
          ? await tx.notification.create({
              data: { appointmentId: existing.id, channel: "EMAIL", type: "BOOKING_CONFIRMATION", recipient: existing.customerEmail },
            })
          : null;
      await audit(tx, {
        actorId: input.actorId,
        action: "appointment.rescheduled",
        entityType: "Appointment",
        entityId: existing.id,
        metadata: {
          from: { barberId: existing.barberId, startsAt: existing.startsAt.toISOString() },
          to: { barberId: barber.id, startsAt: startsAt.toISOString() },
        },
      });
      return { appointmentId: existing.id, reference: existing.reference, notificationId: notification?.id ?? null };
    }, transactionOptions);
  } catch (error) {
    return mapError(error);
  }

  if (result.notificationId) {
    await deliverNotification(db, result.notificationId, options.emailProvider).catch((error) => {
      console.error("[appointments] reschedule email delivery threw", error);
    });
  }
  return { ok: true, appointmentId: result.appointmentId, reference: result.reference };
}
