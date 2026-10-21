import type { AppointmentStatus } from "@/generated/prisma/enums";

/*
 * Appointment lifecycle.
 *
 *   PENDING ──► CONFIRMED ──► COMPLETED
 *      │            ├───────► NO_SHOW
 *      └──────► CANCELLED ◄──┘
 *
 * COMPLETED, CANCELLED and NO_SHOW are final: re-opening a slot that someone
 * else may since have booked is done by creating a new appointment.
 */

export const ACTIVE_STATUSES = ["PENDING", "CONFIRMED"] as const satisfies AppointmentStatus[];

const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "NO_SHOW", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

/** Outcomes that can only be recorded once the appointment has started. */
const afterStartOnly: AppointmentStatus[] = ["COMPLETED", "NO_SHOW"];

export function isActiveStatus(status: AppointmentStatus): boolean {
  return (ACTIVE_STATUSES as readonly AppointmentStatus[]).includes(status);
}

export function allowedTransitions(from: AppointmentStatus, startsAt: Date, now: Date): AppointmentStatus[] {
  return transitions[from].filter((to) => !afterStartOnly.includes(to) || now >= startsAt);
}

export function canTransition(from: AppointmentStatus, to: AppointmentStatus, startsAt: Date, now: Date): boolean {
  return allowedTransitions(from, startsAt, now).includes(to);
}
