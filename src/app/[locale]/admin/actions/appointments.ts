"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { AppointmentStatus } from "@/generated/prisma/enums";
import { localizedPath } from "@/i18n/config";
import { routes } from "@/lib/navigation";
import { appointmentScope } from "@/lib/admin/permissions";
import { checkbox, failure, parseForm, success, text, type FormState } from "@/lib/admin/forms";
import { rescheduleSchema, staffAppointmentSchema } from "@/lib/admin/schemas";
import { db } from "@/lib/server/db";
import { changeAppointmentStatus, createStaffAppointment, rescheduleAppointment } from "@/lib/server/appointments";
import { bookingErrorMessage, localeFrom, permitted } from "./shared";

/** Confirm, complete, cancel or mark a no-show. Barbers may only touch their own appointments. */
export async function changeStatusAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("appointments.updateStatus", formData);
  if (!user) return failure("forbidden");

  const appointmentId = text(formData, "appointmentId");
  const to = text(formData, "status");
  if (!appointmentId || !(to in AppointmentStatus)) return failure("generic");

  const result = await changeAppointmentStatus(db, {
    appointmentId,
    to: to as AppointmentStatus,
    actorId: user.id,
    reason: text(formData, "reason").slice(0, 300),
    scope: appointmentScope(user),
  });
  refresh();
  if (!result.ok) return failure(result.error === "not_found" ? "notFound" : "invalidTransition");
  return success("saved");
}

/** The chosen slot, or the free-typed "other time" when given. */
function chosenTime(formData: FormData): string {
  return text(formData, "otherTime").trim() || text(formData, "time");
}

function calendarHref(locale: string, date: string, id: string) {
  return `${localizedPath(locale === "en" ? "en" : "mn", routes.adminAppointments)}?date=${date}&open=${encodeURIComponent(id)}`;
}

export async function createAppointmentAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("appointments.manage", formData);
  if (!user) return failure("forbidden");
  const locale = localeFrom(formData);

  const parsed = parseForm(staffAppointmentSchema, {
    serviceId: text(formData, "serviceId"),
    barberId: text(formData, "barberId"),
    date: text(formData, "date"),
    time: chosenTime(formData),
    status: text(formData, "status") || "CONFIRMED",
    customer: {
      name: text(formData, "customer.name"),
      phone: text(formData, "customer.phone"),
      email: text(formData, "customer.email"),
      notes: text(formData, "customer.notes"),
    },
    notify: checkbox(formData, "notify"),
  });
  if (!parsed.ok) return parsed.state;

  const result = await createStaffAppointment(db, { ...parsed.data, actorId: user.id, locale });
  if (!result.ok) return failure(bookingErrorMessage[result.error] ?? "generic", result.error === "slot_taken" ? { time: "taken" } : undefined);
  redirect(calendarHref(locale, parsed.data.date, result.appointmentId));
}

export async function rescheduleAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("appointments.manage", formData);
  if (!user) return failure("forbidden");
  const locale = localeFrom(formData);

  const parsed = parseForm(rescheduleSchema, {
    appointmentId: text(formData, "appointmentId"),
    barberId: text(formData, "barberId"),
    date: text(formData, "date"),
    time: chosenTime(formData),
    notify: checkbox(formData, "notify"),
  });
  if (!parsed.ok) return parsed.state;

  const result = await rescheduleAppointment(db, { ...parsed.data, actorId: user.id, scope: appointmentScope(user) });
  if (!result.ok) return failure(bookingErrorMessage[result.error] ?? "generic", result.error === "slot_taken" ? { time: "taken" } : undefined);
  redirect(calendarHref(locale, parsed.data.date, result.appointmentId));
}
