import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath, type Locale, type LocalizedText } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { routes } from "@/lib/navigation";
import { format } from "@/lib/format";
import { db } from "@/lib/server/db";
import { adminContext } from "@/lib/server/admin-context";
import { getServiceForEdit, listCategories } from "@/lib/server/catalog";
import { ServiceForm } from "@/components/admin/service-form";
import { Forbidden, Notice, NotFoundState, PageHeader, PageSkeleton } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.admin.nav.services} · ${dict.meta.admin}`, robots: { index: false, follow: false } };
}

type Props = PageProps<"/[locale]/admin/services/[id]">;

export default async function EditServicePage({ params, searchParams }: Props) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={<PageSkeleton label={dict.admin.common.loading} />}>
      <EditService locale={locale} dict={dict} params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EditService({ locale, dict, params, searchParams }: { locale: Locale; dict: Dictionary } & Pick<Props, "params" | "searchParams">) {
  const ctx = await adminContext(locale);
  if (!ctx.can("catalog.manage")) return <Forbidden dict={dict} />;
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const back = localizedPath(locale, routes.adminServices);
  const [service, categories, barbers] = await Promise.all([
    getServiceForEdit(db, decodeURIComponent(id).slice(0, 64)),
    listCategories(db),
    db.barber.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true, active: true } }),
  ]);
  if (!service) return <NotFoundState dict={dict} backHref={back} />;
  return (
    <>
      <Link href={back} className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" strokeWidth={1.75} />
        {dict.admin.services.title}
      </Link>
      <PageHeader title={format(dict.admin.services.editTitle, { name: (service.name as LocalizedText)[locale] })} />
      {query.created && <Notice tone="success" className="mt-6">{dict.admin.messages.created}</Notice>}
      <div className="mt-8 max-w-3xl">
        <ServiceForm
          locale={locale}
          dict={dict}
          mode="update"
          categories={categories}
          barbers={barbers}
          values={{
            id: service.id,
            categoryId: service.categoryId,
            name: service.name as LocalizedText,
            summary: service.summary as LocalizedText,
            includes: service.includes as LocalizedText[],
            durationMinutes: service.durationMinutes,
            priceMnt: service.priceMnt,
            featured: service.featured,
            active: service.active,
            sortOrder: service.sortOrder,
            barberIds: service.barbers.map((b) => b.barberId),
          }}
        />
      </div>
    </>
  );
}
