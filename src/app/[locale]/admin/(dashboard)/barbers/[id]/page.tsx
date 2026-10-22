import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath, type Locale, type LocalizedText } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { routes } from "@/lib/navigation";
import { format } from "@/lib/format";
import { db } from "@/lib/server/db";
import { adminContext } from "@/lib/server/admin-context";
import { getBarberForEdit } from "@/lib/server/catalog";
import { saveHoursAction } from "@/app/[locale]/admin/actions/catalog";
import { BarberForm } from "@/components/admin/barber-form";
import { mediaChoices } from "@/components/admin/media-picker";
import { ActionForm, SubmitButton } from "@/components/admin/form";
import { ScheduleEditor } from "@/components/admin/schedule-editor";
import { TimeOffManager } from "@/components/admin/time-off";
import { Forbidden, Notice, NotFoundState, PageHeader, PageSkeleton, Section } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.admin.nav.barbers} · ${dict.meta.admin}`, robots: { index: false, follow: false } };
}

type Props = PageProps<"/[locale]/admin/barbers/[id]">;

export default async function EditBarberPage({ params, searchParams }: Props) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={<PageSkeleton label={dict.admin.common.loading} />}>
      <EditBarber locale={locale} dict={dict} params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const weekdayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

async function EditBarber({ locale, dict, params, searchParams }: { locale: Locale; dict: Dictionary } & Pick<Props, "params" | "searchParams">) {
  const ctx = await adminContext(locale);
  if (!ctx.can("catalog.manage")) return <Forbidden dict={dict} />;
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const t = dict.admin.barbers;
  const back = localizedPath(locale, routes.adminBarbers);
  const [barber, services, images] = await Promise.all([
    getBarberForEdit(db, decodeURIComponent(id).slice(0, 64), ctx.now),
    db.service.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true, active: true } }),
    mediaChoices(locale, "IMAGE"),
  ]);
  if (!barber) return <NotFoundState dict={dict} backHref={back} />;
  const displayName = (barber.name as LocalizedText)[locale];

  return (
    <>
      <Link href={back} className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" strokeWidth={1.75} />
        {t.title}
      </Link>
      <PageHeader
        title={format(t.editTitle, { name: displayName })}
        actions={
          barber.active && (
            <Link href={`${localizedPath(locale, routes.barbers)}#${barber.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
              {t.viewOnSite}
              <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.75} />
            </Link>
          )
        }
      />
      {query.created && <Notice tone="success" className="mt-6">{dict.admin.messages.created}</Notice>}
      {!barber.active && barber.upcoming > 0 && (
        <Notice tone="error" className="mt-6">
          {format(t.deactivateWarning, { count: barber.upcoming })}
        </Notice>
      )}

      <Section id={`profile-${locale}`} title={t.profile}>
        <div className="max-w-3xl">
          <BarberForm
            locale={locale}
            dict={dict}
            mode="update"
            services={services}
            images={images}
            values={{
              id: barber.id,
              name: barber.name as LocalizedText,
              role: barber.role as LocalizedText,
              bio: barber.bio as LocalizedText,
              specialties: barber.specialties as LocalizedText[],
              yearsExperience: barber.yearsExperience,
              imageId: barber.imageId,
              active: barber.active,
              sortOrder: barber.sortOrder,
              serviceIds: barber.services.map((s) => s.serviceId),
            }}
          />
        </div>
      </Section>

      <Section id={`hours-${locale}`} title={t.hours} lead={t.hoursLead}>
        <ActionForm action={saveHoursAction} className="max-w-3xl">
          <input type="hidden" name="barberId" value={barber.id} />
          <ScheduleEditor
            initial={barber.workingHours}
            labels={{
              weekdays: weekdayKeys.map((k) => dict.weekdays[k]),
              addBlock: t.addBlock,
              removeBlock: t.removeBlock,
              start: t.start,
              end: t.end,
              dayOff: t.dayOff,
              blockError: t.blockError,
            }}
          />
          <div className="mt-5">
            <SubmitButton>{t.saveHours}</SubmitButton>
          </div>
        </ActionForm>
      </Section>

      <Section id={`time-off-${locale}`} title={t.timeOff} lead={t.timeOffLead}>
        <TimeOffManager
          locale={locale}
          dict={dict}
          barberId={barber.id}
          entries={barber.timeOff}
          timeZone={ctx.timeZone}
          today={ctx.today}
          emptyLabel={t.timeOffEmpty}
          addLabel={t.addTimeOff}
        />
      </Section>
    </>
  );
}
