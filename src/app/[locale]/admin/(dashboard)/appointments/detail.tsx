import Link from "next/link";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { localizedPath, type Locale, type LocalizedText } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { routes } from "@/lib/navigation";
import { format, formatPrice } from "@/lib/format";
import { dateTime, displayPhone, longDate, zoned } from "@/lib/admin/format";
import { allowedTransitions, isActiveStatus } from "@/lib/booking/status";
import { db } from "@/lib/server/db";
import type { AdminContext } from "@/lib/server/admin-context";
import { getAppointmentDetail } from "@/lib/server/appointments";
import { RouteDialog } from "@/components/admin/dialog";
import { StatusActions } from "@/components/admin/appointment-actions";
import { EmptyState, Notice, smallButton, StatusBadge, Tag, textLink } from "@/components/admin/ui";

/** The appointment dialog (`?open=<id>`). Scoped: a barber can only open their own. */
export async function AppointmentDetail({
  ctx,
  dict,
  locale,
  id,
  closeHref,
}: {
  ctx: AdminContext;
  dict: Dictionary;
  locale: Locale;
  id: string;
  closeHref: string;
}) {
  const t = dict.admin;
  const a = await getAppointmentDetail(db, id.slice(0, 64), ctx.scope, ctx.can("customers.view"));
  if (!a) {
    return (
      <RouteDialog title={t.common.notFoundTitle} closeHref={closeHref} closeLabel={t.common.close}>
        <EmptyState>{t.common.notFoundBody}</EmptyState>
      </RouteDialog>
    );
  }

  const name = (value: unknown) => (value as LocalizedText)[locale];
  const start = zoned(a.startsAt, ctx.timeZone);
  const end = zoned(a.endsAt, ctx.timeZone);
  const next = ctx.can("appointments.updateStatus") ? allowedTransitions(a.status, a.startsAt, ctx.now) : [];
  const canReschedule = ctx.can("appointments.manage") && isActiveStatus(a.status) && a.startsAt > ctx.now;
  const actorName = (entry: { actor: { name: string } | null }) => entry.actor?.name ?? t.appointments.system;

  const rows: [string, React.ReactNode][] = [
    [t.appointments.when, `${longDate(start.date, dict)}, ${start.time}–${end.time} (${a.durationMinutes} ${t.common.minutes})`],
    [t.common.service, name(a.service.name)],
    [t.common.barber, name(a.barber.name)],
    [t.common.price, <span key="p" className="tabular">{formatPrice(a.priceMnt, locale)}</span>],
    [t.common.customer, a.customerName],
  ];
  if (ctx.can("customers.view")) {
    if (a.customer.phone) rows.push([t.common.phone, <a key="ph" href={`tel:+${a.customer.phone}`} className={textLink}>{displayPhone(a.customer.phone)}</a>]);
    if (a.customerEmail) rows.push([t.common.email, <a key="em" href={`mailto:${a.customerEmail}`} className={`${textLink} break-all`}>{a.customerEmail}</a>]);
  }
  if (a.notes) rows.push([t.common.notes, <span key="n" className="whitespace-pre-line">{a.notes}</span>]);
  rows.push([t.appointments.source, t.source[a.source]]);
  rows.push([t.appointments.created, dateTime(a.createdAt, ctx.timeZone, locale, dict)]);
  if (a.cancelReason) rows.push([t.appointments.cancelReason, a.cancelReason]);

  return (
    <RouteDialog title={format(t.appointments.detailTitle, { reference: a.reference })} closeHref={closeHref} closeLabel={t.common.close}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={a.status} label={t.status[a.status]} />
        {a.isDemo && <Tag>{t.common.sample}</Tag>}
      </div>

      <dl className="mt-5 border-t border-line text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 border-b border-line py-2.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
            <dt className="text-taupe-deep">{label}</dt>
            <dd className="min-w-0">{value}</dd>
          </div>
        ))}
      </dl>
      {!ctx.can("customers.view") && <p className="mt-3 text-xs text-taupe-deep">{t.appointments.contactHidden}</p>}

      {(next.length > 0 || canReschedule) && (
        <div className="mt-6 flex flex-wrap items-start gap-2">
          {next.length > 0 && (
            <StatusActions
              locale={locale}
              appointmentId={a.id}
              next={next}
              labels={{
                actions: t.actions,
                cancelTitle: t.appointments.cancelTitle,
                cancelBody: t.appointments.cancelBody,
                cancelReasonLabel: t.appointments.cancelReasonLabel,
                confirmCancel: t.appointments.confirmCancel,
                keep: t.appointments.keep,
                close: t.common.close,
                saving: t.common.saving,
              }}
            />
          )}
          {canReschedule && (
            <Link href={`${localizedPath(locale, routes.adminNewAppointment)}?reschedule=${a.id}&date=${start.date}&barber=${a.barberId}`} className={smallButton}>
              {t.appointments.reschedule}
            </Link>
          )}
        </div>
      )}
      {isActiveStatus(a.status) && a.startsAt > ctx.now && <p className="mt-3 text-xs text-taupe-deep">{t.appointments.afterStartNote}</p>}
      {!isActiveStatus(a.status) && <Notice className="mt-6">{t.appointments.finalNote}</Notice>}

      {ctx.can("customers.view") && (
        <p className="mt-6 text-sm">
          <Link href={localizedPath(locale, `${routes.adminCustomers}/${a.customerId}`)} className={textLink}>
            {t.appointments.customerRecord}
          </Link>
        </p>
      )}

      {a.notifications.length > 0 && (
        <section className="mt-8">
          <h3 className="text-sm font-semibold">{t.appointments.notifications}</h3>
          <ul className="mt-2 space-y-1 text-sm text-taupe-deep">
            {a.notifications.map((n, i) => (
              <li key={i}>
                {t.notification[n.status]} · {dateTime(n.createdAt, ctx.timeZone, locale, dict)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h3 className="text-sm font-semibold">{t.appointments.history}</h3>
        {a.history.length === 0 ? (
          <p className="mt-2 text-sm text-taupe-deep">{t.appointments.historyEmpty}</p>
        ) : (
          <ol className="mt-2 space-y-2 text-sm">
            {a.history.map((h) => {
              const meta = (h.metadata ?? {}) as { from?: unknown; to?: unknown };
              let what: string = t.activity.labels[h.action as keyof typeof t.activity.labels] ?? h.action;
              if (h.action === "appointment.status_changed" && typeof meta.from === "string" && typeof meta.to === "string") {
                what = format(t.appointments.statusChanged, {
                  from: t.status[meta.from as AppointmentStatus] ?? meta.from,
                  to: t.status[meta.to as AppointmentStatus] ?? meta.to,
                });
              }
              if (h.action === "appointment.rescheduled" && meta.from && typeof meta.from === "object" && "startsAt" in meta.from) {
                what = format(t.appointments.movedFrom, { from: dateTime(new Date(String(meta.from.startsAt)), ctx.timeZone, locale, dict) });
              }
              return (
                <li key={h.id} className="flex flex-wrap justify-between gap-x-4">
                  <span>
                    {what} <span className="text-taupe-deep">· {format(t.appointments.by, { name: actorName(h) })}</span>
                  </span>
                  <span className="tabular text-xs text-taupe-deep">{dateTime(h.createdAt, ctx.timeZone, locale, dict)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </RouteDialog>
  );
}
