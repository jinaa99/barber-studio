import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { Db } from "./db";
import { addCalendarDays, zonedParts, zonedTimeToUtc } from "@/lib/booking/time";
import { ACTIVE_STATUSES } from "@/lib/booking/status";
import type { BarberInput, CategoryInput, ServiceInput, TimeOffInput, WorkingBlock } from "@/lib/admin/schemas";
import { audit } from "./audit";
import { getBookingRules } from "./settings";

/*
 * Catalogue management: categories, services, barbers, weekly hours and time
 * off. Callers authorize (`catalog.manage`) and refresh the public cache
 * (`updateTag(catalogTag)`) afterwards. Every change is audited.
 *
 * Nothing here deletes a service or barber: appointments reference them, so
 * they are deactivated instead (hidden from the site, no new bookings).
 */

export type CatalogError = "taken" | "not_found" | "in_use" | "invalid_image" | "invalid_category";
export type CatalogResult<T = null> = { ok: true; value: T } | { ok: false; error: CatalogError };

const done = { ok: true, value: null } as const;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/* -------------------------------------------------------------- Categories */

export async function listCategories(db: Db) {
  return db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, name: true, sortOrder: true, _count: { select: { services: true } } },
  });
}

export async function saveCategory(db: Db, input: CategoryInput, actorId: string, mode: "create" | "update"): Promise<CatalogResult> {
  try {
    if (mode === "create") {
      await db.category.create({ data: { id: input.id, name: input.name, sortOrder: input.sortOrder } });
    } else {
      const updated = await db.category.updateMany({ where: { id: input.id }, data: { name: input.name, sortOrder: input.sortOrder } });
      if (updated.count === 0) return { ok: false, error: "not_found" };
    }
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "taken" };
    throw error;
  }
  await audit(db, { actorId, action: mode === "create" ? "category.created" : "category.updated", entityType: "Category", entityId: input.id });
  return done;
}

export async function deleteCategory(db: Db, id: string, actorId: string): Promise<CatalogResult> {
  const inUse = await db.service.count({ where: { categoryId: id } });
  if (inUse > 0) return { ok: false, error: "in_use" };
  const deleted = await db.category.deleteMany({ where: { id } });
  if (deleted.count === 0) return { ok: false, error: "not_found" };
  await audit(db, { actorId, action: "category.deleted", entityType: "Category", entityId: id });
  return done;
}

/* ---------------------------------------------------------------- Services */

export async function listServicesForAdmin(db: Db) {
  return db.service.findMany({
    orderBy: [{ categoryRef: { sortOrder: "asc" } }, { sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      categoryId: true,
      durationMinutes: true,
      priceMnt: true,
      featured: true,
      active: true,
      _count: { select: { barbers: true } },
    },
  });
}

export async function getServiceForEdit(db: Db, id: string) {
  return db.service.findUnique({
    where: { id },
    select: {
      id: true,
      categoryId: true,
      name: true,
      summary: true,
      includes: true,
      durationMinutes: true,
      priceMnt: true,
      featured: true,
      active: true,
      sortOrder: true,
      barbers: { select: { barberId: true } },
    },
  });
}

/** Create or update a service and its eligible barbers in one transaction. */
export async function saveService(db: Db, input: ServiceInput, actorId: string, mode: "create" | "update"): Promise<CatalogResult> {
  const includes = input.includes.mn.map((mn, i) => ({ mn, en: input.includes.en[i] }));
  if (!(await db.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }))) {
    return { ok: false, error: "invalid_category" };
  }
  try {
    await db.$transaction(async (tx) => {
      const before =
        mode === "update"
          ? await tx.service.findUnique({ where: { id: input.id }, select: { active: true, priceMnt: true, durationMinutes: true } })
          : null;
      if (mode === "update" && !before) throw new NotFound();
      const data = {
        categoryId: input.categoryId,
        name: input.name,
        summary: input.summary,
        includes,
        durationMinutes: input.durationMinutes,
        priceMnt: input.priceMnt,
        featured: input.featured,
        active: input.active,
        sortOrder: input.sortOrder,
      };
      if (mode === "create") await tx.service.create({ data: { id: input.id, ...data } });
      else await tx.service.update({ where: { id: input.id }, data });

      const barberIds = (await tx.barber.findMany({ where: { id: { in: input.barberIds } }, select: { id: true } })).map((b) => b.id);
      await tx.barberService.deleteMany({ where: { serviceId: input.id, barberId: { notIn: barberIds } } });
      await tx.barberService.createMany({ data: barberIds.map((barberId) => ({ barberId, serviceId: input.id })), skipDuplicates: true });

      await audit(tx, {
        actorId,
        action: mode === "create" ? "service.created" : "service.updated",
        entityType: "Service",
        entityId: input.id,
        metadata: {
          priceMnt: input.priceMnt,
          durationMinutes: input.durationMinutes,
          active: input.active,
          barberIds,
          ...(before ? { previous: before } : {}),
        },
      });
    });
  } catch (error) {
    if (error instanceof NotFound) return { ok: false, error: "not_found" };
    if (isUniqueViolation(error)) return { ok: false, error: "taken" };
    throw error;
  }
  return done;
}

