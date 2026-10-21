import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "./db";
import { ACTIVE_STATUSES } from "@/lib/booking/status";
import { normalizePhone } from "@/lib/booking/validation";

/*
 * Customer records for staff with `customers.view`. Lists carry only what's
 * needed to find someone (name, masked phone, visit counts); full contact
 * details appear on a customer's own page. Customers have no accounts, so a
 * record is just what their bookings submitted.
 */

export type CustomerFilter = "all" | "upcoming" | "returning" | "noShow";
export const customerFilters: CustomerFilter[] = ["all", "upcoming", "returning", "noShow"];

export async function listCustomers(
  db: Db,
  options: { q?: string; filter: CustomerFilter; includeDemo: boolean; page: number; pageSize?: number },
  now = new Date(),
) {
  const pageSize = options.pageSize ?? 25;
  const and: Prisma.CustomerWhereInput[] = [];
  if (!options.includeDemo) and.push({ isDemo: false });
  const q = options.q?.trim().slice(0, 80);
  if (q) {
    const digits = normalizePhone(q);
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        ...(/^\d{3,}$/.test(digits) ? [{ phone: { contains: digits } }] : []),
      ],
    });
  }
  if (options.filter === "upcoming") {
    and.push({ appointments: { some: { status: { in: [...ACTIVE_STATUSES] }, startsAt: { gte: now } } } });
  }
  if (options.filter === "noShow") and.push({ appointments: { some: { status: "NO_SHOW" } } });

  let ids: string[] | undefined;
  if (options.filter === "returning") {
    // Two or more completed visits.
    const grouped = await db.appointment.groupBy({
      by: ["customerId"],
      where: { status: "COMPLETED", ...(options.includeDemo ? {} : { isDemo: false }) },
      _count: { _all: true },
      having: { customerId: { _count: { gte: 2 } } },
    });
    ids = grouped.map((g) => g.customerId);
    and.push({ id: { in: ids } });
  }

  const where: Prisma.CustomerWhereInput = { AND: and };
  const page = Math.max(1, options.page);
  const [total, rows] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, name: true, phone: true, isDemo: true, createdAt: true },
    }),
  ]);

  const stats = rows.length
    ? await db.appointment.groupBy({
        by: ["customerId", "status"],
        where: { customerId: { in: rows.map((r) => r.id) } },
        _count: { _all: true },
        _max: { startsAt: true },
      })
    : [];
  const upcoming = rows.length
    ? await db.appointment.groupBy({
        by: ["customerId"],
        where: { customerId: { in: rows.map((r) => r.id) }, status: { in: [...ACTIVE_STATUSES] }, startsAt: { gte: now } },
        _min: { startsAt: true },
      })
    : [];

  return {
    total,
    page,
    pageSize,
    rows: rows.map((r) => {
      const own = stats.filter((s) => s.customerId === r.id);
      const count = (status: string) => own.find((s) => s.status === status)?._count._all ?? 0;
      const lastVisit = own
        .filter((s) => s.status === "COMPLETED")
        .map((s) => s._max.startsAt)
        .find(Boolean);
      return {
        ...r,
        completed: count("COMPLETED"),
        noShows: count("NO_SHOW"),
        cancelled: count("CANCELLED"),
        lastVisit: lastVisit ?? null,
        nextVisit: upcoming.find((u) => u.customerId === r.id)?._min.startsAt ?? null,
      };
    }),
  };
}

export async function getCustomerDetail(db: Db, id: string, options: { page: number; pageSize?: number }) {
  const pageSize = options.pageSize ?? 20;
  const customer = await db.customer.findUnique({
    where: { id },
    select: { id: true, name: true, phone: true, email: true, isDemo: true, createdAt: true },
  });
  if (!customer) return null;
  const page = Math.max(1, options.page);
  const [total, appointments, byStatus, spent] = await Promise.all([
    db.appointment.count({ where: { customerId: id } }),
    db.appointment.findMany({
      where: { customerId: id },
      orderBy: { startsAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        reference: true,
        startsAt: true,
        status: true,
        priceMnt: true,
        isDemo: true,
        notes: true,
        service: { select: { name: true } },
        barber: { select: { name: true } },
      },
    }),
    db.appointment.groupBy({ by: ["status"], where: { customerId: id }, _count: { _all: true } }),
    db.appointment.aggregate({ where: { customerId: id, status: "COMPLETED" }, _sum: { priceMnt: true } }),
  ]);
  return {
    customer,
    appointments,
    total,
    page,
    pageSize,
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) as Record<string, number>,
    completedSpend: spent._sum.priceMnt ?? 0,
  };
}
