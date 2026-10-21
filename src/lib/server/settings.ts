import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { BookingRules } from "@/lib/booking/availability";
import { STUDIO_TIME_ZONE } from "@/lib/booking/time";
import type { Db } from "./db";

export type StudioRules = BookingRules & { maxActiveBookingsPerPhone: number; autoConfirm: boolean };

/** Used until a BusinessSettings row exists (the seed creates one). */
export const defaultRules: StudioRules = {
  timeZone: STUDIO_TIME_ZONE,
  slotIntervalMinutes: 30,
  bookingHorizonDays: 14,
  minLeadMinutes: 60,
  bufferMinutes: 0,
  maxActiveBookingsPerPhone: 3,
  autoConfirm: true,
};

export async function getBookingRules(db: Db | Prisma.TransactionClient): Promise<StudioRules> {
  const settings = await db.businessSettings.findUnique({ where: { id: "default" } });
  if (!settings) return defaultRules;
  return {
    timeZone: settings.timeZone,
    slotIntervalMinutes: settings.slotIntervalMinutes,
    bookingHorizonDays: settings.bookingHorizonDays,
    minLeadMinutes: settings.minLeadMinutes,
    bufferMinutes: settings.bufferMinutes,
    maxActiveBookingsPerPhone: settings.maxActiveBookingsPerPhone,
    autoConfirm: settings.autoConfirm,
  };
}
