import type { BookingProvider, BookingResult, TimeSlot } from "./types";

/*
 * Browser implementation of BookingProvider. Availability is advisory: the
 * server recalculates it inside the booking transaction, so a slot listed
 * here can still come back as `slot_taken`.
 */

export const bookingApi = {
  availability: "/api/booking/availability",
  bookings: "/api/booking",
} as const;

export function createHttpBookingProvider(): BookingProvider {
  return {
    async getAvailability({ date, serviceId, barberId }) {
      const params = new URLSearchParams({ date, service: serviceId, barber: barberId });
      const response = await fetch(`${bookingApi.availability}?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Availability request failed (${response.status})`);
      const body = (await response.json()) as { slots: TimeSlot[] };
      return body.slots;
    },

    async createBooking(request) {
      const response = await fetch(bookingApi.bookings, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      try {
        return (await response.json()) as BookingResult;
      } catch {
        return { ok: false, error: response.status === 429 ? "rate_limited" : "unknown" };
      }
    },
  };
}
