"use client";

import Link from "next/link";
import { CircleCheck, Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import { localizedPath, type Locale } from "@/i18n/config";
import type { BookingConfirmation, BookingDraft } from "@/lib/booking/types";
import type { BookingStep } from "@/lib/booking/storage";
import { formatLongDate } from "@/lib/booking/dates";
import { format, formatDuration, formatPrice } from "@/lib/format";
import { Button, buttonStyles } from "@/components/ui/button";
import type { BookingBarber, BookingDict, BookingService } from "./types";

export interface ResolvedSelection {
  service: BookingService | undefined;
  barberLabel: string | undefined;
  dateLabel: string | undefined;
  time: string | null;
}

export function resolveSelection(
  draft: BookingDraft,
  dict: BookingDict,
  services: BookingService[],
  barbers: BookingBarber[],
  confirmation?: BookingConfirmation | null,
): ResolvedSelection {
  const service = services.find((s) => s.id === draft.serviceId);
  // Once booked, the server's answer (assigned barber, stored time) wins over the draft.
  const barberId = confirmation?.barberId ?? draft.barberId;
  const barber = barbers.find((b) => b.id === barberId);
  const date = confirmation?.date ?? draft.date;
  return {
    service,
    barberLabel: barber?.name ?? (draft.barberId ? dict.booking.barber.any : undefined),
    dateLabel: date
      ? formatLongDate(date, { weekdays: dict.weekdays, monthsLong: dict.calendar.monthsLong, dateLong: dict.calendar.dateLong })
      : undefined,
    time: confirmation?.time ?? draft.time,
  };
}

export function ReviewStep({
  locale,
  dict,
  draft,
  selection,
  onEdit,
}: {
  locale: Locale;
  dict: BookingDict;
  draft: BookingDraft;
  selection: ResolvedSelection;
  onEdit: (step: BookingStep) => void;
}) {
  const t = dict.booking.review;
  const rows: { label: string; value: string; step: BookingStep }[] = [
    { label: t.service, value: selection.service?.name ?? "—", step: "service" },
    { label: t.barber, value: selection.barberLabel ?? "—", step: "barber" },
    { label: t.date, value: selection.dateLabel ?? "—", step: "time" },
    { label: t.time, value: selection.time ?? "—", step: "time" },
    {
      label: t.customer,
      value: [draft.customer.name, draft.customer.phone, draft.customer.email].filter(Boolean).join(" · "),
      step: "details",
    },
  ];

  return (
    <div>
      <dl className="overflow-hidden rounded-xl border border-line-strong bg-surface">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[6.5rem_1fr_auto] items-baseline gap-4 border-b border-line px-4 py-4 last:border-b-0 sm:grid-cols-[9rem_1fr_auto] sm:px-5">
            <dt className="text-sm text-muted">{row.label}</dt>
            <dd className="min-w-0 break-words font-medium">{row.value}</dd>
            <dd>
              <button
                type="button"
                onClick={() => onEdit(row.step)}
                className="-my-1 rounded-full px-2.5 py-1 text-sm text-muted transition-colors hover:bg-stone hover:text-ink"
              >
                {t.edit}
                <span className="sr-only">: {row.label}</span>
              </button>
            </dd>
          </div>
        ))}
        {draft.customer.notes && (
          <div className="grid grid-cols-[6.5rem_1fr] gap-4 border-t border-line px-4 py-4 sm:grid-cols-[9rem_1fr] sm:px-5">
            <dt className="text-sm text-muted">{dict.booking.details.notes}</dt>
            <dd className="whitespace-pre-line text-[0.9375rem] text-muted">{draft.customer.notes}</dd>
          </div>
        )}
      </dl>
      {selection.service && (
        <div className="flex items-baseline justify-between gap-4 px-1 py-6">
          <span className="text-sm text-muted">
            {t.duration}: <span className="tabular">{formatDuration(selection.service.durationMinutes, dict.common.minutes)}</span>
          </span>
          <span className="numeric text-display-sm">{formatPrice(selection.service.price, locale)}</span>
        </div>
      )}
      <p className="px-1 text-sm text-muted">{t.payNote}</p>
    </div>
  );
}

