import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { routes } from "@/lib/navigation";
import { db } from "@/lib/server/db";
import { adminContext } from "@/lib/server/admin-context";
import { BarberForm } from "@/components/admin/barber-form";
import { Forbidden, PageHeader, PageSkeleton } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.admin.barbers.newTitle} · ${dict.meta.admin}`, robots: { index: false, follow: false } };
}

export default async function NewBarberPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={<PageSkeleton label={dict.admin.common.loading} />}>
      <NewBarber locale={locale} dict={dict} />
    </Suspense>
  );
}

async function NewBarber({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const ctx = await adminContext(locale);
  if (!ctx.can("catalog.manage")) return <Forbidden dict={dict} />;
  const services = await db.service.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true, active: true } });
  return (
    <>
      <Link href={localizedPath(locale, routes.adminBarbers)} className="mb-4 inline-flex items-center gap-2 text-sm text-taupe-deep hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" strokeWidth={1.75} />
        {dict.admin.barbers.title}
      </Link>
      <PageHeader title={dict.admin.barbers.newTitle} />
      <div className="mt-8 max-w-3xl">
        <BarberForm locale={locale} dict={dict} mode="create" services={services} />
      </div>
    </>
  );
}
