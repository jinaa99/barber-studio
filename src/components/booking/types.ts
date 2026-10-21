import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { Barber, Service } from "@/content/types";

/** The dictionary slices the booking UI needs; passed from the server page. */
export type BookingDict = Pick<Dictionary, "booking" | "common" | "calendar" | "weekdays">;

export type BookingService = Pick<Service, "id" | "category" | "name" | "summary" | "durationMinutes" | "price">;

export type BookingBarber = Pick<Barber, "id" | "name" | "role" | "specialties" | "serviceIds" | "workingDays">;
