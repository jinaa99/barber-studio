import type { Locale } from "@/i18n/config";
import type { CustomerField } from "./validation";

export const ANY_BARBER = "any" as const;

/**
 * Catalogue service for "not on the menu": the customer and barber agree the
 * style (and price) at the visit. Booking without picking a service books it.
 */
export const CUSTOM_SERVICE = "custom-cut";

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
  /** Studio-zone calendar date, `YYYY-MM-DD`. */
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
  /** Generated once per attempt so a retried submit can't create a second booking. */
  idempotencyKey: string;
  /** Language for the customer's notifications. */
  locale: Locale;
}

/** What the customer sees after a booking has been saved. */
export interface BookingConfirmation {
  reference: string;
  status: "PENDING" | "CONFIRMED";
  barberId: string;
  date: string;
  time: string;
  /**
   * `sent`: the email provider accepted the confirmation. `not_sent`: no
   * provider is configured, or it failed. `not_requested`: no email given.
   */
  email: "sent" | "not_sent" | "not_requested";
}

export type BookingError =
  /** The time is no longer free (or never was). */
  | "slot_taken"
  /** The request failed validation; `fields` lists customer fields at fault. */
  | "invalid"
  /** This phone number already holds the maximum number of upcoming bookings. */
  | "limit_reached"
  | "rate_limited"
  | "unknown";

export type BookingResult =
  | { ok: true; booking: BookingConfirmation }
  | { ok: false; error: BookingError; fields?: CustomerField[] };

/**
 * The booking UI depends only on this interface. The live implementation
 * (`http-provider.ts`) calls the server, which owns availability and booking.
 */
export interface BookingProvider {
  getAvailability(query: AvailabilityQuery): Promise<TimeSlot[]>;
  createBooking(request: BookingRequest): Promise<BookingResult>;
}

/** Booking rules the browser uses for hints. The server re-checks everything. */
export interface BookingConfig {
  timeZone: string;
  bookingHorizonDays: number;
  minLeadMinutes: number;
}

export const emptyCustomer: CustomerDetails = { name: "", phone: "", email: "", notes: "" };

export const emptyDraft: BookingDraft = {
  serviceId: null,
  barberId: null,
  date: null,
  time: null,
  customer: emptyCustomer,
};
