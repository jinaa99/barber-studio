import { z } from "zod";
import { isISODate, parseTime } from "@/lib/booking/time";
import { invalidCustomerFields } from "@/lib/booking/validation";

/*
 * Validation for every staff-dashboard form. Pure, so it is unit-tested and
 * shared; the Server Actions are the only callers that matter (the browser
 * gets native `required`/`min`/`max` hints, never the authority).
 * Refinement messages are `FieldErrorCode`s (see ./forms.ts).
 */

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const slug = z.string().trim().min(1).max(48).regex(SLUG, "slug");
const id = z.string().trim().min(1).max(64);
const isoDate = z.string().refine(isISODate, "invalid");
const time = z.string().refine((t) => parseTime(t) !== null, "time");
const int = (min: number, max: number) => z.coerce.number().int("invalid").min(min, "range").max(max, "range");
const required = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max);

/* ------------------------------------------------------------ Appointments */

export const appointmentStatusChoice = z.enum(["CONFIRMED", "PENDING"]);

export const customerSchema = z
  .object({
    name: z.string().max(200),
    phone: z.string().max(40),
    email: z.string().max(400),
    notes: z.string().max(2000),
  })
  .superRefine((customer, ctx) => {
    for (const field of invalidCustomerFields(customer)) {
      const code = field === "email" ? "email" : field === "phone" ? "phone" : field === "notes" ? "tooLong" : "invalid";
      ctx.addIssue({ code: "custom", path: [field], message: code });
    }
  });

export const staffAppointmentSchema = z.object({
  serviceId: id,
  barberId: id,
  date: isoDate,
  time,
  status: appointmentStatusChoice,
  customer: customerSchema,
  notify: z.boolean(),
});
export type StaffAppointmentInput = z.output<typeof staffAppointmentSchema>;

export const rescheduleSchema = z.object({
  appointmentId: id,
  barberId: id,
  date: isoDate,
  time,
  notify: z.boolean(),
});
export type RescheduleInput = z.output<typeof rescheduleSchema>;

export const cancelSchema = z.object({
  appointmentId: id,
  reason: optional(300),
});

/* ----------------------------------------------------------------- Catalog */

const localized = (max: number, isRequired = true) =>
  z.object({ mn: isRequired ? required(max) : optional(max), en: isRequired ? required(max) : optional(max) });

/** Pairs of lines (`mn[i]`, `en[i]`): both languages must list the same number of entries. */
const localizedList = z
  .object({ mn: z.array(z.string().trim().min(1).max(120)).max(12), en: z.array(z.string().trim().min(1).max(120)).max(12) })
  .refine((v) => v.mn.length === v.en.length, { message: "mismatch", path: ["en"] });

export const categorySchema = z.object({
  id: slug,
  name: localized(60),
  sortOrder: int(0, 999),
});
export type CategoryInput = z.output<typeof categorySchema>;

export const serviceSchema = z.object({
  id: slug,
  categoryId: id,
  name: localized(80),
  summary: localized(400),
  includes: localizedList,
  durationMinutes: int(5, 480),
  priceMnt: int(0, 10_000_000),
  featured: z.boolean(),
  active: z.boolean(),
  sortOrder: int(0, 999),
  barberIds: z.array(id).max(100),
});
export type ServiceInput = z.output<typeof serviceSchema>;

export const barberSchema = z.object({
  id: slug,
  name: localized(80),
  role: localized(80),
  bio: localized(1200),
  specialties: localizedList,
  yearsExperience: int(0, 80),
  imageId: id,
  active: z.boolean(),
  sortOrder: int(0, 999),
  serviceIds: z.array(id).max(100),
});
export type BarberInput = z.output<typeof barberSchema>;

/* --------------------------------------------------------------- Schedules */

export interface WorkingBlock {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export type BlockError = { index: number; code: "time" | "order" | "overlap" };

/**
 * Weekly working blocks: valid times, start before end, and no two blocks on
 * the same weekday overlapping (touching is fine: 10:00–14:00 + 14:00–18:00).
 */
export function validateBlocks(rows: { weekday: string; start: string; end: string }[]): {
  blocks: WorkingBlock[];
  errors: BlockError[];
} {
  const blocks: WorkingBlock[] = [];
  const errors: BlockError[] = [];
  rows.forEach((row, index) => {
    const weekday = Number(row.weekday);
    const start = parseTime(row.start);
    // "24:00" closes a block at midnight.
    const end = row.end === "24:00" ? 1440 : parseTime(row.end);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || start === null || end === null) {
      errors.push({ index, code: "time" });
    } else if (end <= start) {
      errors.push({ index, code: "order" });
    } else {
      blocks.push({ weekday, startMinute: start, endMinute: end });
      const clash = blocks
        .slice(0, -1)
        .some((b) => b.weekday === weekday && b.startMinute < end && start < b.endMinute);
      if (clash) errors.push({ index, code: "overlap" });
    }
  });
  return { blocks: blocks.sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute), errors };
}

export const timeOffSchema = z
  .object({
    /** A barber id, or "studio" for a closure of the whole studio. */
    barberId: id,
    startDate: isoDate,
    endDate: isoDate,
    allDay: z.boolean(),
    startTime: z.string(),
    endTime: z.string(),
    reason: optional(200),
  })
  .superRefine((v, ctx) => {
    if (v.allDay) {
      if (v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "range" });
      return;
    }
    const start = parseTime(v.startTime);
    const end = parseTime(v.endTime);
    if (start === null) ctx.addIssue({ code: "custom", path: ["startTime"], message: "time" });
    if (end === null) ctx.addIssue({ code: "custom", path: ["endTime"], message: "time" });
    if (start !== null && end !== null && (v.endDate < v.startDate || (v.endDate === v.startDate && end <= start))) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "range" });
    }
  });
export type TimeOffInput = z.output<typeof timeOffSchema>;

/* ---------------------------------------------------------------- Settings */

export const bookingRulesSchema = z.object({
  slotIntervalMinutes: int(5, 240).refine((n) => n % 5 === 0, "invalid"),
  bookingHorizonDays: int(1, 365),
  minLeadMinutes: int(0, 10_080),
  bufferMinutes: int(0, 240),
  maxActiveBookingsPerPhone: int(1, 50),
  autoConfirm: z.boolean(),
});
export type BookingRulesInput = z.output<typeof bookingRulesSchema>;

/* ------------------------------------------------------------------- Staff */

export const staffRoleSchema = z.enum(["ADMIN", "STAFF", "BARBER"]);

export const createAccountSchema = z.object({
  name: required(80),
  email: z.string().trim().toLowerCase().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "email"),
  role: staffRoleSchema,
  password: z.string().min(12, "tooShort").max(200),
  barberId: optional(64),
});

export const updateAccountSchema = z.object({
  userId: id,
  role: staffRoleSchema,
  active: z.boolean(),
  barberId: optional(64),
});

export const resetPasswordSchema = z.object({
  userId: id,
  password: z.string().min(12, "tooShort").max(200),
});
