import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { Db } from "./db";
import { locales } from "@/i18n/config";
import { computeSlots, type BarberDay, type BookingRules } from "@/lib/booking/availability";
import { ACTIVE_STATUSES } from "@/lib/booking/status";
import { addCalendarDays, isISODate, isoWeekday, parseTime, zonedParts, zonedTimeToUtc } from "@/lib/booking/time";
import { minutesToTime } from "@/lib/booking/dates";
import { ANY_BARBER, type BookingConfirmation, type BookingResult, type TimeSlot } from "@/lib/booking/types";
import { invalidCustomerFields, LIMITS, normalizePhone } from "@/lib/booking/validation";
import { deliverNotification, type EmailProvider } from "./notifications";
import { getBookingRules } from "./settings";

/*
 * Server-side booking: availability and appointment creation. Every function
 * takes the Prisma client as its first argument so the integration tests can
 * run the exact same code against a test database.
 *
 * Double-booking protection, in order:
 *  1. The candidate barbers' rows are locked (`SELECT … FOR UPDATE`, in id
 *     order to avoid deadlocks), so concurrent bookings for the same barber
 *     run one at a time.
 *  2. Availability is recomputed from the database inside that transaction.
 *  3. The `appointments_no_overlap` exclusion constraint rejects any
 *     overlapping active appointment for a barber, whatever the code above does.
 */

type Tx = Prisma.TransactionClient;

