"use client";

import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { localizedPath, type Locale } from "@/i18n/config";
import type { BookingDraft } from "@/lib/booking/types";
import type { BookingStep } from "@/lib/booking/storage";
import { formatLongDate } from "@/lib/booking/dates";
import { formatDuration, formatPrice } from "@/lib/format";
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
  assignedBarberId?: string,
): ResolvedSelection {
  const service = services.find((s) => s.id === draft.serviceId);
  const barberId = assignedBarberId ?? draft.barberId;
  const barber = barbers.find((b) => b.id === barberId);
  return {
    service,
    barberLabel: barber?.name ?? (draft.barberId ? dict.booking.barber.any : undefined),
    dateLabel: draft.date
      ? formatLongDate(draft.date, { weekdays: dict.weekdays, monthsLong: dict.calendar.monthsLong, dateLong: dict.calendar.dateLong })
      : undefined,
    time: draft.time,
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
      <dl className="border-t border-line-strong">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[7rem_1fr_auto] items-baseline gap-4 border-b border-line py-5 sm:grid-cols-[10rem_1fr_auto]">
            <dt className="text-sm text-taupe-deep">{row.label}</dt>
            <dd className="min-w-0 break-words font-medium">{row.value}</dd>
            <dd>
              <button
                type="button"
                onClick={() => onEdit(row.step)}
                className="text-sm text-taupe-deep underline underline-offset-4 hover:text-ink"
              >
                {t.edit}
                <span className="sr-only">: {row.label}</span>
              </button>
            </dd>
          </div>
        ))}
        {draft.customer.notes && (
          <div className="grid grid-cols-[7rem_1fr] gap-4 border-b border-line py-5 sm:grid-cols-[10rem_1fr]">
            <dt className="text-sm text-taupe-deep">{dict.booking.details.notes}</dt>
            <dd className="whitespace-pre-line text-[0.9375rem] text-taupe-deep">{draft.customer.notes}</dd>
          </div>
        )}
      </dl>
      {selection.service && (
        <div className="flex items-baseline justify-between gap-4 py-6">
          <span className="text-sm text-taupe-deep">
            {t.duration}: <span className="tabular">{formatDuration(selection.service.durationMinutes, dict.common.minutes)}</span>
          </span>
          <span className="tabular text-2xl font-semibold">{formatPrice(selection.service.price, locale)}</span>
        </div>
      )}
      <p className="text-sm text-taupe-deep">{t.payNote}</p>
    </div>
  );
}

export function Confirmation({
  locale,
  dict,
  reference,
  selection,
  onNewBooking,
}: {
  locale: Locale;
  dict: BookingDict;
  reference: string;
  selection: ResolvedSelection;
  onNewBooking: () => void;
}) {
  const t = dict.booking.confirmation;
  const r = dict.booking.review;
  return (
    <div className="mx-auto max-w-2xl py-6 text-center sm:py-12">
      <CircleCheck aria-hidden className="mx-auto size-10 text-brass" strokeWidth={1.25} />
      <p className="eyebrow mt-8 text-taupe-deep">{t.eyebrow}</p>
      <h2 className="mt-4 text-display-md font-medium text-balance">{t.title}</h2>
      <p className="mx-auto mt-5 max-w-lg leading-relaxed text-taupe-deep">{t.lead}</p>

      <dl className="mt-12 border-t border-line-strong text-left">
        {[
          [t.reference, reference],
          [r.service, selection.service?.name],
          [r.barber, selection.barberLabel],
          [r.date, selection.dateLabel],
          [r.time, selection.time],
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-6 border-b border-line py-4">
            <dt className="text-sm text-taupe-deep">{label}</dt>
            <dd className="tabular text-right font-medium">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>

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
    <div className="border border-line bg-paper-deep/60 p-6">
      <h2 className="eyebrow text-taupe-deep">{t.summary.title}</h2>
      {selection.service ? (
        <>
          <p className="mt-5 text-lg font-semibold tracking-tight">{selection.service.name}</p>
          <p className="tabular mt-1 text-sm text-taupe-deep">
            {formatDuration(selection.service.durationMinutes, dict.common.minutes)}
          </p>
          <dl className="mt-6 space-y-3 border-t border-line pt-5 text-sm">
            {[
              [t.review.barber, selection.barberLabel],
              [t.review.date, selection.dateLabel],
              [t.review.time, selection.time],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-taupe-deep">{label}</dt>
                <dd className="tabular text-right font-medium">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 flex items-baseline justify-between border-t border-line pt-5">
            <span className="text-sm text-taupe-deep">{t.summary.total}</span>
            <span className="tabular text-xl font-semibold">{formatPrice(selection.service.price, locale)}</span>
          </div>
        </>
      ) : (
        <p className="mt-5 text-sm text-taupe-deep">{t.summary.empty}</p>
      )}
    </div>
  );
}
