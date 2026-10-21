import "server-only";
import type { Db } from "./db";
import {
  computeBarberStats,
  computeReturning,
  computeServiceStats,
  computeTotals,
  computeTrend,
  rangeBounds,
  type DateRange,
  type MetricAppointment,
} from "@/lib/admin/metrics";
import { addCalendarDays, zonedTimeToUtc } from "@/lib/booking/time";
import { scopeWhere, type Scope } from "./appointments";
import { getBookingRules } from "./settings";

/*
 * Loads the rows behind the dashboard's metrics; the arithmetic and the
 * definitions live in lib/admin/metrics.ts. Callers authorize: totals with
 * revenue need `finance.view`.
 */

async function loadRows(db: Db, range: DateRange, options: { includeDemo: boolean; scope: Scope; timeZone: string }) {
  const { start, end } = rangeBounds(range, options.timeZone);
  return db.appointment.findMany({
    where: {
      AND: [scopeWhere(options.scope), { startsAt: { gte: start, lt: end } }, options.includeDemo ? {} : { isDemo: false }],
    },
    select: { startsAt: true, endsAt: true, status: true, priceMnt: true, barberId: true, serviceId: true, customerId: true },
  }) as Promise<MetricAppointment[]>;
}

async function loadSchedules(db: Db, range: DateRange, scope: Scope, timeZone: string) {
  const { start, end } = rangeBounds(range, timeZone);
  const barbers = await db.barber.findMany({
    where: { ...(scope === "all" ? {} : { id: { in: scope ? [scope] : [] } }), OR: [{ active: true }, { appointments: { some: { startsAt: { gte: start, lt: end } } } }] },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      active: true,
      workingHours: { select: { weekday: true, startMinute: true, endMinute: true } },
    },
  });
  const timeOff = await db.timeOff.findMany({
    where: { startsAt: { lt: end }, endsAt: { gt: start }, OR: [{ barberId: null }, { barberId: { in: barbers.map((b) => b.id) } }] },
    select: { barberId: true, startsAt: true, endsAt: true },
  });
  return barbers.map((b) => ({
    barber: b,
    schedule: {
      barberId: b.id,
      blocks: b.workingHours,
      timeOff: timeOff.filter((t) => t.barberId === null || t.barberId === b.id),
    },
  }));
}

/** Everything the analytics page and the overview cards need for one range. */
export async function getMetrics(db: Db, range: DateRange, options: { includeDemo: boolean; scope: Scope }) {
  const { timeZone } = await getBookingRules(db);
  const [rows, schedules, services] = await Promise.all([
    loadRows(db, range, { ...options, timeZone }),
    loadSchedules(db, range, options.scope, timeZone),
    db.service.findMany({ select: { id: true, name: true } }),
  ]);

  const end = zonedTimeToUtc(addCalendarDays(range.to, 1), 0, timeZone);
  const customerIds = [...new Set(rows.filter((r) => r.status === "COMPLETED").map((r) => r.customerId))];
  const counts = customerIds.length
    ? await db.appointment.groupBy({
        by: ["customerId"],
        where: {
          customerId: { in: customerIds },
          status: "COMPLETED",
          startsAt: { lt: end },
          ...(options.includeDemo ? {} : { isDemo: false }),
        },
        _count: { _all: true },
      })
    : [];

  return {
    timeZone,
    totals: computeTotals(rows),
    trend: computeTrend(rows, range, timeZone),
    services: computeServiceStats(rows).map((s) => ({ ...s, name: services.find((x) => x.id === s.serviceId)?.name ?? null })),
    barbers: computeBarberStats(
      rows,
      schedules.map((s) => s.schedule),
      range,
      timeZone,
    ).map((s) => ({ ...s, barber: schedules.find((x) => x.barber.id === s.barberId)?.barber ?? null })),
    returning: computeReturning(rows, new Map(counts.map((c) => [c.customerId, c._count._all]))),
  };
}

/** Whether sample appointments exist at all (to explain an empty real dataset). */
export async function hasDemoAppointments(db: Db): Promise<boolean> {
  return (await db.appointment.count({ where: { isDemo: true }, take: 1 })) > 0;
}
