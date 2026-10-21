import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import type { BookingRequest } from "@/lib/booking/types";
import { zonedTimeToUtc } from "@/lib/booking/time";

/*
 * Shared fixtures for the integration tests. `scripts/test-integration.ts`
 * points DATABASE_URL at the dedicated test database before these run.
 */

export const TZ = "Asia/Ulaanbaatar";
/** A Tuesday. */
export const DATE = "2026-11-03";
/** 08:00 on Monday 2 November in Ulaanbaatar: the fixed "now" for every test. */
export const NOW = new Date("2026-11-02T00:00:00Z");

export function createTestClient() {
  const url = process.env.DATABASE_URL;
  if (!url || !/test/i.test(new URL(url).pathname)) throw new Error("Integration tests must run against a *test* database.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

export type TestDb = ReturnType<typeof createTestClient>;

export async function resetDatabase(db: TestDb) {
  await db.$executeRawUnsafe(`
    TRUNCATE "audit_logs", "notifications", "reviews", "appointments", "customers", "time_off",
      "working_hours", "barber_services", "barbers", "services", "sessions", "users", "business_settings"
    RESTART IDENTITY CASCADE`);
}

/**
 * Two barbers (a, b) who cut and shave, Tuesday–Saturday 10:00–18:00 with a
 * 13:30–14:00 break; barber c only shaves. One inactive service.
 */
export async function seedFixtures(db: TestDb, settings: Partial<{ maxActiveBookingsPerPhone: number; autoConfirm: boolean; bufferMinutes: number }> = {}) {
  await db.businessSettings.create({
    data: { id: "default", timeZone: TZ, slotIntervalMinutes: 30, bookingHorizonDays: 14, minLeadMinutes: 60, ...settings },
  });
  const localized = (en: string) => ({ mn: en, en });
  const service = (id: string, durationMinutes: number, active = true) => ({
    id,
    category: "haircut" as const,
    name: localized(id),
    summary: localized(id),
    durationMinutes,
    priceMnt: 50_000,
    active,
  });
  await db.service.createMany({ data: [service("cut", 60), service("shave", 30), service("retired", 30, false)] });

  for (const [id, services] of [
    ["a", ["cut", "shave", "retired"]],
    ["b", ["cut", "shave"]],
    ["c", ["shave"]],
  ] as const) {
    await db.barber.create({
      data: {
        id,
        name: localized(id.toUpperCase()),
        role: localized("Barber"),
        bio: localized(""),
        imageId: "none",
        services: { create: services.map((serviceId) => ({ serviceId })) },
        workingHours: {
          create: [2, 3, 4, 5, 6].flatMap((weekday) => [
            { weekday, startMinute: 600, endMinute: 810 },
            { weekday, startMinute: 840, endMinute: 1080 },
          ]),
        },
      },
    });
  }
}

let counter = 0;

export function request(overrides: Partial<Omit<BookingRequest, "customer">> & { customer?: Partial<BookingRequest["customer"]> } = {}): BookingRequest {
  counter += 1;
  return {
    serviceId: "cut",
    barberId: "a",
    date: DATE,
    time: "10:00",
    locale: "en",
    idempotencyKey: `test-key-${counter}-${Math.random().toString(36).slice(2)}`,
    ...overrides,
    customer: { name: "Test Guest", phone: `8800${String(1000 + counter).slice(-4)}`, email: "", notes: "", ...overrides.customer },
  };
}

export const ubTime = (time: string, date = DATE) => {
  const [h, m] = time.split(":").map(Number);
  return zonedTimeToUtc(date, h * 60 + m, TZ);
};
