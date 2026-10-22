/**
 * Demo seed: services, barbers, schedules, booking settings, sample reviews
 * and sample appointments.
 *
 *   npm run db:seed
 *
 * Safe to run repeatedly. It only creates what is missing and never updates
 * or deletes existing rows, so edits made by staff survive a re-seed.
 * Sample appointments and customers are flagged `isDemo` (appointments also
 * `source = DEMO_SEED` and a `DEMO-` reference) so they can be filtered out of
 * real reporting or removed with `npm run db:remove-demo`.
 *
 * Environment:
 *   SEED_SAMPLE_APPOINTMENTS=false   skip sample appointments
 *   SEED_ALLOW_PRODUCTION=true       required when NODE_ENV=production
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type AppointmentStatus } from "../src/generated/prisma/client";
import { categoryRecords } from "../src/content/demo/categories";
import { serviceRecords } from "../src/content/demo/services";
import { barberRecords } from "../src/content/demo/barbers";
import { testimonialRecords } from "../src/content/demo/testimonials";
import { site } from "../src/content/site";
import { addCalendarDays, isoWeekday, STUDIO_TIME_ZONE, zonedParts, zonedTimeToUtc } from "../src/lib/booking/time";
import { timeToMinutes } from "../src/lib/booking/dates";
import { CUSTOM_SERVICE } from "../src/lib/booking/types";

config({ path: [".env.local", ".env"], quiet: true });

if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
  console.error("Refusing to seed demo data with NODE_ENV=production. Set SEED_ALLOW_PRODUCTION=true to override.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const weekdayIndex = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 } as const;
/** Everyone takes a half-hour break at 13:30 on days that span it. */
const BREAK = { start: 13 * 60 + 30, end: 14 * 60 };

