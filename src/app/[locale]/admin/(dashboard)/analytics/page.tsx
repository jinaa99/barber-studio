import { Suspense } from "react";
import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath, type Locale, type LocalizedText } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { routes } from "@/lib/navigation";
import { format, formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { percent, tableDate } from "@/lib/admin/format";
import { resolveRange } from "@/lib/admin/metrics";
import { db } from "@/lib/server/db";
import { adminContext } from "@/lib/server/admin-context";
import { getMetrics, hasDemoAppointments } from "@/lib/server/metrics";
import { BarList, DataTable } from "@/components/admin/charts";
import { DemoToggle, queryOf, RangeFilter } from "@/components/admin/filters";
import { BookingTrend, RevenueTrend, UtilizationList } from "@/components/admin/metrics-view";
import { EmptyState, Forbidden, Notice, PageHeader, PageSkeleton, Section, StatTile, TableFrame, td, th } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.admin.nav.analytics} · ${dict.meta.admin}`, robots: { index: false, follow: false } };
}

type Props = PageProps<"/[locale]/admin/analytics">;

export default async function AnalyticsPage({ searchParams }: Props) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={<PageSkeleton label={dict.admin.common.loading} />}>
      <Analytics locale={locale} dict={dict} searchParams={searchParams} />
    </Suspense>
  );
}

const statusOrder: AppointmentStatus[] = ["COMPLETED", "CONFIRMED", "PENDING", "CANCELLED", "NO_SHOW"];

async function Analytics({ locale, dict, searchParams }: { locale: Locale; dict: Dictionary; searchParams: Props["searchParams"] }) {
  const ctx = await adminContext(locale);
  if (!ctx.can("finance.view")) return <Forbidden dict={dict} />;
  const t = dict.admin;
  const a = t.analytics;
  const query = queryOf(await searchParams);
  const base = localizedPath(locale, routes.adminAnalytics);
  const includeDemo = query.demo === "1";
  const range = resolveRange(query, ctx.today);
  const [metrics, demoExists] = await Promise.all([
    getMetrics(db, range, { includeDemo, scope: "all" }),
    includeDemo ? Promise.resolve(true) : hasDemoAppointments(db),
  ]);
  const { totals } = metrics;
  const name = (value: unknown) => (value as LocalizedText)[locale];
  const empty = totals.appointments === 0;

  return (
    <>
      <PageHeader
        title={a.title}
        lead={a.lead}
        actions={<DemoToggle dict={dict} base={base} query={query} includeDemo={includeDemo} />}
      />
      <div className="mt-6">
        <RangeFilter dict={dict} base={base} query={query} preset={range.preset} from={range.from} to={range.to} />
        <p className="mt-3 text-sm text-taupe-deep">
          {format(t.range.summary, { from: tableDate(range.from, locale, dict), to: tableDate(range.to, locale, dict) })}
        </p>
      </div>
      {includeDemo && <Notice tone="demo" className="mt-6">{t.common.demoBanner}</Notice>}
      {!includeDemo && empty && demoExists && <Notice className="mt-6">{t.common.demoHiddenEmpty}</Notice>}

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t.overview.revenue} value={formatPrice(totals.completedRevenue, locale)} hint={t.overview.revenueHint} />
        <StatTile label={t.overview.scheduledValue} value={formatPrice(totals.scheduledValue, locale)} hint={t.overview.scheduledHint} tone="muted" />
        <StatTile label={a.averageTicket} value={totals.averageTicket === null ? "—" : formatPrice(totals.averageTicket, locale)} />
        <StatTile label={a.appointments} value={totals.appointments} />
      </div>

      {empty ? (
        <div className="mt-12">
          <EmptyState>{a.noData}</EmptyState>
        </div>
      ) : (
        <>
          <div className="grid gap-x-12 lg:grid-cols-2">
            <Section id={`revenue-${locale}`} title={a.revenueOverTime}>
              <RevenueTrend dict={dict} locale={locale} trend={metrics.trend} title={a.revenueOverTime} />
            </Section>
            <Section id={`bookings-${locale}`} title={a.bookingsOverTime} lead={a.bookingsHint}>
              <BookingTrend dict={dict} locale={locale} trend={metrics.trend} title={a.bookingsOverTime} />
            </Section>
          </div>

          <div className="grid gap-x-12 lg:grid-cols-2">
            <Section id={`services-${locale}`} title={a.popularServices}>
              <BarList
                label={a.popularServices}
                data={metrics.services.slice(0, 8).map((s) => ({
                  key: s.serviceId,
                  label: s.name ? name(s.name) : s.serviceId,
                  value: s.booked,
                  display: s.booked,
                  detail: `${a.completed}: ${s.completed} · ${a.revenue}: ${formatPrice(s.completedRevenue, locale)}`,
                }))}
              />
              <DataTable
                label={a.showTable}
                head={[t.common.service, a.booked, a.completed, a.revenue]}
                rows={metrics.services.map((s) => [s.name ? name(s.name) : s.serviceId, s.booked, s.completed, formatPrice(s.completedRevenue, locale)])}
              />
            </Section>

            <Section id={`status-${locale}`} title={a.statusDistribution}>
              <BarList
                label={a.statusDistribution}
                max={totals.appointments}
                data={statusOrder.map((s) => ({
                  key: s,
                  label: t.status[s],
                  value: totals.byStatus[s],
                  display: `${totals.byStatus[s]} · ${percent(totals.byStatus[s] / totals.appointments)}`,
                }))}
              />
              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-taupe-deep">{t.overview.cancellations}</dt>
                  <dd className="mt-1 text-xl font-semibold">{percent(totals.cancellationRate)}</dd>
                </div>
                <div>
                  <dt className="text-taupe-deep">{t.overview.noShows}</dt>
                  <dd className="mt-1 text-xl font-semibold">{percent(totals.noShowRate)}</dd>
                </div>
              </dl>
            </Section>
          </div>

          <Section id={`barbers-${locale}`} title={a.barberPerformance}>
            <TableFrame label={a.barberPerformance}>
              <thead>
                <tr>
                  <th scope="col" className={th}>{t.common.barber}</th>
                  <th scope="col" className={cn(th, "text-right")}>{a.appointments}</th>
                  <th scope="col" className={cn(th, "text-right")}>{a.completed}</th>
                  <th scope="col" className={cn(th, "text-right")}>{t.overview.noShows}</th>
                  <th scope="col" className={cn(th, "text-right")}>{a.revenue}</th>
                  <th scope="col" className={cn(th, "text-right")}>{a.utilization}</th>
                </tr>
              </thead>
              <tbody>
                {metrics.barbers.map((b) => (
                  <tr key={b.barberId}>
                    <th scope="row" className={cn(td, "font-medium")}>
                      {b.barber ? name(b.barber.name) : b.barberId}
                    </th>
                    <td className={cn(td, "tabular text-right")}>{b.appointments}</td>
                    <td className={cn(td, "tabular text-right")}>{b.completed}</td>
                    <td className={cn(td, "tabular text-right")}>{b.noShows}</td>
                    <td className={cn(td, "tabular text-right")}>{formatPrice(b.completedRevenue, locale)}</td>
                    <td className={cn(td, "tabular text-right")}>{percent(b.utilization)}</td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
            <div className="mt-8 max-w-2xl">
              <h3 className="mb-4 text-sm font-semibold">{t.overview.utilizationByBarber}</h3>
              <UtilizationList dict={dict} locale={locale} barbers={metrics.barbers} label={t.overview.utilizationByBarber} />
            </div>
          </Section>

          <Section id={`returning-${locale}`} title={a.returning}>
            {metrics.returning.status === "ok" ? (
              <div className="max-w-sm">
                <StatTile
                  label={a.returning}
                  value={percent(metrics.returning.rate)}
                  hint={`${format(a.returningRate, { rate: percent(metrics.returning.rate) })} · ${format(a.returningDetail, {
                    returning: metrics.returning.returning,
                    customers: metrics.returning.customers,
                  })}`}
                />
              </div>
            ) : (
              <Notice>{format(a.returningInsufficient, { customers: metrics.returning.customers, needed: metrics.returning.needed })}</Notice>
            )}
          </Section>
        </>
      )}

      <Section id={`definitions-${locale}`} title={a.definitions}>
        <ul className="max-w-3xl list-disc space-y-2 pl-5 text-sm leading-relaxed text-taupe-deep">
          {a.definitionList.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </Section>
    </>
  );
}
