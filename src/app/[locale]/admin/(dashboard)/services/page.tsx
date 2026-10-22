import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath, type Locale, type LocalizedText } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { routes } from "@/lib/navigation";
import { format, formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { db } from "@/lib/server/db";
import { adminContext } from "@/lib/server/admin-context";
import { listCategories, listServicesForAdmin } from "@/lib/server/catalog";
import { deleteCategoryAction, saveCategoryAction, setServiceActiveAction } from "@/app/[locale]/admin/actions/catalog";
import { ActionForm, LocalizedFields, SubmitButton, TextField } from "@/components/admin/form";
import { EmptyState, Forbidden, PageHeader, PageSkeleton, primarySmallButton, Section, Tag, textLink } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.admin.nav.services} · ${dict.meta.admin}`, robots: { index: false, follow: false } };
}

export default async function ServicesAdminPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={<PageSkeleton label={dict.admin.common.loading} />}>
      <Services locale={locale} dict={dict} />
    </Suspense>
  );
}

async function Services({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const ctx = await adminContext(locale);
  if (!ctx.can("catalog.manage")) return <Forbidden dict={dict} />;
  const t = dict.admin.services;
  const c = dict.admin.common;
  const [services, categories] = await Promise.all([listServicesForAdmin(db), listCategories(db)]);
  const name = (value: unknown) => (value as LocalizedText)[locale];
  const base = localizedPath(locale, routes.adminServices);

  return (
    <>
      <PageHeader
        title={t.title}
        lead={t.lead}
        actions={
          <Link href={`${base}/new`} className={primarySmallButton}>
            <Plus aria-hidden className="size-4" strokeWidth={1.75} />
            {t.addService}
          </Link>
        }
      />

      {services.length === 0 && (
        <div className="mt-8">
          <EmptyState>{t.empty}</EmptyState>
        </div>
      )}
      {categories.map((category) => {
        const items = services.filter((s) => s.categoryId === category.id);
        if (items.length === 0) return null;
        return (
          <Section key={category.id} id={`cat-${category.id}-${locale}`} title={name(category.name)}>
            <ul className="border-t border-line">
              {items.map((s) => (
                <li key={s.id} className={cn("flex flex-wrap items-center justify-between gap-4 border-b border-line py-3", !s.active && "text-muted")}>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <Link href={`${base}/${s.id}`} className="underline-offset-4 hover:underline">
                        {name(s.name)}
                      </Link>
                      {s.featured && <Tag>{t.featured}</Tag>}
                      {!s.active && <Tag>{c.inactive}</Tag>}
                    </p>
                    <p className="tabular mt-0.5 text-sm text-muted">
                      {s.durationMinutes} {c.minutes} · {formatPrice(s.priceMnt, locale)} ·{" "}
                      {s._count.barbers ? format(t.barbersCount, { count: s._count.barbers }) : <span className="text-danger">{t.noBarbers}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link href={`${base}/${s.id}`} className={cn(textLink, "text-sm")}>
                      {c.edit}
                    </Link>
                    <ActionForm action={setServiceActiveAction} showSuccess={false}>
                      <input type="hidden" name="serviceId" value={s.id} />
                      <input type="hidden" name="active" value={String(!s.active)} />
                      <SubmitButton variant="secondary">{s.active ? t.deactivate : t.activate}</SubmitButton>
                    </ActionForm>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        );
      })}

      <Section id={`categories-${locale}`} title={t.categories} lead={t.categoriesLead}>
        <ul className="border-t border-line">
          {categories.map((category) => (
            <li key={category.id} className="border-b border-line py-4">
              <ActionForm action={saveCategoryAction.bind(null, "update")} className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_6rem_auto] lg:items-end">
                <input type="hidden" name="id" value={category.id} />
                <LocalizedFields label={`${name(category.name)} · ${format(t.categoryServices, { count: category._count.services })}`} name="name" defaultValue={category.name as LocalizedText} maxLength={60} required />
                <TextField label={c.sortOrder} name="sortOrder" type="number" min={0} max={999} defaultValue={category.sortOrder} />
                <SubmitButton variant="secondary">{c.save}</SubmitButton>
              </ActionForm>
              {category._count.services === 0 && (
                <ActionForm action={deleteCategoryAction} className="mt-2">
                  <input type="hidden" name="id" value={category.id} />
                  <SubmitButton variant="danger">{t.deleteCategory}</SubmitButton>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
        <ActionForm action={saveCategoryAction.bind(null, "create")} className="mt-6 border border-line p-4 sm:p-5">
          <h3 className="text-sm font-semibold">{t.addCategory}</h3>
          <div className="mt-4 grid gap-4 lg:grid-cols-[12rem_minmax(0,3fr)_6rem] lg:items-end">
            <TextField label={c.slug} name="id" hint={c.slugHint} maxLength={48} required />
            <LocalizedFields label={t.categoryName} name="name" maxLength={60} required />
            <TextField label={c.sortOrder} name="sortOrder" type="number" min={0} max={999} defaultValue={categories.length} />
          </div>
          <div className="mt-4">
            <SubmitButton>{c.create}</SubmitButton>
          </div>
        </ActionForm>
      </Section>
    </>
  );
}