class NotFound extends Error {}

export async function setServiceActive(db: Db, id: string, active: boolean, actorId: string): Promise<CatalogResult> {
  const updated = await db.service.updateMany({ where: { id }, data: { active } });
  if (updated.count === 0) return { ok: false, error: "not_found" };
  await audit(db, { actorId, action: active ? "service.activated" : "service.deactivated", entityType: "Service", entityId: id });
  return done;
}

/* ----------------------------------------------------------------- Barbers */

export async function listBarbersForAdmin(db: Db, now = new Date()) {
  const barbers = await db.barber.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      role: true,
      imageId: true,
      active: true,
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { services: true, workingHours: true } },
    },
  });
  const upcoming = await db.appointment.groupBy({
    by: ["barberId"],
    where: { status: { in: [...ACTIVE_STATUSES] }, startsAt: { gte: now }, isDemo: false },
    _count: { _all: true },
  });
  return barbers.map((b) => ({ ...b, upcoming: upcoming.find((u) => u.barberId === b.id)?._count._all ?? 0 }));
}

export async function getBarberForEdit(db: Db, id: string, now = new Date()) {
  const barber = await db.barber.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      role: true,
      bio: true,
      specialties: true,
      yearsExperience: true,
      imageId: true,
      active: true,
      sortOrder: true,
      user: { select: { id: true, name: true, email: true, role: true } },
      services: { select: { serviceId: true } },
      workingHours: { orderBy: [{ weekday: "asc" }, { startMinute: "asc" }], select: { weekday: true, startMinute: true, endMinute: true } },
      timeOff: { where: { endsAt: { gt: now } }, orderBy: { startsAt: "asc" }, select: { id: true, startsAt: true, endsAt: true, reason: true } },
    },
  });
  if (!barber) return null;
  const upcoming = await db.appointment.count({
    where: { barberId: id, status: { in: [...ACTIVE_STATUSES] }, startsAt: { gte: now } },
  });
  return { ...barber, upcoming };
}

/** `imageIds`: the media library's ids (passed in so this module never imports image assets). */
export async function saveBarber(
  db: Db,
  input: BarberInput,
  actorId: string,
  mode: "create" | "update",
  imageIds: readonly string[],
): Promise<CatalogResult> {
  if (!imageIds.includes(input.imageId)) return { ok: false, error: "invalid_image" };
  const specialties = input.specialties.mn.map((mn, i) => ({ mn, en: input.specialties.en[i] }));
  try {
    await db.$transaction(async (tx) => {
      const before = mode === "update" ? await tx.barber.findUnique({ where: { id: input.id }, select: { active: true } }) : null;
      if (mode === "update" && !before) throw new NotFound();
      const data = {
        name: input.name,
        role: input.role,
        bio: input.bio,
        specialties,
        yearsExperience: input.yearsExperience,
        imageId: input.imageId,
        active: input.active,
        sortOrder: input.sortOrder,
      };
      if (mode === "create") await tx.barber.create({ data: { id: input.id, ...data } });
      else await tx.barber.update({ where: { id: input.id }, data });

      const serviceIds = (await tx.service.findMany({ where: { id: { in: input.serviceIds } }, select: { id: true } })).map((s) => s.id);
      await tx.barberService.deleteMany({ where: { barberId: input.id, serviceId: { notIn: serviceIds } } });
      await tx.barberService.createMany({ data: serviceIds.map((serviceId) => ({ barberId: input.id, serviceId })), skipDuplicates: true });

      await audit(tx, {
        actorId,
        action: mode === "create" ? "barber.created" : "barber.updated",
        entityType: "Barber",
        entityId: input.id,
        metadata: { active: input.active, serviceIds },
      });
      if (before && before.active !== input.active) {
        await audit(tx, { actorId, action: input.active ? "barber.activated" : "barber.deactivated", entityType: "Barber", entityId: input.id });
      }
    });
  } catch (error) {
    if (error instanceof NotFound) return { ok: false, error: "not_found" };
    if (isUniqueViolation(error)) return { ok: false, error: "taken" };
    throw error;
  }
  return done;
}

