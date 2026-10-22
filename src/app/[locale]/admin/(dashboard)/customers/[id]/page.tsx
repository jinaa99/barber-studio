import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath, type Locale, type LocalizedText } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { routes } from "@/lib/navigation";
import { format, formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { dateTime, displayPhone, tableDate, zoned } from "@/lib/admin/format";
import { db } from "@/lib/server/db";
import { adminContext } from "@/lib/server/admin-context";
import { getCustomerDetail } from "@/lib/server/customers";
import { Forbidden, Notice, NotFoundState, PageHeader, PageSkeleton, Pagination, Section, StatGroup, StatTile, StatusBadge, TableFrame, Tag, td, textLink, th } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.admin.nav.customers} · ${dict.meta.admin}`, robots: { index: false, follow: false } };
}

type Props = PageProps<"/[locale]/admin/customers/[id]">;

export default async function CustomerPage({ params, searchParams }: Props) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={<PageSkeleton label={dict.admin.common.loading} />}>
      <Customer locale={locale} dict={dict} params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Customer({ locale, dict, params, searchParams }: { locale: Locale; dict: Dictionary } & Pick<Props, "params" | "searchParams">) {
  const ctx = await adminContext(locale);
  if (!ctx.can("customers.view")) return <Forbidden dict={dict} />;
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const t = dict.admin;
  const back = localizedPath(locale, routes.adminCustomers);
  const page = Math.max(1, Number(typeof query.page === "string" ? query.page : 1) || 1);
  const detail = await getCustomerDetail(db, decodeURIComponent(id).slice(0, 64), { page });
  if (!detail) return <NotFoundState dict={dict} backHref={back} />;
  const { customer } = detail;
  const name = (value: unknown) => (value as LocalizedText)[locale];
  const calendar = localizedPath(locale, routes.adminAppointments);
  const self = localizedPath(locale, `${routes.adminCustomers}/${customer.id}`);

  return (
    <>
      <Link href={back} className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" strokeWidth={1.75} />
        {t.customers.title}
      </Link>
      <PageHeader
        title={customer.name}
        lead={format(t.customers.since, { date: tableDate(zoned(customer.createdAt, ctx.timeZone).date, locale, dict) })}
        eyebrow={customer.isDemo && <Tag>{t.common.sample}</Tag>}
      />
      <Notice className="mt-6">{t.customers.privacy}</Notice>

      <dl className="mt-6 grid gap-x-8 gap-y-2 rounded-2xl border border-line bg-surface px-5 py-4 text-sm sm:grid-cols-[8rem_1fr] sm:px-6">
        <dt className="text-muted">{t.common.phone}</dt>
        <dd>
          <a href={`tel:+${customer.phone}`} className={cn(textLink, "tabular")}>
            {displayPhone(customer.phone)}
          </a>
        </dd>
        <dt className="text-muted">{t.common.email}</dt>
        <dd className="break-all">{customer.email ? <a href={`mailto:${customer.email}`} className={textLink}>{customer.email}</a> : "—"}</dd>
      </dl>

      <StatGroup className={cn("mt-6 grid-cols-2", ctx.can("finance.view") ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
        <StatTile label={t.customers.completed} value={detail.byStatus.COMPLETED ?? 0} />
        <StatTile label={t.customers.cancelled} value={detail.byStatus.CANCELLED ?? 0} />
        <StatTile label={t.customers.noShows} value={detail.byStatus.NO_SHOW ?? 0} />
        {ctx.can("finance.view") && <StatTile label={t.customers.completedSpend} value={formatPrice(detail.completedSpend, locale)} />}
      </StatGroup>

      <Section id={`history-${locale}`} title={t.customers.history} flush={detail.total > 0}>
        {detail.total === 0 ? (
          <p className="text-sm text-muted">{t.customers.historyEmpty}</p>
        ) : (
          <>
            <TableFrame label={t.customers.history} flush>
              <thead>
                <tr>
                  <th scope="col" className={th}>{t.common.date}</th>
                  <th scope="col" className={th}>{t.common.service}</th>
                  <th scope="col" className={th}>{t.common.barber}</th>
                  <th scope="col" className={th}>{t.common.status}</th>
                  <th scope="col" className={cn(th, "text-right")}>{t.common.price}</th>
                </tr>
              </thead>
              <tbody>
                {detail.appointments.map((a) => (
                  <tr key={a.id}>
                    <td className={cn(td, "tabular whitespace-nowrap")}>
                      <Link href={`${calendar}?date=${zoned(a.startsAt, ctx.timeZone).date}&open=${a.id}`} className="underline-offset-4 hover:underline">
                        {dateTime(a.startsAt, ctx.timeZone, locale, dict)}
                      </Link>
                      {a.isDemo && <Tag className="ml-2">{t.common.sample}</Tag>}
                    </td>
                    <td className={td}>
                      {name(a.service.name)}
                      {a.notes && <p className="mt-1 whitespace-pre-line text-xs text-muted">{a.notes}</p>}
                    </td>
                    <td className={td}>{name(a.barber.name)}</td>
                    <td className={td}>
                      <StatusBadge status={a.status} label={t.status[a.status]} />
                    </td>
                    <td className={cn(td, "tabular text-right")}>{formatPrice(a.priceMnt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
            <div className="px-5 pb-4 sm:px-6">
              <Pagination dict={dict} page={detail.page} pageSize={detail.pageSize} total={detail.total} href={(p) => (p === 1 ? self : `${self}?page=${p}`)} />
            </div>
          </>
        )}
      </Section>
    </>
  );
}
