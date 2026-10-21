import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath, type Locale, type LocalizedText } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { routes } from "@/lib/navigation";
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
import { Notice, PageHeader, PageSkeleton, Section, StatTile, StatusBadge, Tag, textLink } from "@/components/admin/ui";

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

  return (
    <>
      <PageHeader
        title={t.overview.title}
        lead={ctx.user.role === "BARBER" ? t.overview.leadBarber : longDate(ctx.today, dict)}
        actions={<DemoToggle dict={dict} base={base} query={query} includeDemo={includeDemo} />}
      />
      {includeDemo && <Notice tone="demo" className="mt-6">{t.common.demoBanner}</Notice>}
      {!includeDemo && demoExists && totals.appointments === 0 && today.length === 0 && (
        <Notice className="mt-6">{t.common.demoHiddenEmpty}</Notice>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <StatTile
          label={t.overview.today}
          value={today.filter((a) => a.status !== "CANCELLED").length}
          hint={format(t.overview.remaining, { count: remaining })}
          action={<Link href={calendar} className={textLink}>{t.overview.openCalendar}</Link>}
        />
        <StatTile label={t.overview.upcoming} value={upcoming} hint={t.overview.upcomingHint} />
        <StatTile
          label={t.overview.pending}
          value={pending}
          hint={t.overview.pendingHint}
          action={
            pending > 0 && (
              <Link href={`${calendar}?view=list&status=PENDING&from=${ctx.today}${includeDemo ? "&demo=1" : ""}`} className={textLink}>
                {t.overview.review}
              </Link>
            )
          }
        />
      </div>

      <Section id={`today-${locale}`} title={t.overview.today}>
        {today.length === 0 ? (
          <p className="text-sm text-taupe-deep">{t.overview.todayEmpty}</p>
        ) : (
          <ul className="border-t border-line">
            {today.map((a) => (
              <li key={a.id}>
                <Link
                  href={open(a.id, ctx.today)}
                  className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-4 border-b border-line py-3 hover:bg-paper-deep/50 sm:grid-cols-[4rem_minmax(0,1fr)_minmax(0,12rem)_auto]"
                >
                  <span className="tabular text-sm font-semibold">{zoned(a.startsAt, ctx.timeZone).time}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{a.customerName}</span>
                    <span className="block truncate text-xs text-taupe-deep">{name(a.service.name)}</span>
                  </span>
                  <span className="hidden truncate text-sm text-taupe-deep sm:block">{allBarbers ? name(a.barber.name) : null}</span>
                  <span className="flex items-center gap-2">
                    {a.isDemo && <Tag>{t.common.sample}</Tag>}
                    <StatusBadge status={a.status} label={t.status[a.status]} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id={`performance-${locale}`} title={t.overview.performance}>
        <RangeFilter dict={dict} base={base} query={query} preset={range.preset} from={range.from} to={range.to} />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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

        <div className={finance ? "mt-12 grid gap-12 lg:grid-cols-2" : "mt-12"}>
          {finance && (
            <div className="min-w-0">
              <h3 className="mb-4 text-sm font-semibold">{t.overview.revenueTrend}</h3>
              <RevenueTrend dict={dict} locale={locale} trend={metrics.trend} title={t.overview.revenueTrend} />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="mb-4 text-sm font-semibold">{t.overview.bookingTrend}</h3>
            <BookingTrend dict={dict} locale={locale} trend={metrics.trend} title={t.overview.bookingTrend} />
          </div>
        </div>

        {allBarbers && metrics.barbers.length > 0 && (
          <div className="mt-12 max-w-2xl">
            <h3 className="mb-4 text-sm font-semibold">{t.overview.utilizationByBarber}</h3>
            <UtilizationList dict={dict} locale={locale} barbers={metrics.barbers} label={t.overview.utilizationByBarber} />
          </div>
        )}
        {finance && (
          <p className="mt-8 text-sm">
            <Link href={hrefWith(localizedPath(locale, routes.adminAnalytics), query, {})} className={textLink}>
              {t.overview.openAnalytics}
            </Link>
          </p>
        )}
      </Section>

      <Section id={`recent-${locale}`} title={t.overview.recent}>
        {recent.length === 0 ? (
          <p className="text-sm text-taupe-deep">{t.overview.recentEmpty}</p>
        ) : (
          <ul className="border-t border-line">
            {recent.map((a) => {
              const isNew = a.updatedAt.getTime() - a.createdAt.getTime() < 1000;
              return (
                <li key={a.id}>
                  <Link
                    href={open(a.id, zoned(a.startsAt, ctx.timeZone).date)}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line py-3 text-sm hover:bg-paper-deep/50"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{a.customerName}</span>
                      <span className="text-taupe-deep"> · {name(a.service.name)} · {dateTime(a.startsAt, ctx.timeZone, locale, dict)}</span>
                    </span>
                    <span className="flex items-center gap-3 text-xs text-taupe-deep">
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