/* -------------------------------------------------------- Hours, time off */

/**
 * Replace a barber's weekly working blocks. Returns how many upcoming active
 * appointments now fall outside the new hours (they are kept; staff decide
 * whether to move them).
 */
export async function replaceWorkingHours(
  db: Db,
  barberId: string,
  blocks: WorkingBlock[],
  actorId: string,
  now = new Date(),
): Promise<CatalogResult<{ outside: number }>> {
  const exists = await db.barber.findUnique({ where: { id: barberId }, select: { id: true } });
  if (!exists) return { ok: false, error: "not_found" };
  await db.$transaction(async (tx) => {
    // Same lock order as booking, so hours can't change under a booking in flight.
    await tx.$queryRaw`SELECT "id" FROM "barbers" WHERE "id" = ${barberId} FOR UPDATE`;
    await tx.workingHour.deleteMany({ where: { barberId } });
    await tx.workingHour.createMany({ data: blocks.map((b) => ({ barberId, ...b })) });
    await audit(tx, {
      actorId,
      action: "barber.hours_updated",
      entityType: "Barber",
      entityId: barberId,
      metadata: { blocks: blocks.map((b) => [b.weekday, b.startMinute, b.endMinute]) },
    });
  });

  const { timeZone } = await getBookingRules(db);
  const upcoming = await db.appointment.findMany({
    where: { barberId, status: { in: [...ACTIVE_STATUSES] }, startsAt: { gte: now } },
    select: { startsAt: true, endsAt: true },
  });
  const outside = upcoming.filter((a) => {
    const start = zonedParts(a.startsAt, timeZone);
    const end = start.minutes + (a.endsAt.getTime() - a.startsAt.getTime()) / 60_000;
    return !blocks.some((b) => b.weekday === start.weekday && start.minutes >= b.startMinute && end <= b.endMinute);
  }).length;
  return { ok: true, value: { outside } };
}

export async function listStudioClosures(db: Db, now = new Date()) {
  return db.timeOff.findMany({
    where: { barberId: null, endsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
    select: { id: true, startsAt: true, endsAt: true, reason: true },
  });
}

/**
 * Add time off for a barber, or a studio closure (`barberId: "studio"`).
 * Existing appointments in that window are kept and counted, so staff can
 * contact those guests.
 */
export async function addTimeOff(db: Db, input: TimeOffInput, actorId: string): Promise<CatalogResult<{ affected: number }>> {
  const { timeZone } = await getBookingRules(db);
  const barberId = input.barberId === "studio" ? null : input.barberId;
  if (barberId && !(await db.barber.findUnique({ where: { id: barberId }, select: { id: true } }))) {
    return { ok: false, error: "not_found" };
  }
  const [startMinute, endMinute] = input.allDay
    ? [0, 0]
    : [input.startTime, input.endTime].map((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)));
  const startsAt = zonedTimeToUtc(input.startDate, startMinute, timeZone);
  const endsAt = input.allDay ? zonedTimeToUtc(addCalendarDays(input.endDate, 1), 0, timeZone) : zonedTimeToUtc(input.endDate, endMinute, timeZone);

  const entry = await db.timeOff.create({ data: { barberId, startsAt, endsAt, reason: input.reason || null } });
  await audit(db, {
    actorId,
    action: "time_off.created",
    entityType: "TimeOff",
    entityId: entry.id,
    metadata: { barberId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
  });
  const affected = await db.appointment.count({
    where: {
      ...(barberId ? { barberId } : {}),
      status: { in: [...ACTIVE_STATUSES] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  return { ok: true, value: { affected } };
}

export async function deleteTimeOff(db: Db, id: string, actorId: string): Promise<CatalogResult> {
  const entry = await db.timeOff.findUnique({ where: { id } });
  if (!entry) return { ok: false, error: "not_found" };
  await db.timeOff.delete({ where: { id } });
  await audit(db, {
    actorId,
    action: "time_off.deleted",
    entityType: "TimeOff",
    entityId: id,
    metadata: { barberId: entry.barberId, startsAt: entry.startsAt.toISOString(), endsAt: entry.endsAt.toISOString() },
  });
  return done;
}