export function Confirmation({
  locale,
  dict,
  confirmation,
  email,
  selection,
  studioPhone,
  onNewBooking,
}: {
  locale: Locale;
  dict: BookingDict;
  confirmation: BookingConfirmation;
  /** The address the customer entered, for the "email sent" line. */
  email: string;
  selection: ResolvedSelection;
  /** The studio's phone number, for changes. */
  studioPhone: string;
  onNewBooking: () => void;
}) {
  const t = dict.booking.confirmation;
  const r = dict.booking.review;
  const confirmed = confirmation.status === "CONFIRMED";
  const emailLine =
    confirmation.email === "sent"
      ? format(t.emailSent, { email })
      : confirmation.email === "not_sent"
        ? t.emailNotSent
        : t.emailNotRequested;
  return (
    <div className="mx-auto max-w-2xl animate-rise py-4 motion-reduce:animate-none sm:py-10">
      <div className="text-center">
        <span
          aria-hidden
          className={cn(
            "mx-auto flex size-14 items-center justify-center rounded-full",
            confirmed ? "bg-accent-wash text-accent-deep" : "bg-warning-wash text-warning",
          )}
        >
          {confirmed ? <CircleCheck className="size-7" strokeWidth={1.5} /> : <Clock className="size-7" strokeWidth={1.5} />}
        </span>
        <p className="eyebrow mt-7 text-muted">{confirmed ? t.eyebrowConfirmed : t.eyebrowPending}</p>
        <h2 className="mt-3 text-display-md text-balance">{confirmed ? t.titleConfirmed : t.titlePending}</h2>
        <p className="mx-auto mt-5 max-w-lg leading-relaxed text-muted">{confirmed ? t.leadConfirmed : t.leadPending}</p>
      </div>

      <div className="mt-10 overflow-hidden rounded-2xl border border-line-strong bg-surface text-left">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line bg-stone/50 px-5 py-5">
          <span className="text-sm text-muted">{t.reference}</span>
          <span className="numeric text-2xl font-medium tracking-[0.02em]">{confirmation.reference}</span>
        </div>
        <dl>
          {[
            [r.service, selection.service?.name],
            [r.barber, selection.barberLabel],
            [r.date, selection.dateLabel],
            [r.time, selection.time],
          ].map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-6 border-b border-line px-5 py-3.5 last:border-b-0">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="tabular text-right font-medium">{value ?? "—"}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mx-auto mt-8 max-w-lg space-y-2 text-center text-sm leading-relaxed text-muted">
        <p role="status">{emailLine}</p>
        <p>{format(t.change, { phone: studioPhone })}</p>
      </div>

      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        <Button onClick={onNewBooking}>{t.newBooking}</Button>
        <Link href={localizedPath(locale)} className={buttonStyles({ variant: "secondary" })}>
          {t.backHome}
        </Link>
      </div>
    </div>
  );
}

export function BookingSummary({
  locale,
  dict,
  selection,
}: {
  locale: Locale;
  dict: BookingDict;
  selection: ResolvedSelection;
}) {
  const t = dict.booking;
  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="eyebrow text-muted">{t.summary.title}</h2>
      {selection.service ? (
        <>
          <p className="mt-4 text-xl font-medium tracking-[-0.02em]">{selection.service.name}</p>
          <p className="tabular mt-1 text-sm text-muted">
            {formatDuration(selection.service.durationMinutes, dict.common.minutes)}
          </p>
          <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
            {[
              [t.review.barber, selection.barberLabel],
              [t.review.date, selection.dateLabel],
              [t.review.time, selection.time],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-muted">{label}</dt>
                <dd className="tabular text-right font-medium">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex items-baseline justify-between border-t border-line pt-5">
            <span className="text-sm text-muted">{t.summary.total}</span>
            <span className="numeric text-2xl font-medium">{formatPrice(selection.service.price, locale)}</span>
          </div>
        </>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted">{t.summary.empty}</p>
      )}
    </div>
  );
}
