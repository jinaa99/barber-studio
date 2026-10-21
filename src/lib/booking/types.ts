import type { Weekday } from "@/content/types";

export const ANY_BARBER = "any" as const;

export type BarberChoice = string | typeof ANY_BARBER;

export interface CustomerDetails {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

/** Everything the visitor has chosen so far. Persisted per tab. */
export interface BookingDraft {
  serviceId: string | null;
  barberId: BarberChoice | null;
  /** Local calendar date, `YYYY-MM-DD`. */
  date: string | null;
  /** 24h `HH:MM`. */
  time: string | null;
  customer: CustomerDetails;
}

export interface TimeSlot {
  time: string;
  available: boolean;
  /** Barbers free for the whole service starting at this time. */
  barberIds: string[];
}

export interface AvailabilityQuery {
  date: string;
  serviceId: string;
  barberId: BarberChoice;
}

export interface BookingRequest {
  serviceId: string;
  barberId: BarberChoice;
  date: string;
  time: string;
  customer: CustomerDetails;
}

export type BookingResult =
  | {
      ok: true;
      reference: string;
      assignedBarberId: string;
      /** True while bookings are simulated and nothing is persisted. */
      isDemo: boolean;
    }
  | { ok: false; error: "slot_taken" | "invalid" | "unknown" };

/**
 * The booking UI depends only on this interface. Phase 03 replaces the demo
 * implementation with one backed by a real database and server actions.
 */
export interface BookingProvider {
  getAvailability(query: AvailabilityQuery): Promise<TimeSlot[]>;
  createBooking(request: BookingRequest): Promise<BookingResult>;
}

/** The minimal catalogue data a provider needs to reason about availability. */
export interface BookingCatalog {
  services: { id: string; durationMinutes: number }[];
  barbers: { id: string; serviceIds: string[]; workingDays: Weekday[] }[];
  hours: { day: Weekday; open: string | null; close: string | null }[];
  slotIntervalMinutes: number;
}

export const emptyCustomer: CustomerDetails = { name: "", phone: "", email: "", notes: "" };

export const emptyDraft: BookingDraft = {
  serviceId: null,
  barberId: null,
  date: null,
  time: null,
  customer: emptyCustomer,
};
