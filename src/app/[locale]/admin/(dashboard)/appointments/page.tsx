import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { AppointmentStatus as Statuses } from "@/generated/prisma/enums";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath, type Locale, type LocalizedText } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { routes } from "@/lib/navigation";
import { format } from "@/lib/format";
import { cn } from "@/lib/cn";
import { longDate, shortDate, tableDate, zoned } from "@/lib/admin/format";
import { addCalendarDays, isISODate, isoWeekday, zonedTimeToUtc } from "@/lib/booking/time";
import { db } from "@/lib/server/db";
import { adminContext, type AdminContext } from "@/lib/server/admin-context";
import { listAppointmentsBetween, listAppointmentsPage, type AppointmentListRow } from "@/lib/server/appointments";
import { hrefWith, queryOf, type Query } from "@/components/admin/filters";
import {
  EmptyState,
  inputClass,
  Notice,
  PageHeader,
  PageSkeleton,
  Pagination,
  primarySmallButton,
  smallButton,
  StatusBadge,
  TableFrame,
  Tag,
  td,
  th,
} from "@/components/admin/ui";
import { AppointmentDetail } from "./detail";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.admin.nav.appointments} · ${dict.meta.admin}`, robots: { index: false, follow: false } };
}

type Props = PageProps<"/[locale]/admin/appointments">;

export default async function AppointmentsPage({ searchParams }: Props) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={<PageSkeleton label={dict.admin.common.loading} />}>
      <Appointments locale={locale} dict={dict} searchParams={searchParams} />
    </Suspense>
  );
}

type View = "day" | "week" | "list";

/** Monday of the week containing `date`. */
function weekStart(date: string) {
  return addCalendarDays(date, -((isoWeekday(date) + 6) % 7));
}

async function Appointments({ locale, dict, searchParams }: { locale: Locale; dict: Dictionary; searchParams: Props["searchParams"] }) {
  const ctx = await adminContext(locale);
  const query = queryOf(await searchParams);
  const t = dict.admin;
  const base = localizedPath(locale, routes.adminAppointments);

  if (ctx.scope === null) {
    return (
      <>
        <PageHeader title={t.appointments.title} />
        <Notice className="mt-8">{t.common.noBarberLinked}</Notice>
      </>
    );
  }

  const view: View = query.view === "week" || query.view === "list" ? query.view : "day";
  const date = query.date && isISODate(query.date) ? query.date : ctx.today;
  const includeDemo = query.demo === "1";
  const status = query.status && query.status in Statuses ? (query.status as AppointmentStatus) : undefined;
  const allBarbers = ctx.scope === "all";

  const barbers = await db.barber.findMany({
    where: allBarbers ? {} : { id: ctx.scope },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, name: true, active: true },
  });
  const barberId = allBarbers && query.barber && barbers.some((b) => b.id === query.barber) ? query.barber : undefined;
  const name = (value: unknown) => (value as LocalizedText)[locale];

  // Keep these filters across views and date changes; drop the dialog and paging.
  const keep: Query = { view: view === "day" ? undefined : view, date: date === ctx.today ? undefined : date, barber: barberId, status, demo: query.demo, q: query.q, from: query.from, to: query.to };
  const link = (params: Query) => hrefWith(base, keep, { open: undefined, page: undefined, ...params });
  const closeHref = hrefWith(base, { ...keep, page: query.page }, {});

  return (
    <>
      <PageHeader
        title={t.appointments.title}
        actions={
          ctx.can("appointments.manage") && (
            <Link href={hrefWith(localizedPath(locale, routes.adminNewAppointment), {}, { date: date >= ctx.today ? date : undefined, barber: barberId })} className={primarySmallButton}>
              <Plus aria-hidden className="size-4" strokeWidth={1.75} />
              {t.appointments.newAppointment}
            </Link>
          )
        }
      />

      <div className="mt-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <nav aria-label={t.appointments.viewLabel} className="flex w-fit rounded-full border border-line-strong p-0.5">
          {(["day", "week", "list"] as const).map((v) => (
            <Link
              key={v}
              href={link({ view: v === "day" ? undefined : v })}
              aria-current={view === v ? "page" : undefined}
              className={cn("rounded-full px-4 py-1.5 text-sm font-medium", view === v ? "bg-ink text-paper" : "text-taupe-deep hover:text-ink")}
            >
              {t.appointments.views[v]}
            </Link>
          ))}
        </nav>

        <form method="get" action={base} className="flex flex-wrap items-end gap-2">
          {view !== "day" && <input type="hidden" name="view" value={view} />}
          {query.demo && <input type="hidden" name="demo" value={query.demo} />}
          {view !== "list" && (
            <label className="text-xs text-taupe-deep">
              <span className="mb-1 block">{t.appointments.goToDate}</span>
              <input type="date" name="date" defaultValue={date} className={cn(inputClass, "h-9 w-[9.5rem]")} />
            </label>
          )}
          {view === "list" && (
            <>
              <label className="text-xs text-taupe-deep">
                <span className="mb-1 block">{t.appointments.searchLabel}</span>
                <input type="search" name="q" defaultValue={query.q} placeholder={t.appointments.searchPlaceholder} maxLength={80} className={cn(inputClass, "h-9 w-56")} />
              </label>
              <label className="text-xs text-taupe-deep">
                <span className="mb-1 block">{t.range.from}</span>
                <input type="date" name="from" defaultValue={query.from} className={cn(inputClass, "h-9 w-[9.5rem]")} />
              </label>
              <label className="text-xs text-taupe-deep">
                <span className="mb-1 block">{t.range.to}</span>
                <input type="date" name="to" defaultValue={query.to} className={cn(inputClass, "h-9 w-[9.5rem]")} />
              </label>
            </>
          )}
          {allBarbers && (
            <label className="text-xs text-taupe-deep">
              <span className="mb-1 block">{t.common.barber}</span>
              <select name="barber" defaultValue={barberId ?? ""} className={cn(inputClass, "h-9 w-40")}>
                <option value="">{t.appointments.allBarbers}</option>
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {name(b.name)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-xs text-taupe-deep">
            <span className="mb-1 block">{t.common.status}</span>
            <select name="status" defaultValue={status ?? ""} className={cn(inputClass, "h-9 w-40")}>
              <option value="">{t.appointments.allStatuses}</option>
              {Object.values(Statuses).map((s) => (
                <option key={s} value={s}>
                  {t.status[s]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={smallButton}>
            {t.common.apply}
          </button>
        </form>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {view !== "list" ? (
          <DateNav dict={dict} locale={locale} view={view} date={date} today={ctx.today} link={link} />
        ) : (
          <span />
        )}
        <Link href={link({ demo: includeDemo ? undefined : "1" })} className="text-sm text-taupe-deep underline underline-offset-4 hover:text-ink">
          {includeDemo ? t.common.hideDemo : t.common.includeDemo}
        </Link>
      </div>
      {includeDemo && <Notice tone="demo" className="mt-4">{t.common.demoBanner}</Notice>}

      <div className="mt-6">
        {view === "day" && (
          <DayView ctx={ctx} dict={dict} locale={locale} date={date} barbers={barbers.filter((b) => !barberId || b.id === barberId)} filters={{ includeDemo, status, barberId }} link={link} />
        )}
        {view === "week" && <WeekView ctx={ctx} dict={dict} locale={locale} date={date} filters={{ includeDemo, status, barberId }} link={link} />}
        {view === "list" && (
          <ListView ctx={ctx} dict={dict} locale={locale} query={query} filters={{ includeDemo, status, barberId }} link={link} />
        )}
      </div>

      {query.open && (
        <AppointmentDetail ctx={ctx} dict={dict} locale={locale} id={query.open} closeHref={closeHref} />
      )}
    </>
  );
}

function DateNav({
  dict,
  locale,
  view,
  date,
  today,
  link,
}: {
  dict: Dictionary;
  locale: Locale;
  view: "day" | "week";
  date: string;
  today: string;
  link: (params: Query) => string;
}) {
  const t = dict.admin.appointments;
  const step = view === "day" ? 1 : 7;
  const target = (d: string) => link({ date: d === today ? undefined : d });
  const label = view === "day" ? longDate(date, dict) : format(t.weekOf, { date: shortDate(weekStart(date), locale, dict) });
  const nav = "inline-flex size-9 items-center justify-center rounded-full border border-line transition-colors hover:border-ink";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={target(addCalendarDays(date, -step))} aria-label={view === "day" ? t.prevDay : t.prevWeek} className={nav}>
        <ChevronLeft aria-hidden className="size-4" strokeWidth={1.75} />
      </Link>
      <Link href={target(addCalendarDays(date, step))} aria-label={view === "day" ? t.nextDay : t.nextWeek} className={nav}>
        <ChevronRight aria-hidden className="size-4" strokeWidth={1.75} />
      </Link>
      <h2 className="ml-1 font-semibold">{label}</h2>
      {date !== today && (
        <Link href={target(today)} className="ml-2 text-sm underline underline-offset-4 hover:opacity-70">
          {t.today}
        </Link>
      )}
    </div>
  );
}

interface Filters {
  includeDemo: boolean;
  status?: AppointmentStatus;
  barberId?: string;
}

const statusEdge: Record<AppointmentStatus, string> = {
  PENDING: "border-l-brass bg-brass/10",
  CONFIRMED: "border-l-ink bg-paper",
  COMPLETED: "border-l-taupe bg-paper-deep/70 text-taupe-deep",
  CANCELLED: "border-l-line-strong bg-paper-deep/40 text-taupe-deep line-through",
  NO_SHOW: "border-l-danger bg-danger/5",
};

/* ------------------------------------------------------------------- Day */

const PX_PER_MINUTE = 1.3;

async function DayView({
  ctx,
  dict,
  locale,
  date,
  barbers,
  filters,
  link,
}: {
  ctx: AdminContext;
  dict: Dictionary;
  locale: Locale;
  date: string;
  barbers: { id: string; name: unknown; active: boolean }[];
  filters: Filters;
  link: (params: Query) => string;
}) {
  const t = dict.admin;
  const weekday = isoWeekday(date);
  const dayStart = zonedTimeToUtc(date, 0, ctx.timeZone);
  const dayEnd = zonedTimeToUtc(addCalendarDays(date, 1), 0, ctx.timeZone);
  const [rows, hours, timeOff] = await Promise.all([
    listAppointmentsBetween(db, { scope: ctx.scope, includeDemo: filters.includeDemo, status: filters.status, barberId: filters.barberId, from: date, to: date }),
    db.workingHour.findMany({ where: { weekday, barberId: { in: barbers.map((b) => b.id) } }, orderBy: { startMinute: "asc" } }),
    db.timeOff.findMany({
      where: { startsAt: { lt: dayEnd }, endsAt: { gt: dayStart }, OR: [{ barberId: null }, { barberId: { in: barbers.map((b) => b.id) } }] },
    }),
  ]);
  const name = (value: unknown) => (value as LocalizedText)[locale];
  // Inactive barbers only appear when they still have appointments that day.
  const columns = barbers.filter((b) => b.active || rows.some((r) => r.barberId === b.id));
  const visible = rows.filter((r) => r.status !== "CANCELLED" || filters.status === "CANCELLED");
  const cancelled = rows.length - visible.length;

  const minutesOf = (d: Date) => Math.max(0, Math.min(1440, Math.round((d.getTime() - dayStart.getTime()) / 60_000)));
  const starts = [...hours.map((h) => h.startMinute), ...visible.map((r) => minutesOf(r.startsAt))];
  const ends = [...hours.map((h) => h.endMinute), ...visible.map((r) => minutesOf(r.endsAt))];
  const first = Math.floor(Math.min(9 * 60, ...starts) / 60) * 60;
  const last = Math.ceil(Math.max(20 * 60, ...ends) / 60) * 60;
  const height = (last - first) * PX_PER_MINUTE;
  const y = (minute: number) => (minute - first) * PX_PER_MINUTE;
  const hourMarks = Array.from({ length: (last - first) / 60 + 1 }, (_, i) => first + i * 60);

  if (columns.length === 0) return <EmptyState>{t.appointments.emptyDay}</EmptyState>;

  const card = (r: AppointmentListRow, compact = false) => {
    const start = zoned(r.startsAt, ctx.timeZone).time;
    const end = zoned(r.endsAt, ctx.timeZone).time;
    return (
      <Link
        href={link({ open: r.id, date: date === ctx.today ? undefined : date })}
        scroll={false}
        className={cn(
          "block overflow-hidden border border-l-[3px] border-line px-2 py-1.5 text-xs leading-snug transition-shadow hover:shadow-[0_2px_12px_-4px_rgb(22_21_19/0.35)] focus-visible:z-10",
          statusEdge[r.status],
          compact ? "" : "h-full",
        )}
      >
        <span className="tabular block font-semibold">
          {start}–{end}
        </span>
        <span className="block truncate font-medium">{r.customerName}</span>
        <span className="block truncate text-taupe-deep">{name(r.service.name)}</span>
        <span className="sr-only">
          , {name(r.barber.name)}, {t.status[r.status]}
        </span>
        {r.isDemo && <span className="mt-0.5 block text-[0.625rem] font-semibold uppercase tracking-wide text-taupe-deep">{t.common.sample}</span>}
      </Link>
    );
  };

  return (
    <>
      {rows.length === 0 && <p className="mb-4 text-sm text-taupe-deep">{t.appointments.emptyDay}</p>}

      {/* Phones and tablets: agenda per barber. */}
      <div className="space-y-6 md:hidden">
        {columns.map((b) => {
          const own = visible.filter((r) => r.barberId === b.id);
          const blocks = hours.filter((h) => h.barberId === b.id);
          return (
            <section key={b.id} aria-label={name(b.name)}>
              <h3 className="flex items-baseline justify-between border-b border-line-strong pb-2 text-sm font-semibold">
                {name(b.name)}
                <span className="tabular text-xs font-normal text-taupe-deep">
                  {blocks.length ? blocks.map((h) => `${zonedLabel(h.startMinute)}–${zonedLabel(h.endMinute)}`).join(", ") : t.appointments.dayOff}
                </span>
              </h3>
              {own.length === 0 ? (
                <p className="py-3 text-sm text-taupe-deep">—</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {own.map((r) => (
                    <li key={r.id}>{card(r, true)}</li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {/* Desktop: time grid with one column per barber. */}
      <div role="region" aria-label={longDate(date, dict)} tabIndex={0} className="hidden overflow-x-auto md:block">
        <div className="grid min-w-full" style={{ gridTemplateColumns: `3.5rem repeat(${columns.length}, minmax(9.5rem, 1fr))` }}>
          <div />
          {columns.map((b) => (
            <div key={b.id} className="truncate border-b border-line-strong px-2 pb-2 text-sm font-semibold">
              {name(b.name)}
              {!b.active && <span className="ml-1 text-xs font-normal text-taupe-deep">({t.common.inactive})</span>}
            </div>
          ))}

          <div aria-hidden className="relative" style={{ height }}>
            {hourMarks.map((m) => (
              <span key={m} className="tabular absolute right-2 -translate-y-1/2 text-[0.6875rem] text-taupe-deep" style={{ top: y(m) }}>
                {zonedLabel(m)}
              </span>
            ))}
          </div>
          {columns.map((b) => {
            const blocks = hours.filter((h) => h.barberId === b.id);
            const off = timeOff.filter((o) => o.barberId === null || o.barberId === b.id);
            return (
              <div key={b.id} className="relative border-l border-line bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(22_21_19/0.035)_6px_7px)]" style={{ height }}>
                {hourMarks.map((m) => (
                  <span key={m} aria-hidden className="absolute inset-x-0 h-px bg-line" style={{ top: y(m) }} />
                ))}
                {blocks.map((h) => (
                  <span key={h.id} aria-hidden className="absolute inset-x-0 bg-paper" style={{ top: y(h.startMinute), height: (h.endMinute - h.startMinute) * PX_PER_MINUTE }} />
                ))}
                {off.map((o) => {
                  const from = minutesOf(o.startsAt);
                  const to = minutesOf(o.endsAt);
                  return (
                    <span
                      key={o.id}
                      className="absolute inset-x-0 flex items-start bg-sand/45 px-2 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-taupe-deep"
                      style={{ top: y(Math.max(first, from)), height: Math.max(0, (Math.min(last, to) - Math.max(first, from)) * PX_PER_MINUTE) }}
                    >
                      {o.barberId === null ? t.common.wholeStudio : t.appointments.timeOff}
                    </span>
                  );
                })}
                {visible
                  .filter((r) => r.barberId === b.id)
                  .map((r) => {
                    const top = y(minutesOf(r.startsAt));
                    const h = Math.max(36, (minutesOf(r.endsAt) - minutesOf(r.startsAt)) * PX_PER_MINUTE - 2);
                    return (
                      <div key={r.id} className="absolute inset-x-1" style={{ top: top + 1, height: h }}>
                        {card(r)}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-xs text-taupe-deep">
        {t.appointments.outsideHoursNote}
        {cancelled > 0 && (
          <>
            {" "}
            <Link href={link({ view: "list", from: date, to: date, status: "CANCELLED" })} className="underline underline-offset-4">
              {cancelled} × {t.status.CANCELLED}
            </Link>
          </>
        )}
      </p>
    </>
  );
}

function zonedLabel(minute: number) {
  const h = Math.floor(minute / 60);
  return `${String(h).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ Week */

async function WeekView({
  ctx,
  dict,
  locale,
  date,
  filters,
  link,
}: {
  ctx: AdminContext;
  dict: Dictionary;
  locale: Locale;
  date: string;
  filters: Filters;
  link: (params: Query) => string;
}) {
  const t = dict.admin;
  const start = weekStart(date);
  const days = Array.from({ length: 7 }, (_, i) => addCalendarDays(start, i));
  const rows = await listAppointmentsBetween(db, {
    scope: ctx.scope,
    includeDemo: filters.includeDemo,
    status: filters.status,
    barberId: filters.barberId,
    from: days[0],
    to: days[6],
  });
  const name = (value: unknown) => (value as LocalizedText)[locale];
  const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

  return (
    <ol className="grid gap-px border border-line bg-line md:grid-cols-7">
      {days.map((day) => {
        const own = rows.filter((r) => zoned(r.startsAt, ctx.timeZone).date === day);
        return (
          <li key={day} className={cn("min-w-0 bg-paper p-2", day === ctx.today && "bg-paper-deep/50")}>
            <Link
              href={link({ view: undefined, date: day === ctx.today ? undefined : day })}
              className="flex items-baseline justify-between gap-2 px-1 pb-2 text-sm hover:underline"
            >
              <span className="font-semibold">{dict.calendar.weekdaysShort[weekdayKeys[isoWeekday(day)]]}</span>
              <span className="tabular text-taupe-deep">{shortDate(day, locale, dict)}</span>
            </Link>
            {own.length === 0 ? (
              <p className="px-1 pb-2 text-xs text-taupe-deep">—</p>
            ) : (
              <ul className="space-y-1.5">
                {own.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={link({ open: r.id })}
                      scroll={false}
                      className={cn("block border border-l-[3px] border-line px-2 py-1 text-xs leading-snug hover:shadow-[0_2px_12px_-4px_rgb(22_21_19/0.35)]", statusEdge[r.status])}
                    >
                      <span className="tabular font-semibold">{zoned(r.startsAt, ctx.timeZone).time}</span>{" "}
                      <span className="font-medium">{r.customerName}</span>
                      <span className="block truncate text-taupe-deep">
                        {name(r.service.name)}
                        {ctx.scope === "all" && ` · ${name(r.barber.name)}`}
                      </span>
                      <span className="sr-only">, {t.status[r.status]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ List */

async function ListView({
  ctx,
  dict,
  locale,
  query,
  filters,
  link,
}: {
  ctx: AdminContext;
  dict: Dictionary;
  locale: Locale;
  query: Query;
  filters: Filters;
  link: (params: Query) => string;
}) {
  const t = dict.admin;
  const page = Math.max(1, Number(query.page) || 1);
  const result = await listAppointmentsPage(
    db,
    {
      scope: ctx.scope,
      includeDemo: filters.includeDemo,
      status: filters.status,
      barberId: filters.barberId,
      from: query.from,
      to: query.to,
      q: query.q,
    },
    page,
  );
  const name = (value: unknown) => (value as LocalizedText)[locale];

  if (result.total === 0) return <EmptyState>{t.appointments.empty}</EmptyState>;

  return (
    <>
      <p className="mb-3 text-sm text-taupe-deep">{format(t.common.results, { count: result.total })}</p>
      <TableFrame label={t.appointments.title}>
        <thead>
          <tr>
            <th scope="col" className={th}>{t.common.date}</th>
            <th scope="col" className={th}>{t.common.customer}</th>
            <th scope="col" className={th}>{t.common.service}</th>
            {ctx.scope === "all" && <th scope="col" className={th}>{t.common.barber}</th>}
            <th scope="col" className={th}>{t.common.status}</th>
            <th scope="col" className={th}>{t.common.reference}</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((r) => {
            const when = zoned(r.startsAt, ctx.timeZone);
            return (
              <tr key={r.id} className="hover:bg-paper-deep/40">
                <td className={cn(td, "tabular whitespace-nowrap")}>
                  <Link href={link({ open: r.id, page: query.page })} scroll={false} className="font-medium underline-offset-4 hover:underline">
                    {tableDate(when.date, locale, dict)}, {when.time}
                  </Link>
                </td>
                <td className={td}>
                  {r.customerName}
                  {r.isDemo && <Tag className="ml-2">{t.common.sample}</Tag>}
                </td>
                <td className={td}>{name(r.service.name)}</td>
                {ctx.scope === "all" && <td className={td}>{name(r.barber.name)}</td>}
                <td className={td}>
                  <StatusBadge status={r.status} label={t.status[r.status]} />
                </td>
                <td className={cn(td, "tabular text-taupe-deep")}>{r.reference}</td>
              </tr>
            );
          })}
        </tbody>
      </TableFrame>
      <Pagination dict={dict} page={result.page} pageSize={result.pageSize} total={result.total} href={(p) => link({ page: p === 1 ? undefined : String(p) })} />
    </>
  );
}