/** Deterministic pseudo-random numbers so the sample data is the same on every machine. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function seedSettings() {
  await prisma.businessSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      timeZone: STUDIO_TIME_ZONE,
      slotIntervalMinutes: site.booking.slotIntervalMinutes,
      bookingHorizonDays: site.booking.daysAhead,
    },
    update: {},
  });
}

async function seedCatalog() {
  for (const [i, c] of categoryRecords.entries()) {
    await prisma.category.upsert({ where: { id: c.id }, create: { id: c.id, name: c.name, sortOrder: i }, update: {} });
  }

  for (const [i, s] of serviceRecords.entries()) {
    await prisma.service.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        categoryId: s.category,
        name: s.name,
        summary: s.summary,
        includes: s.includes,
        durationMinutes: s.durationMinutes,
        priceMnt: s.price,
        featured: s.featured,
        sortOrder: i,
      },
      update: {},
    });
  }

  // Demo barbers seeded before they had profile portraits used these work photos.
  // Move them to the portrait, but only while staff haven't picked a photo of their own.
  const previousImage: Record<string, string> = {
    temuulen: "work-scissor-over-comb",
    enkhjin: "work-detail-comb",
    bilguun: "work-straight-razor",
  };

  for (const [i, b] of barberRecords.entries()) {
    const exists = await prisma.barber.findUnique({ where: { id: b.id }, select: { id: true, imageId: true } });
    if (exists) {
      if (exists.imageId === previousImage[b.id]) {
        await prisma.barber.update({ where: { id: b.id }, data: { imageId: b.imageId } });
      }
      continue;
    }

    await prisma.barber.create({
      data: {
        id: b.id,
        name: b.name,
        role: b.role,
        bio: b.bio,
        specialties: b.specialties,
        yearsExperience: b.yearsExperience,
        imageId: b.imageId,
        sortOrder: i,
        services: { create: b.serviceIds.map((serviceId) => ({ serviceId })) },
        workingHours: {
          create: b.workingDays.flatMap((day) => {
            const hours = site.hours.find((h) => h.day === day);
            if (!hours?.open || !hours.close) return [];
            const open = timeToMinutes(hours.open);
            const close = timeToMinutes(hours.close);
            const weekday = weekdayIndex[day];
            if (open < BREAK.start && close > BREAK.end) {
              return [
                { weekday, startMinute: open, endMinute: BREAK.start },
                { weekday, startMinute: BREAK.end, endMinute: close },
              ];
            }
            return [{ weekday, startMinute: open, endMinute: close }];
          }),
        },
      },
    });
  }

  // The custom-style service arrived after the first barbers were seeded: until staff
  // assign it themselves, every active barber offers it.
  if ((await prisma.barberService.count({ where: { serviceId: CUSTOM_SERVICE } })) === 0) {
    const barbers = await prisma.barber.findMany({ where: { active: true }, select: { id: true } });
    await prisma.barberService.createMany({
      data: barbers.map((b) => ({ barberId: b.id, serviceId: CUSTOM_SERVICE })),
      skipDuplicates: true,
    });
  }
}

async function seedReviews() {
  if ((await prisma.review.count({ where: { isSample: true } })) > 0) return;
  await prisma.review.createMany({
    data: testimonialRecords.map((t, i) => ({
      quote: t.quote,
      attribution: t.attribution,
      status: "PUBLISHED" as const,
      isSample: true,
      sortOrder: i,
    })),
  });
}

async function seedSampleAppointments() {
  if (process.env.SEED_SAMPLE_APPOINTMENTS === "false") return 0;
  if ((await prisma.appointment.count({ where: { source: "DEMO_SEED" } })) > 0) return 0;

  const random = mulberry32(808);
  const now = new Date();
  const { date: today } = zonedParts(now, STUDIO_TIME_ZONE);

  const customers = [];
  for (let i = 1; i <= 16; i++) {
    const phone = `976000008${String(i).padStart(2, "0")}`;
    customers.push(
      await prisma.customer.upsert({
        where: { phone },
        create: { phone, name: `Demo guest ${i}`, isDemo: true },
        update: {},
      }),
    );
  }

  const barbers = await prisma.barber.findMany({
    include: { services: { include: { service: true } }, workingHours: true },
  });

  const rows = [];
  let counter = 0;
  for (let offset = -28; offset <= 6; offset++) {
    const date = addCalendarDays(today, offset);
    for (const barber of barbers) {
      const blocks = barber.workingHours.filter((h) => h.weekday === isoWeekday(date));
      for (const block of blocks) {
        let cursor = block.startMinute;
        while (cursor + 30 <= block.endMinute) {
          const services = barber.services.map((s) => s.service).filter((s) => cursor + s.durationMinutes <= block.endMinute);
          const startsAt = zonedTimeToUtc(date, cursor, STUDIO_TIME_ZONE);
          const isPast = startsAt < now;
          // Keep most future time free so the booking flow has plenty to show.
          const busy = random() < (isPast ? 0.55 : 0.2);
          if (!busy || services.length === 0) {
            cursor += 30;
            continue;
          }
          const service = services[Math.floor(random() * services.length)];
          const roll = random();
          const status: AppointmentStatus = !isPast ? "CONFIRMED" : roll < 0.8 ? "COMPLETED" : roll < 0.9 ? "CANCELLED" : "NO_SHOW";
          const customer = customers[Math.floor(random() * customers.length)];
          counter += 1;
          rows.push({
            reference: `DEMO-${String(counter).padStart(5, "0")}`,
            serviceId: service.id,
            barberId: barber.id,
            customerId: customer.id,
            startsAt,
            endsAt: new Date(startsAt.getTime() + service.durationMinutes * 60_000),
            status,
            statusChangedAt: isPast ? startsAt : now,
            source: "DEMO_SEED" as const,
            isDemo: true,
            priceMnt: service.priceMnt,
            durationMinutes: service.durationMinutes,
            customerName: customer.name,
            locale: random() < 0.7 ? "mn" : "en",
          });
          cursor += service.durationMinutes;
        }
      }
    }
  }

  await prisma.appointment.createMany({ data: rows });
  return rows.length;
}

async function main() {
  await seedSettings();
  await seedCatalog();
  await seedReviews();
  const samples = await seedSampleAppointments();
  console.log(
    `Seed complete: ${await prisma.service.count()} services, ${await prisma.barber.count()} barbers, ` +
      `${samples} new sample appointments (flagged isDemo).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
