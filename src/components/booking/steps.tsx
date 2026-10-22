"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { ServiceCategory } from "@/content/types";
import { ANY_BARBER, type BookingProvider, type CustomerDetails, type TimeSlot } from "@/lib/booking/types";
import { parseISODate, weekdayOf } from "@/lib/booking/dates";
import { invalidCustomerFields, LIMITS, type CustomerField } from "@/lib/booking/validation";
import { formatDuration, formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import { OptionCard } from "./option-card";
import type { BookingBarber, BookingDict, BookingService } from "./types";

/* ---------------------------------- Service --------------------------------- */

export function ServiceStep({
  idPrefix,
  locale,
  dict,
  services,
  categoryLabels,
  value,
  onChange,
}: {
  idPrefix: string;
  locale: Locale;
  dict: BookingDict;
  services: BookingService[];
  categoryLabels: Record<ServiceCategory, string>;
  value: string | null;
  onChange: (id: string) => void;
}) {
  const categories = [...new Set(services.map((s) => s.category))];
  return (
    <fieldset>
      <legend className="sr-only">{dict.booking.service.title}</legend>
      <div className="space-y-10">
        {categories.map((category) => (
          <div key={category}>
            <p className="eyebrow mb-4 text-taupe-deep">{categoryLabels[category]}</p>
            <div className="grid gap-3">
              {services
                .filter((s) => s.category === category)
                .map((service) => (
                  <OptionCard
                    key={service.id}
                    name={`${idPrefix}-service`}
                    value={service.id}
                    checked={value === service.id}
                    onSelect={onChange}
                  >
                    <span className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <span className="text-lg font-semibold tracking-tight">{service.name}</span>
                      <span className="tabular font-semibold">{formatPrice(service.price, locale)}</span>
                    </span>
                    <span className="mt-1.5 block text-sm leading-relaxed text-taupe-deep">{service.summary}</span>
                    <span className="tabular mt-2 block text-xs text-taupe-deep">
                      {formatDuration(service.durationMinutes, dict.common.minutes)}
                    </span>
                  </OptionCard>
                ))}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

/* ---------------------------------- Barber ---------------------------------- */

export function BarberStep({
  idPrefix,
  dict,
  barbers,
  serviceId,
  value,
  onChange,
}: {
  idPrefix: string;
  dict: BookingDict;
  barbers: BookingBarber[];
  serviceId: string | null;
  value: string | null;
  onChange: (id: string) => void;
}) {
  const t = dict.booking.barber;
  return (
    <fieldset>
      <legend className="sr-only">{t.title}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <OptionCard name={`${idPrefix}-barber`} value={ANY_BARBER} checked={value === ANY_BARBER} onSelect={onChange} className="sm:col-span-2">
          <span className="block text-lg font-semibold tracking-tight">{t.any}</span>
          <span className="mt-1 block text-sm text-taupe-deep">{t.anyHint}</span>
        </OptionCard>
        {barbers.map((barber) => {
          const offers = serviceId ? barber.serviceIds.includes(serviceId) : true;
          return (
            <OptionCard
              key={barber.id}
              name={`${idPrefix}-barber`}
              value={barber.id}
              checked={value === barber.id}
              disabled={!offers}
              onSelect={onChange}
            >
              <span className="block text-lg font-semibold tracking-tight">{barber.name}</span>
              <span className="mt-1 block text-sm text-taupe-deep">{barber.role}</span>
              <span className="mt-3 block text-xs leading-relaxed text-taupe-deep">
                {offers ? barber.specialties.join(" · ") : t.notOffered}
              </span>
            </OptionCard>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ------------------------------- Date and time ------------------------------ */

const DATES_PER_PAGE = 7;

export function TimeStep({
  idPrefix,
  dict,
  provider,
  dates,
  isDateOpen,
  serviceId,
  barberId,
  date,
  time,
  refreshKey,
  onDateChange,
  onTimeChange,
}: {
  idPrefix: string;
  dict: BookingDict;
  provider: BookingProvider;
  dates: string[];
  /** Hint from working hours; days nobody works are disabled. */
  isDateOpen: (date: string) => boolean;
  serviceId: string;
  barberId: string;
  date: string | null;
  time: string | null;
  /** Changing it fetches availability again. */
  refreshKey: number;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string | null) => void;
}) {
  const t = dict.booking.time;
  const selectedIndex = date ? dates.indexOf(date) : -1;
  const [page, setPage] = useState(() => Math.max(0, Math.floor(selectedIndex / DATES_PER_PAGE)));
  const pageCount = Math.ceil(dates.length / DATES_PER_PAGE);
  const visible = dates.slice(page * DATES_PER_PAGE, (page + 1) * DATES_PER_PAGE);

  // Results are keyed by query so "loading" is derived instead of set in the effect.
  const [attempt, setAttempt] = useState(0);
  const queryKey = date ? `${serviceId}|${barberId}|${date}|${refreshKey}|${attempt}` : null;
  const [result, setResult] = useState<{ key: string; slots: TimeSlot[] | null } | null>(null);
  const loading = queryKey !== null && result?.key !== queryKey;
  const failed = !loading && result?.slots === null;
  const slots = !loading && result?.slots ? result.slots : [];

  useEffect(() => {
    if (!date || !queryKey) return;
    let cancelled = false;
    provider.getAvailability({ date, serviceId, barberId }).then(
      (next) => {
        if (cancelled) return;
        setResult({ key: queryKey, slots: next });
        // A previously chosen time that has since been taken is dropped.
        if (time && !next.some((s) => s.time === time && s.available)) onTimeChange(null);
      },
      () => {
        if (!cancelled) setResult({ key: queryKey, slots: null });
      },
    );
    return () => {
      cancelled = true;
    };
    // `time` and `onTimeChange` are read once per fetch, not tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, date, serviceId, barberId, queryKey]);

  const isClosed = date ? !isDateOpen(date) : false;
  const anyAvailable = slots.some((s) => s.available);

  return (
    <div className="space-y-10">
      <fieldset>
        <div className="mb-4 flex items-center justify-between gap-4">
          <legend className="eyebrow text-taupe-deep">{t.dateLabel}</legend>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label={t.prevDates}
              className="inline-flex size-10 items-center justify-center rounded-full border border-line transition-colors hover:border-ink disabled:opacity-30 disabled:hover:border-line"
            >
              <ChevronLeft className="size-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              aria-label={t.nextDates}
              className="inline-flex size-10 items-center justify-center rounded-full border border-line transition-colors hover:border-ink disabled:opacity-30 disabled:hover:border-line"
            >
              <ChevronRight className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {visible.map((iso) => {
            const d = parseISODate(iso);
            const weekday = weekdayOf(iso);
            const closed = !isDateOpen(iso);
            const checked = date === iso;
            const isToday = iso === dates[0];
            return (
              <label
                key={iso}
                className={cn(
                  "relative flex cursor-pointer flex-col items-center gap-1 border py-3 text-center transition-colors duration-300",
                  "has-focus-visible:outline has-focus-visible:outline-[1.5px] has-focus-visible:outline-offset-2 has-focus-visible:outline-brass",
                  checked ? "border-ink bg-ink text-paper" : "border-line hover:border-line-strong",
                  closed && "cursor-not-allowed opacity-40 hover:border-line",
                )}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-date`}
                  value={iso}
                  checked={checked}
                  disabled={closed}
                  onChange={() => onDateChange(iso)}
                  className="sr-only"
                />
                <span className={cn("text-[0.625rem] font-semibold tracking-[0.12em] uppercase", checked ? "text-paper/70" : "text-taupe-deep")}>
                  {isToday ? dict.calendar.today : dict.calendar.weekdaysShort[weekday]}
                </span>
                <span className="tabular text-lg font-semibold leading-none sm:text-xl">{d.getDate()}</span>
                <span className={cn("hidden text-[0.625rem] sm:block", checked ? "text-paper/60" : "text-taupe-deep")}>
                  {dict.calendar.monthsShort[d.getMonth()]}
                </span>
                {closed && <span className="sr-only">{t.closed}</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset aria-busy={loading}>
        <legend className="eyebrow mb-4 text-taupe-deep">{t.slotsLabel}</legend>
        {!date ? null : isClosed ? (
          <p className="text-sm text-taupe-deep">{t.closed}</p>
        ) : failed ? (
          <div className="flex flex-wrap items-center gap-4">
            <p role="alert" className="text-sm text-danger">
              {t.loadError}
            </p>
            <button
              type="button"
              onClick={() => setAttempt((a) => a + 1)}
              className="text-sm font-medium underline underline-offset-4 hover:opacity-70"
            >
              {t.retry}
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5" aria-label={t.loadingSlots}>
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className="h-11 animate-pulse bg-paper-deep" />
            ))}
          </div>
        ) : !anyAvailable ? (
          <p className="text-sm text-taupe-deep">{t.noSlots}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {slots.map((slot) => {
              const checked = time === slot.time;
              return (
                <label
                  key={slot.time}
                  className={cn(
                    "tabular relative flex h-11 cursor-pointer items-center justify-center border text-sm font-medium transition-colors duration-300",
                    "has-focus-visible:outline has-focus-visible:outline-[1.5px] has-focus-visible:outline-offset-2 has-focus-visible:outline-brass",
                    checked ? "border-ink bg-ink text-paper" : "border-line hover:border-line-strong",
                    !slot.available && "cursor-not-allowed text-taupe/60 line-through decoration-taupe/40 hover:border-line",
                  )}
                >
                  <input
                    type="radio"
                    name={`${idPrefix}-time`}
                    value={slot.time}
                    checked={checked}
                    disabled={!slot.available}
                    onChange={() => onTimeChange(slot.time)}
                    className="sr-only"
                  />
                  {slot.time}
                </label>
              );
            })}
          </div>
        )}
        <p className="mt-5 text-xs text-taupe-deep">{t.liveNotice}</p>
      </fieldset>
    </div>
  );
}

/* ---------------------------------- Details --------------------------------- */

export type DetailErrors = Partial<Record<CustomerField, string>>;

/** The same rules the server applies, for instant feedback. */
export function validateCustomer(customer: CustomerDetails, dict: BookingDict): DetailErrors {
  const messages = dict.booking.details.errors;
  return Object.fromEntries(invalidCustomerFields(customer).map((field) => [field, messages[field]]));
}

/** Field ids are scoped per flow instance: preserved (hidden) routes keep their DOM. */
export const fieldId = (prefix: string, field: keyof CustomerDetails) => `${prefix}-${field}`;

export function DetailsStep({
  dict,
  idPrefix,
  value,
  errors,
  onChange,
}: {
  dict: BookingDict;
  idPrefix: string;
  value: CustomerDetails;
  errors: DetailErrors;
  onChange: (next: CustomerDetails) => void;
}) {
  const t = dict.booking.details;
  const id = (field: keyof CustomerDetails) => fieldId(idPrefix, field);
  const set = (key: keyof CustomerDetails) => (e: { target: { value: string } }) =>
    onChange({ ...value, [key]: e.target.value });

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Field id={id("name")} label={t.name} error={errors.name}>
        <input
          id={id("name")}
          name="name"
          autoComplete="name"
          aria-required
          maxLength={LIMITS.name}
          value={value.name}
          onChange={set("name")}
          placeholder={t.namePlaceholder}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? `${id("name")}-error` : undefined}
          className={inputClass(!!errors.name)}
        />
      </Field>
      <Field id={id("phone")} label={t.phone} error={errors.phone}>
        <input
          id={id("phone")}
          name="phone"
          type="tel"
          aria-required
          inputMode="tel"
          autoComplete="tel"
          value={value.phone}
          onChange={set("phone")}
          placeholder={t.phonePlaceholder}
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? `${id("phone")}-error` : undefined}
          className={inputClass(!!errors.phone)}
        />
      </Field>
      <Field id={id("email")} label={t.email} error={errors.email} className="sm:col-span-2">
        <input
          id={id("email")}
          name="email"
          type="email"
          autoComplete="email"
          maxLength={LIMITS.email}
          value={value.email}
          onChange={set("email")}
          placeholder={t.emailPlaceholder}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? `${id("email")}-error` : undefined}
          className={inputClass(!!errors.email)}
        />
      </Field>
      <Field id={id("notes")} label={t.notes} error={errors.notes} className="sm:col-span-2">
        <textarea
          id={id("notes")}
          name="notes"
          rows={4}
          maxLength={LIMITS.notes}
          value={value.notes}
          onChange={set("notes")}
          placeholder={t.notesPlaceholder}
          aria-invalid={!!errors.notes}
          aria-describedby={errors.notes ? `${id("notes")}-error` : undefined}
          className={cn(inputClass(!!errors.notes), "h-auto resize-y py-3")}
        />
      </Field>
    </div>
  );
}

function inputClass(invalid: boolean) {
  return cn(
    "h-12 w-full border bg-paper px-4 text-base text-ink placeholder:text-taupe-deep/90 transition-colors duration-300 focus:outline-none focus-visible:outline-none focus:border-ink",
    invalid ? "border-danger" : "border-line-strong hover:border-ink/50",
  );
}

function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
