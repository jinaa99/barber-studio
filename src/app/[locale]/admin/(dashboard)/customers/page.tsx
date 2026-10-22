import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { routes } from "@/lib/navigation";
import { format } from "@/lib/format";
import { cn } from "@/lib/cn";
import { maskPhone, tableDate, zoned } from "@/lib/admin/format";
import { db } from "@/lib/server/db";
import { adminContext } from "@/lib/server/admin-context";
import { customerFilters, listCustomers, type CustomerFilter } from "@/lib/server/customers";
import { hrefWith, queryOf } from "@/components/admin/filters";
import {
  compactInputClass,
  EmptyState,
  Forbidden,
  Notice,
  PageHeader,
  PageSkeleton,
  Pagination,
  segment,
  segmentGroup,
  smallButton,
  TableFrame,
  Tag,
  td,
  th,
} from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.admin.nav.customers} · ${dict.meta.admin}`, robots: { index: false, follow: false } };
}

type Props = PageProps<"/[locale]/admin/customers">;

export default async function CustomersPage({ searchParams }: Props) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={<PageSkeleton label={dict.admin.common.loading} />}>
      <Customers locale={locale} dict={dict} searchParams={searchParams} />
    </Suspense>
  );
}

async function Customers({ locale, dict, searchParams }: { locale: Locale; dict: Dictionary; searchParams: Props["searchParams"] }) {
  const ctx = await adminContext(locale);
  if (!ctx.can("customers.view")) return <Forbidden dict={dict} />;
  const t = dict.admin;
  const query = queryOf(await searchParams);
  const base = localizedPath(locale, routes.adminCustomers);
  const filter: CustomerFilter = customerFilters.includes(query.filter as CustomerFilter) ? (query.filter as CustomerFilter) : "all";
  const includeDemo = query.demo === "1";
  const page = Math.max(1, Number(query.page) || 1);
  const result = await listCustomers(db, { q: query.q, filter, includeDemo, page }, ctx.now);
  const keep = { q: query.q, filter: filter === "all" ? undefined : filter, demo: query.demo };

  return (
    <>
      <PageHeader title={t.customers.title} lead={t.customers.lead} />

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <form method="get" action={base} role="search" className="flex flex-wrap items-end gap-2">
          {keep.filter && <input type="hidden" name="filter" value={keep.filter} />}
          {keep.demo && <input type="hidden" name="demo" value={keep.demo} />}
          <label className="text-xs text-muted">
            <span className="mb-1 block">{t.customers.searchLabel}</span>
            <input type="search" name="q" defaultValue={query.q} placeholder={t.customers.searchPlaceholder} maxLength={80} className={cn(compactInputClass, "w-64")} />
          </label>
          <button type="submit" className={smallButton}>
            {t.common.search}
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-4">
          <nav aria-label={t.customers.filterLabel} className={segmentGroup}>
            {customerFilters.map((f) => (
              <Link
                key={f}
                href={hrefWith(base, keep, { filter: f === "all" ? undefined : f })}
                aria-current={filter === f ? "true" : undefined}
                className={segment(filter === f)}
              >
                {t.customers.filters[f]}
              </Link>
            ))}
          </nav>
          <Link href={hrefWith(base, keep, { demo: includeDemo ? undefined : "1" })} className="text-sm text-muted underline underline-offset-4 hover:text-ink">
            {includeDemo ? t.common.hideDemo : t.common.includeDemo}
          </Link>
        </div>
      </div>
      {includeDemo && <Notice tone="demo" className="mt-4">{t.common.demoBanner}</Notice>}

      <div className="mt-6">
        {result.total === 0 ? (
          <EmptyState>{query.q || filter !== "all" ? t.customers.empty : t.customers.emptyAll}</EmptyState>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">{format(t.common.results, { count: result.total })}</p>
            <TableFrame label={t.customers.title}>
              <thead>
                <tr>
                  <th scope="col" className={th}>{t.common.customer}</th>
                  <th scope="col" className={th}>
                    {t.common.phone}
                    <span className="sr-only"> ({t.customers.phoneMasked})</span>
                  </th>
                  <th scope="col" className={cn(th, "text-right")}>{t.customers.visits}</th>
                  <th scope="col" className={th}>{t.customers.lastVisit}</th>
                  <th scope="col" className={th}>{t.customers.nextVisit}</th>
                  <th scope="col" className={cn(th, "text-right")}>{t.customers.noShows}</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((c) => (
                  <tr key={c.id} className="hover:bg-stone/40">
                    <td className={td}>
                      <Link href={`${base}/${c.id}`} className="font-medium underline-offset-4 hover:underline">
                        {c.name}
                      </Link>
                      {c.isDemo && <Tag className="ml-2">{t.common.sample}</Tag>}
                    </td>
                    <td className={cn(td, "tabular text-muted")}>{maskPhone(c.phone)}</td>
                    <td className={cn(td, "tabular text-right")}>{c.completed}</td>
                    <td className={cn(td, "tabular whitespace-nowrap")}>{c.lastVisit ? tableDate(zoned(c.lastVisit, ctx.timeZone).date, locale, dict) : "—"}</td>
                    <td className={cn(td, "tabular whitespace-nowrap")}>{c.nextVisit ? tableDate(zoned(c.nextVisit, ctx.timeZone).date, locale, dict) : "—"}</td>
                    <td className={cn(td, "tabular text-right", c.noShows > 0 && "text-danger")}>{c.noShows}</td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
            <Pagination dict={dict} page={result.page} pageSize={result.pageSize} total={result.total} href={(p) => hrefWith(base, keep, { page: p === 1 ? undefined : String(p) })} />
          </>
        )}
      </div>
    </>
  );
}