/** Active service plus the active barbers who offer it (one, or all for "any"). */
async function findCandidates(db: Db | Tx, serviceId: string, barberChoice: string) {
  const service = await db.service.findFirst({ where: { id: serviceId, active: true } });
  if (!service) return null;
  const barbers = await db.barber.findMany({
    where: {
      active: true,
      services: { some: { serviceId } },
      ...(barberChoice === ANY_BARBER ? {} : { id: barberChoice }),
    },
    select: { id: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  if (barbers.length === 0) return null;
  return { service, barberIds: barbers.map((b) => b.id) };
}

/** Working blocks, time off and active appointments of `barberIds` on `date`. */
async function loadBarberDays(db: Db | Tx, date: string, barberIds: string[], rules: BookingRules): Promise<BarberDay[]> {
  const dayStart = zonedTimeToUtc(date, 0, rules.timeZone);
  const dayEnd = zonedTimeToUtc(addCalendarDays(date, 1), 0, rules.timeZone);
  const margin = rules.bufferMinutes * 60_000;

  const [hours, timeOff, appointments] = await Promise.all([
    db.workingHour.findMany({
      where: { barberId: { in: barberIds }, weekday: isoWeekday(date) },
      orderBy: { startMinute: "asc" },
    }),
    db.timeOff.findMany({
      where: {
        OR: [{ barberId: { in: barberIds } }, { barberId: null }],
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
    }),
    db.appointment.findMany({
      where: {
        barberId: { in: barberIds },
        status: { in: [...ACTIVE_STATUSES] },
        startsAt: { lt: new Date(dayEnd.getTime() + margin) },
        endsAt: { gt: new Date(dayStart.getTime() - margin) },
      },
      select: { barberId: true, startsAt: true, endsAt: true },
    }),
  ]);

  const interval = (r: { startsAt: Date; endsAt: Date }) => ({ start: r.startsAt.getTime(), end: r.endsAt.getTime() });
  return barberIds.map((id) => ({
    id,
    blocks: hours.filter((h) => h.barberId === id),
    timeOff: timeOff.filter((t) => t.barberId === id || t.barberId === null).map(interval),
    appointments: appointments.filter((a) => a.barberId === id).map(interval),
  }));
}

/* -------------------------------------------------------------------------- */
/*                                Availability                                */
/* -------------------------------------------------------------------------- */

const availabilitySchema = z.object({
  date: z.string().refine(isISODate),
  serviceId: z.string().min(1).max(64),
  barberId: z.string().min(1).max(64),
});

export async function getAvailability(db: Db, query: unknown, now = new Date()): Promise<TimeSlot[] | null> {
  const parsed = availabilitySchema.safeParse(query);
  if (!parsed.success) return null;
  const { date, serviceId, barberId } = parsed.data;

  const rules = await getBookingRules(db);
  const candidates = await findCandidates(db, serviceId, barberId);
  if (!candidates) return [];

  const barbers = await loadBarberDays(db, date, candidates.barberIds, rules);
  return computeSlots({ date, durationMinutes: candidates.service.durationMinutes, barbers, rules, now });
}

/* -------------------------------------------------------------------------- */
/*                                  Booking                                   */
/* -------------------------------------------------------------------------- */

const bookingSchema = z.object({
  serviceId: z.string().min(1).max(64),
  barberId: z.string().min(1).max(64),
  date: z.string().refine(isISODate),
  time: z.string().refine((t) => parseTime(t) !== null),
  customer: z.object({
    name: z.string().max(200),
    phone: z.string().max(40),
    email: z.string().max(400).default(""),
    notes: z.string().max(2000).default(""),
  }),
  idempotencyKey: z.string().min(16).max(100),
  locale: z.enum(locales),
});

const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** `S08-` plus six unambiguous characters (~1 billion combinations). */
export function generateReference(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  return `S08-${code}`;
}

class BookingRejected extends Error {
  constructor(readonly code: "slot_taken" | "invalid" | "limit_reached") {
    super(code);
  }
}

/** Postgres exclusion-constraint violation (SQLSTATE 23P01) on appointments. */
function isOverlapViolation(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message} ${JSON.stringify(error)}` : String(error);
  return text.includes("23P01") || text.includes("appointments_no_overlap");
}

function isUniqueViolation(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  return JSON.stringify(error.meta ?? {}).includes(field);
}

export interface CreateBookingOptions {
  now?: Date;
  /** Email provider for the confirmation. `null` records the notification as skipped. */
  emailProvider?: EmailProvider | null;
}

export async function createBooking(db: Db, input: unknown, options: CreateBookingOptions = {}): Promise<BookingResult> {
  const now = options.now ?? new Date();
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const request = parsed.data;

  const fields = invalidCustomerFields(request.customer);
  if (fields.length > 0) return { ok: false, error: "invalid", fields };

  const phone = normalizePhone(request.customer.phone);
  const name = request.customer.name.trim();
  const email = request.customer.email.trim().toLowerCase() || null;
  const notes = request.customer.notes.trim().slice(0, LIMITS.notes) || null;
  const startMinute = parseTime(request.time)!;

  // A retried submit (double click, flaky network) returns the original booking.
  const previous = await findByIdempotencyKey(db, request.idempotencyKey, phone);
  if (previous !== undefined) return previous ? { ok: true, booking: previous } : { ok: false, error: "invalid" };

  let created: { appointmentId: string; notificationId: string | null };
  try {
    created = await db.$transaction(
      async (tx) => {
        const rules = await getBookingRules(tx);
        const candidates = await findCandidates(tx, request.serviceId, request.barberId);
        if (!candidates) throw new BookingRejected("invalid");

        await tx.$queryRaw`SELECT "id" FROM "barbers" WHERE "id" IN (${Prisma.join(candidates.barberIds)}) ORDER BY "id" FOR UPDATE`;

        const { service } = candidates;
        const days = await loadBarberDays(tx, request.date, candidates.barberIds, rules);
        const slot = computeSlots({ date: request.date, durationMinutes: service.durationMinutes, barbers: days, rules, now }).find(
          (s) => s.time === minutesToTime(startMinute),
        );
        if (!slot?.available) throw new BookingRejected("slot_taken");

        const startsAt = zonedTimeToUtc(request.date, startMinute, rules.timeZone);
        const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

        const upcoming = await tx.appointment.count({
          where: { customer: { phone }, status: { in: [...ACTIVE_STATUSES] }, endsAt: { gt: now } },
        });
        if (upcoming >= rules.maxActiveBookingsPerPhone) throw new BookingRejected("limit_reached");

        // "Any barber": spread the work to whoever has the fewest bookings that day.
        const load = (id: string) => days.find((d) => d.id === id)?.appointments.length ?? 0;
        const barberId = [...slot.barberIds].sort((a, b) => load(a) - load(b))[0];

        const customer = await tx.customer.upsert({
          where: { phone },
          create: { phone, name, email },
          update: {},
        });

        let reference = generateReference();
        while (await tx.appointment.findUnique({ where: { reference }, select: { id: true } })) {
          reference = generateReference();
        }

        const appointment = await tx.appointment.create({
          data: {
            reference,
            serviceId: service.id,
            barberId,
            customerId: customer.id,
            startsAt,
            endsAt,
            status: rules.autoConfirm ? "CONFIRMED" : "PENDING",
            statusChangedAt: now,
            source: "ONLINE",
            priceMnt: service.priceMnt,
            durationMinutes: service.durationMinutes,
            customerName: name,
            customerEmail: email,
            notes,
            locale: request.locale,
            idempotencyKey: request.idempotencyKey,
          },
        });

        const notification = email
          ? await tx.notification.create({
              data: { appointmentId: appointment.id, channel: "EMAIL", type: "BOOKING_CONFIRMATION", recipient: email },
            })
          : null;

        return { appointmentId: appointment.id, notificationId: notification?.id ?? null };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10_000, timeout: 15_000 },
    );
  } catch (error) {
    const conflict =
      (error instanceof BookingRejected && error.code === "slot_taken") ||
      isOverlapViolation(error) ||
      isUniqueViolation(error, "idempotencyKey");
    // A concurrent retry of this same submit may have just taken the slot: return that booking.
    if (conflict) {
      const twin = await findByIdempotencyKey(db, request.idempotencyKey, phone);
      if (twin) return { ok: true, booking: twin };
    }
    if (error instanceof BookingRejected) return { ok: false, error: error.code };
    if (conflict) return { ok: false, error: "slot_taken" };
    throw error;
  }

  // The booking is committed; email delivery can fail without undoing it.
  if (created.notificationId) {
    await deliverNotification(db, created.notificationId, options.emailProvider).catch((error) => {
      console.error("[booking] confirmation email delivery threw", error);
    });
  }

  const booking = await confirmationFor(db, created.appointmentId);
  return { ok: true, booking: booking! };
}

/** `undefined` when no booking uses the key; `null` when it belongs to a different phone. */
async function findByIdempotencyKey(db: Db, key: string, phone: string): Promise<BookingConfirmation | null | undefined> {
  const existing = await db.appointment.findUnique({
    where: { idempotencyKey: key },
    select: { id: true, customer: { select: { phone: true } } },
  });
  if (!existing) return undefined;
  if (existing.customer.phone !== phone) return null;
  return confirmationFor(db, existing.id);
}

async function confirmationFor(db: Db, appointmentId: string): Promise<BookingConfirmation | null> {
  const [appointment, rules] = await Promise.all([
    db.appointment.findUnique({
      where: { id: appointmentId },
      include: { notifications: { where: { type: "BOOKING_CONFIRMATION", channel: "EMAIL" } } },
    }),
    getBookingRules(db),
  ]);
  if (!appointment) return null;

  const notification = appointment.notifications[0];
  const local = zonedParts(appointment.startsAt, rules.timeZone);
  return {
    reference: appointment.reference,
    status: appointment.status === "PENDING" ? "PENDING" : "CONFIRMED",
    barberId: appointment.barberId,
    date: local.date,
    time: minutesToTime(local.minutes),
    email: !notification ? "not_requested" : notification.status === "SENT" ? "sent" : "not_sent",
  };
}
