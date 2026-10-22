import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Plus } from "lucide-react";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath, type Locale, type LocalizedText } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { routes } from "@/lib/navigation";
import { cn } from "@/lib/cn";
import { format, formatPrice } from "@/lib/format";
import { dateTime, longDate, percent, zoned } from "@/lib/admin/format";
import { resolveRange } from "@/lib/admin/metrics";
import { ACTIVE_STATUSES } from "@/lib/booking/status";
import { addCalendarDays, zonedTimeToUtc } from "@/lib/booking/time";
import { db } from "@/lib/server/db";
import { adminContext } from "@/lib/server/admin-context";
import { listAppointmentsBetween, recentAppointmentActivity, scopeWhere } from "@/lib/server/appointments";
import { getMetrics, hasDemoAppointments } from "@/lib/server/metrics";
import { DemoToggle, hrefWith, queryOf, RangeFilter } from "@/components/admin/filters";
import { BookingTrend, RevenueTrend, UtilizationList } from "@/components/admin/metrics-view";
import { Notice, PageHeader, PageSkeleton, primarySmallButton, Section, smallButton, StatGroup, StatTile, StatusBadge, Tag } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.admin.nav.overview} · ${dict.meta.admin}`, robots: { index: false, follow: false } };
}

export default async function OverviewPage({ searchParams }: PageProps<"/[locale]/admin">) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={<PageSkeleton label={dict.admin.common.loading} />}>
      <Overview locale={locale} dict={dict} searchParams={searchParams} />
    </Suspense>
  );
}

async function Overview({
  locale,
  dict,
  searchParams,
}: {
  locale: Locale;
  dict: Dictionary;
  searchParams: PageProps<"/[locale]/admin">["searchParams"];
}) {
  const ctx = await adminContext(locale);
  const query = queryOf(await searchParams);
  const t = dict.admin;
  const base = localizedPath(locale, routes.admin);
  const calendar = localizedPath(locale, routes.adminAppointments);
  const name = (value: unknown) => (value as LocalizedText)[locale];

  if (ctx.scope === null) {
    return (
      <>
        <PageHeader title={t.overview.title} />
        <Notice className="mt-8">{t.common.noBarberLinked}</Notice>
      </>
    );
  }

  const includeDemo = query.demo === "1";
  const range = resolveRange(query, ctx.today);
  const finance = ctx.can("finance.view");
  const allBarbers = ctx.scope === "all";
  const demoFilter = includeDemo ? {} : { isDemo: false };
  const weekEnd = zonedTimeToUtc(addCalendarDays(ctx.today, 7), 0, ctx.timeZone);

  const [today, upcoming, pending, metrics, recent, demoExists] = await Promise.all([
    listAppointmentsBetween(db, { scope: ctx.scope, includeDemo, from: ctx.today, to: ctx.today }),
    db.appointment.count({
      where: { AND: [scopeWhere(ctx.scope), demoFilter, { status: { in: [...ACTIVE_STATUSES] }, startsAt: { gte: ctx.now, lt: weekEnd } }] },
    }),
    db.appointment.count({ where: { AND: [scopeWhere(ctx.scope), demoFilter, { status: "PENDING", startsAt: { gte: ctx.now } }] } }),
    getMetrics(db, range, { includeDemo, scope: ctx.scope }),
    recentAppointmentActivity(db, ctx.scope, includeDemo),
    includeDemo ? Promise.resolve(true) : hasDemoAppointments(db),
  ]);

  const remaining = today.filter((a) => a.startsAt > ctx.now && (a.status === "PENDING" || a.status === "CONFIRMED")).length;
  const { totals } = metrics;
  const utilized = metrics.barbers.filter((b) => b.scheduledMinutes > 0);
  const booked = utilized.reduce((s, b) => s + Math.min(b.bookedMinutes, b.scheduledMinutes), 0);
  const scheduled = utilized.reduce((s, b) => s + b.scheduledMinutes, 0);
  const open = (id: string, date: string) => `${calendar}?date=${date}&open=${encodeURIComponent(id)}`;

  const active = today.filter((a) => a.status !== "CANCELLED");
  const newAppointment = localizedPath(locale, routes.adminNewAppointment);

  return (
    <>
      <PageHeader
        title={t.overview.title}
        lead={ctx.user.role === "BARBER" ? t.overview.leadBarber : longDate(ctx.today, dict)}
        actions={
          <>
            <DemoToggle dict={dict} base={base} query={query} includeDemo={includeDemo} />
            {ctx.can("appointments.manage") && (
              <Link href={newAppointment} className={primarySmallButton}>
                <Plus aria-hidden className="size-4" strokeWidth={1.75} />
                {t.appointments.newAppointment}
              </Link>
            )}
          </>
        }
      />
      {includeDemo && <Notice tone="demo" className="mt-6">{t.common.demoBanner}</Notice>}
      {!includeDemo && demoExists && totals.appointments === 0 && today.length === 0 && (
        <Notice className="mt-6">{t.common.demoHiddenEmpty}</Notice>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* Today: the focal panel. */}
        <section aria-labelledby={`today-${locale}`} className="min-w-0 rounded-2xl border border-line bg-surface lg:col-span-8">
          <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-5 sm:px-6">
            <div>
              <h2 id={`today-${locale}`} className="text-sm text-muted">
                {t.overview.today}
              </h2>
              <p className="mt-1 flex items-baseline gap-3">
                <span className="numeric text-[2.5rem] font-medium leading-none tracking-[-0.04em]">{active.length}</span>
                <span className="text-sm text-muted">{format(t.overview.remaining, { count: remaining })}</span>
              </p>
            </div>
            <Link href={calendar} className={smallButton}>
              <CalendarDays aria-hidden className="size-4" strokeWidth={1.75} />
              {t.overview.openCalendar}
            </Link>
          </div>
          <div className="mt-5">
            {today.length === 0 ? (
              <p className="mx-5 mb-5 rounded-xl border border-dashed border-line-strong px-4 py-10 text-center text-sm text-muted sm:mx-6 sm:mb-6">
                {t.overview.todayEmpty}
              </p>
            ) : (
              <ol className="border-t border-line">
                {today.map((a) => {
                  const past = a.endsAt <= ctx.now;
                  return (
                    <li key={a.id}>
                      <Link
                        href={open(a.id, ctx.today)}
                        className={cn(
                          "grid grid-cols-[3.75rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-line px-5 py-3 transition-colors last:border-b-0 hover:bg-canvas/70 sm:grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,11rem)_auto] sm:px-6",
                          past && "text-muted",
                        )}
                      >
                        <span className="tabular text-sm font-medium">{zoned(a.startsAt, ctx.timeZone).time}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{a.customerName}</span>
                          <span className="block truncate text-xs text-muted">{name(a.service.name)}</span>
                        </span>
                        <span className="hidden truncate text-sm text-muted sm:block">{allBarbers ? name(a.barber.name) : null}</span>
                        <span className="flex items-center gap-2">
                          {/* Phones: the demo banner above already marks sample data; keep the width for the name. */}
                          {a.isDemo && (
                            <span className="hidden sm:contents">
                              <Tag>{t.common.sample}</Tag>
                            </span>
                          )}
                          <StatusBadge status={a.status} label={t.status[a.status]} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>

        {/* What needs attention next. */}
        <StatGroup className="self-start lg:col-span-4">
          <StatTile
            label={t.overview.pending}
            value={pending}
            size="lg"
            tone={pending > 0 ? "attention" : "default"}
            hint={t.overview.pendingHint}
            action={
              pending > 0 && (
                <Link href={`${calendar}?view=list&status=PENDING&from=${ctx.today}${includeDemo ? "&demo=1" : ""}`} className={cn(primarySmallButton, "w-full")}>
                  {t.overview.review}
                </Link>
              )
            }
          />
          <StatTile label={t.overview.upcoming} value={upcoming} size="lg" hint={t.overview.upcomingHint} />
        </StatGroup>
      </div>

      <section aria-labelledby={`performance-${locale}`} className="mt-6 min-w-0 rounded-2xl border border-line bg-surface">
        <div className="flex flex-col gap-4 border-b border-line px-5 py-4 sm:px-6">
          <h2 id={`performance-${locale}`} className="text-base font-medium tracking-[-0.01em]">
            {t.overview.performance}
          </h2>
          <RangeFilter dict={dict} base={base} query={query} preset={range.preset} from={range.from} to={range.to} />
        </div>

        {/* An odd last tile spans the row at two columns so no empty cell shows. */}
        <div
          className={cn(
            "grid gap-px bg-line sm:grid-cols-2 sm:[&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1",
            finance ? "lg:grid-cols-5" : "lg:grid-cols-3",
          )}
        >
          {finance && (
            <>
              <StatTile label={t.overview.revenue} value={formatPrice(totals.completedRevenue, locale)} hint={t.overview.revenueHint} />
              <StatTile label={t.overview.scheduledValue} value={formatPrice(totals.scheduledValue, locale)} hint={t.overview.scheduledHint} tone="muted" />
            </>
          )}
          <StatTile
            label={t.overview.cancellations}
            value={totals.byStatus.CANCELLED}
            hint={totals.appointments ? format(t.overview.cancellationHint, { rate: percent(totals.cancellationRate) }) : t.overview.noRate}
          />
          <StatTile
            label={t.overview.noShows}
            value={totals.byStatus.NO_SHOW}
            hint={totals.noShowRate !== null ? format(t.overview.noShowHint, { rate: percent(totals.noShowRate) }) : t.overview.noRate}
          />
          <StatTile label={t.overview.utilization} value={percent(scheduled > 0 ? booked / scheduled : null)} hint={t.overview.utilizationHint} />
        </div>

        <div className={cn("grid border-t border-line", finance && "lg:grid-cols-2")}>
          {finance && (
            <div className="min-w-0 border-b border-line p-5 sm:p-6 lg:border-b-0 lg:border-r">
              <h3 className="mb-5 text-sm font-medium">{t.overview.revenueTrend}</h3>
              <RevenueTrend dict={dict} locale={locale} trend={metrics.trend} title={t.overview.revenueTrend} />
            </div>
          )}
          <div className="min-w-0 p-5 sm:p-6">
            <h3 className="mb-5 text-sm font-medium">{t.overview.bookingTrend}</h3>
            <BookingTrend dict={dict} locale={locale} trend={metrics.trend} title={t.overview.bookingTrend} />
          </div>
        </div>

        {allBarbers && metrics.barbers.length > 0 && (
          <div className="border-t border-line p-5 sm:p-6">
            <h3 className="mb-5 text-sm font-medium">{t.overview.utilizationByBarber}</h3>
            <div className="max-w-3xl">
              <UtilizationList dict={dict} locale={locale} barbers={metrics.barbers} label={t.overview.utilizationByBarber} />
            </div>
          </div>
        )}
        {finance && (
          <div className="border-t border-line px-5 py-4 text-sm sm:px-6">
            <Link href={hrefWith(localizedPath(locale, routes.adminAnalytics), query, {})} className="group inline-flex items-center gap-1.5 font-medium">
              {t.overview.openAnalytics}
              <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
            </Link>
          </div>
        )}
      </section>

      <Section id={`recent-${locale}`} title={t.overview.recent} flush={recent.length > 0}>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">{t.overview.recentEmpty}</p>
        ) : (
          <ul className="border-t border-line">
            {recent.map((a) => {
              const isNew = a.updatedAt.getTime() - a.createdAt.getTime() < 1000;
              return (
                <li key={a.id}>
                  <Link
                    href={open(a.id, zoned(a.startsAt, ctx.timeZone).date)}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-3 text-sm transition-colors hover:bg-canvas/70 sm:px-6"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{a.customerName}</span>
                      <span className="text-muted"> · {name(a.service.name)} · {dateTime(a.startsAt, ctx.timeZone, locale, dict)}</span>
                    </span>
                    <span className="flex items-center gap-3 text-xs text-muted">
                      <span>{isNew ? t.source[a.source] : format(t.overview.updated, { time: dateTime(a.updatedAt, ctx.timeZone, locale, dict) })}</span>
                      <StatusBadge status={a.status} label={t.status[a.status]} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
