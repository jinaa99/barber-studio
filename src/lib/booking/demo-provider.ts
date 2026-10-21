import {
  ANY_BARBER,
  type AvailabilityQuery,
  type BookingCatalog,
  type BookingProvider,
  type BookingRequest,
  type BookingResult,
  type TimeSlot,
} from "./types";
import { minutesToTime, timeToMinutes, toISODate, weekdayOf } from "./dates";
import { SAME_DAY_BUFFER_MINUTES } from "./rules";

const SIMULATED_LATENCY_MS = 450;

/** Small, stable string hash so example availability doesn't change on re-render. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates believable, deterministic example availability in the browser.
 * Nothing is stored: `createBooking` only returns a demo reference.
 */
export function createDemoBookingProvider(catalog: BookingCatalog): BookingProvider {
  function computeSlots({ date, serviceId, barberId }: AvailabilityQuery): TimeSlot[] {
    const service = catalog.services.find((s) => s.id === serviceId);
    const weekday = weekdayOf(date);
    const hours = catalog.hours.find((h) => h.day === weekday);
    if (!service || !hours?.open || !hours.close) return [];

    const candidates = catalog.barbers.filter(
      (b) =>
        b.serviceIds.includes(serviceId) &&
        b.workingDays.includes(weekday) &&
        (barberId === ANY_BARBER || b.id === barberId),
    );

    const now = new Date();
    const isToday = toISODate(now) === date;
    const earliest = isToday ? now.getHours() * 60 + now.getMinutes() + SAME_DAY_BUFFER_MINUTES : 0;

    const open = timeToMinutes(hours.open);
    const lastStart = timeToMinutes(hours.close) - service.durationMinutes;
    const slots: TimeSlot[] = [];

    for (let start = open; start <= lastStart; start += catalog.slotIntervalMinutes) {
      const time = minutesToTime(start);
      if (start < earliest) continue;
      const free = candidates
        .filter((b) => hash(`${date}|${b.id}|${time}`) % 100 >= 38)
        .map((b) => b.id);
      slots.push({ time, available: free.length > 0, barberIds: free });
    }
    return slots;
  }

  return {
    async getAvailability(query) {
      await wait(SIMULATED_LATENCY_MS);
      return computeSlots(query);
    },

    async createBooking(request: BookingRequest): Promise<BookingResult> {
      await wait(SIMULATED_LATENCY_MS * 2);
      const slot = computeSlots(request).find((s) => s.time === request.time);
      if (!slot) return { ok: false, error: "invalid" };
      if (!slot.available) return { ok: false, error: "slot_taken" };

      const reference = `S08-${hash(`${request.date}${request.time}${request.customer.phone}`)
        .toString(36)
        .slice(0, 5)
        .toUpperCase()}`;
      return { ok: true, reference, assignedBarberId: slot.barberIds[0], isDemo: true };
    },
  };
}
