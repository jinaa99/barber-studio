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
import { dateTime, longDate } from "@/lib/admin/format";
import { LIMITS } from "@/lib/booking/validation";
import { isActiveStatus } from "@/lib/booking/status";
import { isISODate } from "@/lib/booking/time";
import { db } from "@/lib/server/db";
import { adminContext } from "@/lib/server/admin-context";
import { scopeWhere, staffSlots } from "@/lib/server/appointments";
import { createAppointmentAction, rescheduleAction } from "@/app/[locale]/admin/actions/appointments";
import { queryOf } from "@/components/admin/filters";
import { ActionForm, CheckboxField, GroupError, SubmitButton, TextAreaField, TextField } from "@/components/admin/form";
import { EmptyState, Forbidden, inputClass, Notice, NotFoundState, PageHeader, PageSkeleton, smallButton } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.admin.booking.newTitle} · ${dict.meta.admin}`, robots: { index: false, follow: false } };
}

type Props = PageProps<"/[locale]/admin/appointments/new">;

export default async function NewAppointmentPage({ searchParams }: Props) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={<PageSkeleton label={dict.admin.common.loading} />}>
      <NewAppointment locale={locale} dict={dict} searchParams={searchParams} />
    </Suspense>
  );
}

async function NewAppointment({ locale, dict, searchParams }: { locale: Locale; dict: Dictionary; searchParams: Props["searchParams"] }) {
  const ctx = await adminContext(locale);
  const t = dict.admin;
  const calendar = localizedPath(locale, routes.adminAppointments);
  if (!ctx.can("appointments.manage")) return <Forbidden dict={dict} />;

  const query = queryOf(await searchParams);
  const name = (value: unknown) => (value as LocalizedText)[locale];

  // Reschedule mode: the service is fixed, the barber and time can change.
  const existing = query.reschedule
    ? await db.appointment.findFirst({
        where: { AND: [{ id: query.reschedule.slice(0, 64) }, scopeWhere(ctx.scope)] },
        select: { id: true, reference: true, status: true, startsAt: true, serviceId: true, barberId: true, customerEmail: true, barber: { select: { name: true } } },
      })
    : null;
  if (query.reschedule && (!existing || !isActiveStatus(existing.status))) return <NotFoundState dict={dict} backHref={calendar} />;

  const services = await db.service.findMany({
    where: existing ? { id: existing.serviceId } : { active: true },
    orderBy: [{ categoryRef: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: { id: true, name: true, durationMinutes: true, priceMnt: true },
  });
  const serviceId = existing?.serviceId ?? (services.some((s) => s.id === query.service) ? query.service : undefined);
  const barbers = serviceId
    ? await db.barber.findMany({
        where: { active: true, services: { some: { serviceId } } },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true, name: true },
      })
    : [];
  const barberId = barbers.some((b) => b.id === query.barber) ? query.barber : barbers.length === 1 ? barbers[0].id : undefined;
  const date = query.date && isISODate(query.date) && query.date >= ctx.today ? query.date : ctx.today;
  const ready = Boolean(serviceId && barberId);
  const slots = ready ? await staffSlots(db, { serviceId: serviceId!, barberId: barberId!, date, excludeAppointmentId: existing?.id }, ctx.now) : [];
  const free = slots.filter((s) => s.available);
  const service = services.find((s) => s.id === serviceId);

  return (
    <>
      <Link href={calendar} className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" strokeWidth={1.75} />
        {t.appointments.title}
      </Link>
      <PageHeader
        title={existing ? format(t.booking.rescheduleTitle, { reference: existing.reference }) : t.booking.newTitle}
        lead={
          existing
            ? format(t.booking.currently, { when: dateTime(existing.startsAt, ctx.timeZone, locale, dict), barber: name(existing.barber.name) })
            : t.booking.staffRules
        }
      />

      <section aria-labelledby={`step1-${locale}`} className="mt-8">
        <h2 id={`step1-${locale}`} className="text-lg font-semibold tracking-tight">
          {t.booking.step1}
        </h2>
        <form method="get" className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_auto_auto] lg:items-end">
          {existing && <input type="hidden" name="reschedule" value={existing.id} />}
          <label className="block text-sm font-medium">
            <span className="mb-1.5 block">{t.common.service}</span>
            <select name="service" defaultValue={serviceId ?? ""} disabled={Boolean(existing)} className={inputClass} required>
              {!existing && <option value="">{t.booking.chooseService}</option>}
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {name(s.name)} · {s.durationMinutes} {t.common.minutes} · {formatPrice(s.priceMnt, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            <span className="mb-1.5 block">{t.common.barber}</span>
            <select name="barber" defaultValue={barberId ?? ""} className={inputClass} disabled={!serviceId}>
              <option value="">{t.booking.chooseBarber}</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {name(b.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            <span className="mb-1.5 block">{t.common.date}</span>
            <input type="date" name="date" defaultValue={date} min={ctx.today} className={inputClass} />
          </label>
          <button type="submit" className={cn(smallButton, "h-11")}>
            {t.booking.showTimes}
          </button>
        </form>
        {serviceId && barbers.length === 0 && <Notice tone="error" className="mt-4">{t.booking.noEligibleBarbers}</Notice>}
      </section>

      {!ready ? (
        <div className="mt-10">
          <EmptyState>{t.booking.chooseFirst}</EmptyState>
        </div>
      ) : (
        <ActionForm action={existing ? rescheduleAction : createAppointmentAction} className="mt-10" showSuccess={false}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="serviceId" value={serviceId} />
          <input type="hidden" name="barberId" value={barberId} />
          <input type="hidden" name="date" value={date} />
          {existing && <input type="hidden" name="appointmentId" value={existing.id} />}

          <fieldset>
            <legend className="text-lg font-semibold tracking-tight">
              {t.booking.freeTimes} · <span className="font-normal text-muted">{longDate(date, dict)}</span>
            </legend>
            {free.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t.booking.noTimes}</p>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                {free.map((s, i) => (
                  <label key={s.time} className="relative">
                    <input type="radio" name="time" value={s.time} defaultChecked={i === 0} className="peer sr-only" />
                    <span className="tabular flex h-10 cursor-pointer items-center justify-center border border-line-strong text-sm font-medium transition-colors peer-checked:border-ink peer-checked:bg-ink peer-checked:text-canvas peer-focus-visible:outline peer-focus-visible:outline-accent hover:border-ink">
                      {s.time}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <GroupError name="time" />
            <TextField
              label={t.booking.otherTime}
              name="otherTime"
              errorKey="time"
              type="time"
              step={300}
              hint={t.booking.otherTimeHint}
              optional
              className="mt-5 max-w-56"
            />
          </fieldset>

          {!existing && (
            <fieldset className="mt-10">
              <legend className="text-lg font-semibold tracking-tight">{t.booking.customer}</legend>
              <div className="mt-4 grid gap-5 sm:grid-cols-2">
                <TextField label={t.booking.customerName} name="customer.name" autoComplete="off" maxLength={LIMITS.name} required />
                <TextField label={t.booking.customerPhone} name="customer.phone" type="tel" inputMode="tel" autoComplete="off" maxLength={40} required />
                <TextField label={t.booking.customerEmail} name="customer.email" type="email" autoComplete="off" maxLength={LIMITS.email} optional />
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium">{t.booking.initialStatus}</legend>
                  <div className="flex gap-5 pt-2.5 text-sm">
                    {(["CONFIRMED", "PENDING"] as const).map((s) => (
                      <label key={s} className="flex items-center gap-2">
                        <input type="radio" name="status" value={s} defaultChecked={s === "CONFIRMED"} className="size-4 accent-ink" />
                        {t.status[s]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <TextAreaField label={t.booking.customerNotes} name="customer.notes" rows={3} maxLength={LIMITS.notes} optional className="sm:col-span-2" />
              </div>
              <CheckboxField label={t.booking.notify} name="notify" defaultChecked className="mt-5" />
            </fieldset>
          )}
          {existing?.customerEmail && <CheckboxField label={t.booking.notifyReschedule} name="notify" defaultChecked className="mt-6" />}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <SubmitButton pendingLabel={t.booking.submitting}>{existing ? t.booking.submitReschedule : t.booking.submitCreate}</SubmitButton>
            {service && (
              <span className="text-sm text-muted">
                {name(service.name)} · {service.durationMinutes} {t.common.minutes} · {formatPrice(service.priceMnt, locale)}
              </span>
            )}
          </div>
        </ActionForm>
      )}
    </>
  );
}
