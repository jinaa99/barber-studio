import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { routes } from "@/lib/navigation";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/admin/format";
import { db } from "@/lib/server/db";
import { adminContext } from "@/lib/server/admin-context";
import { auditGroups, listAuditLog, type AuditGroup } from "@/lib/server/audit";
import { hrefWith, queryOf } from "@/components/admin/filters";
import {
  EmptyState,
  Forbidden,
  PageHeader,
  PageSkeleton,
  Pagination,
  segment,
  segmentGroup,
  TableFrame,
  td,
  th,
} from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.admin.nav.activity} · ${dict.meta.admin}`, robots: { index: false, follow: false } };
}

type Props = PageProps<"/[locale]/admin/activity">;

export default async function ActivityPage({ searchParams }: Props) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={<PageSkeleton label={dict.admin.common.loading} />}>
      <Activity locale={locale} dict={dict} searchParams={searchParams} />
    </Suspense>
  );
}

/** A short, safe summary of an entry's metadata (never password material, which is never logged). */
function details(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  return Object.entries(metadata as Record<string, unknown>)
    .slice(0, 4)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ")
    .slice(0, 240);
}

async function Activity({ locale, dict, searchParams }: { locale: Locale; dict: Dictionary; searchParams: Props["searchParams"] }) {
  const ctx = await adminContext(locale);
  if (!ctx.can("audit.view")) return <Forbidden dict={dict} />;
  const t = dict.admin.activity;
  const query = queryOf(await searchParams);
  const base = localizedPath(locale, routes.adminActivity);
  const group = query.group && Object.hasOwn(auditGroups, query.group) ? (query.group as AuditGroup) : undefined;
  const result = await listAuditLog(db, { group, page: Math.max(1, Number(query.page) || 1) });

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />
      <nav aria-label={t.filterLabel} className={cn(segmentGroup, "mt-6")}>
        {[undefined, ...(Object.keys(auditGroups) as AuditGroup[])].map((g) => (
          <Link
            key={g ?? "all"}
            href={hrefWith(base, {}, { group: g })}
            aria-current={group === g ? "true" : undefined}
            className={segment(group === g)}
          >
            {g ? t.groups[g] : t.all}
          </Link>
        ))}
      </nav>
      <div className="mt-6">
        {result.total === 0 ? (
          <EmptyState>{t.empty}</EmptyState>
        ) : (
          <>
            <TableFrame label={t.title}>
              <thead>
                <tr>
                  <th scope="col" className={th}>{t.when}</th>
                  <th scope="col" className={th}>{t.who}</th>
                  <th scope="col" className={th}>{t.what}</th>
                  <th scope="col" className={th}>{t.details}</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.id}>
                    <td className={cn(td, "tabular whitespace-nowrap text-muted")}>{dateTime(r.createdAt, ctx.timeZone, locale, dict)}</td>
                    <td className={td}>{r.actor?.name ?? t.anonymous}</td>
                    <td className={td}>
                      {t.labels[r.action as keyof typeof t.labels] ?? r.action}
                      {r.entityId && <span className="block text-xs text-muted">{r.entityType} · {r.entityId}</span>}
                    </td>
                    <td className={cn(td, "max-w-md break-words text-xs text-muted")}>{details(r.metadata)}</td>
                  </tr>
                ))}
              </tbody>
            </TableFrame>
            <Pagination dict={dict} page={result.page} pageSize={result.pageSize} total={result.total} href={(p) => hrefWith(base, { group }, { page: p === 1 ? undefined : String(p) })} />
          </>
        )}
      </div>
    </>
  );
}
