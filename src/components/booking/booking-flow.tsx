"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import type { ServiceCategory } from "@/content/types";
import { createHttpBookingProvider } from "@/lib/booking/http-provider";
import { bookableDates, isDateBookable } from "@/lib/booking/rules";
import { isoWeekday } from "@/lib/booking/time";
import type { BookingStep } from "@/lib/booking/storage";
import { ANY_BARBER, type BookingConfig, type BookingDraft, type BookingRequest, type CustomerDetails } from "@/lib/booking/types";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DemoNotice } from "@/components/ui/demo-notice";
import { resetBooking, updateBooking, useBookingStore } from "./use-booking-store";
import { bookingSteps, StepProgress } from "./step-progress";
import {
  BarberStep,
  DetailsStep,
  ServiceStep,
  TimeStep,
  fieldId,
  validateCustomer,
  type DetailErrors,
} from "./steps";
import { BookingSummary, Confirmation, resolveSelection, ReviewStep } from "./review";
import type { BookingBarber, BookingDict, BookingService } from "./types";

interface BookingFlowProps {
  locale: Locale;
  dict: BookingDict;
  services: BookingService[];
  barbers: BookingBarber[];
  categoryLabels: Record<ServiceCategory, string>;
  config: BookingConfig;
  /** Show the placeholder-business notice. */
  isDemo: boolean;
  studioPhone: string;
}

export function BookingFlow({ locale, dict, services, barbers, categoryLabels, config, isDemo, studioPhone }: BookingFlowProps) {
  const state = useBookingStore();
  const hydrated = state !== null;
  const router = useRouter();
  const pathname = usePathname();
  const provider = useMemo(() => createHttpBookingProvider(), []);
  // Dates depend on "today" in the studio's time zone, so they are only computed in the browser.
  const dates = useMemo(() => (hydrated ? bookableDates(config) : []), [hydrated, config]);

  const [errors, setErrors] = useState<DetailErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** Bumped to make the time step fetch availability again (e.g. after a slot was taken). */
  const [slotsVersion, setSlotsVersion] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const previousStep = useRef<BookingStep | null>(null);
  const idPrefix = useId();

  const t = dict.booking;

  /** Whether any barber who could take this booking works on `date` (a hint; the server decides). */
  function dateIsOpen(draft: BookingDraft, date: string): boolean {
    const candidates = candidateBarbers(barbers, draft.barberId, draft.serviceId);
    const weekday = isoWeekday(date);
    const blocks = candidates.flatMap((b) => b.workingHours.filter((h) => h.weekday === weekday));
    const duration = services.find((s) => s.id === draft.serviceId)?.durationMinutes ?? 0;
    const latestStart = blocks.length > 0 ? Math.max(...blocks.map((b) => b.endMinute)) - duration : null;
    return isDateBookable(config, date, new Set(blocks.map((b) => b.weekday)), latestStart);
  }

  /** Entering the time step always lands on a valid, open date. */
  function withDefaultDate(next: BookingDraft, target: BookingStep): BookingDraft {
    if (target !== "time") return next;
    // The very first effect can run before `dates` is populated, so fall back to computing them.
    const options = dates.length > 0 ? dates : bookableDates(config);
    const bookable = (d: string) => dateIsOpen(next, d);
    if (next.date && options.includes(next.date) && bookable(next.date)) return next;
    return { ...next, date: options.find(bookable) ?? null, time: null };
  }

  // Deep links from service and barber pages: /booking?service=…&barber=…
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const service = services.find((s) => s.id === params.get("service"));
    const barber = barbers.find((b) => b.id === params.get("barber"));
    if (!params.has("service") && !params.has("barber")) return;

    if (service || barber) {
      updateBooking((s) => {
        const draft: BookingDraft = { ...s.draft, time: null };
        if (service) draft.serviceId = service.id;
        if (barber) draft.barberId = barber.id;
        if (!offersService(barbers, draft.barberId, draft.serviceId)) draft.barberId = null;
        const step: BookingStep = !draft.serviceId ? "service" : !draft.barberId ? "barber" : "time";
        return { step, draft: withDefaultDate(draft, step), attemptKey: null, confirmation: null };
      });
    }
    router.replace(pathname, { scroll: false });
    // Runs once per mount; later locale switches carry no query string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = state?.step ?? "service";

  // Move focus to the new step's heading so keyboard and screen-reader users follow along.
  useEffect(() => {
    if (!hydrated) return;
    if (previousStep.current && previousStep.current !== step) {
      headingRef.current?.focus({ preventScroll: true });
      const top = topRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 0) topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    previousStep.current = step;
  }, [hydrated, step]);

  if (!state) {
    return (
      <div className="flex min-h-[28rem] items-center justify-center border border-line" aria-busy>
        <p className="text-sm text-taupe-deep">{t.loading}</p>
      </div>
    );
  }

  const { draft, confirmation } = state;
  const selection = resolveSelection(draft, dict, services, barbers, confirmation);

  function patchDraft(patch: Partial<BookingDraft>) {
    updateBooking((s) => ({ ...s, draft: { ...s.draft, ...patch } }));
  }

  function goTo(target: BookingStep) {
    setNotice(null);
    updateBooking((s) => ({ ...s, step: target, draft: withDefaultDate(s.draft, target) }));
  }

  function selectService(id: string) {
    patchDraft({
      serviceId: id,
      time: null,
      barberId: offersService(barbers, draft.barberId, id) ? draft.barberId : null,
    });
  }

  function changeCustomer(customer: CustomerDetails) {
    patchDraft({ customer });
    if (Object.keys(errors).length > 0) setErrors(validateCustomer(customer, dict));
  }

  async function submit() {
    if (!draft.serviceId || !draft.barberId || !draft.date || !draft.time) return;
    setSubmitting(true);
    setNotice(null);
    // Keep the key across retries of this attempt so a lost response can't create a second booking.
    const attemptKey = state?.attemptKey ?? crypto.randomUUID();
    updateBooking((s) => ({ ...s, attemptKey }));
    const request: BookingRequest = {
      serviceId: draft.serviceId,
      barberId: draft.barberId,
      date: draft.date,
      time: draft.time,
      customer: draft.customer,
      idempotencyKey: attemptKey,
      locale,
    };
    try {
      const result = await provider.createBooking(request);
      if (result.ok) {
        updateBooking((s) => ({ ...s, attemptKey: null, confirmation: result.booking }));
        return;
      }
      // Anything but a confirmed booking ends this attempt; the next submit is a new one.
      updateBooking((s) => ({ ...s, attemptKey: null }));
      if (result.error === "slot_taken") {
        updateBooking((s) => ({ ...s, step: "time", draft: { ...s.draft, time: null } }));
        setSlotsVersion((v) => v + 1);
        setNotice(t.errors.slotTaken);
      } else if (result.error === "invalid" && result.fields?.length) {
        setErrors(Object.fromEntries(result.fields.map((f) => [f, t.details.errors[f]])));
        updateBooking((s) => ({ ...s, step: "details" }));
        setNotice(t.errors.invalid);
      } else if (result.error === "invalid") {
        // The service or barber is no longer offered: start the choice again.
        updateBooking((s) => ({ ...s, step: "service", draft: { ...s.draft, time: null } }));
        router.refresh();
        setNotice(t.errors.invalid);
      } else if (result.error === "limit_reached") {
        setNotice(t.errors.limitReached);
      } else if (result.error === "rate_limited") {
        setNotice(t.errors.rateLimited);
      } else {
        setNotice(t.errors.generic);
      }
    } catch {
      // Network failure: the booking may or may not exist, so keep the key for the retry.
      setNotice(t.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  function handleContinue() {
    if (step === "details") {
      const found = validateCustomer(draft.customer, dict);
      setErrors(found);
      const firstInvalid = (["name", "phone", "email", "notes"] as const).find((k) => found[k]);
      if (firstInvalid) {
        document.getElementById(fieldId(idPrefix, firstInvalid))?.focus();
        return;
      }
    }
    if (step === "review") {
      void submit();
      return;
    }
    goTo(bookingSteps[bookingSteps.indexOf(step) + 1]);
  }

  if (confirmation) {
    return (
      <Confirmation
        locale={locale}
        dict={dict}
        confirmation={confirmation}
        email={draft.customer.email.trim()}
        selection={selection}
        studioPhone={studioPhone}
        onNewBooking={() => {
          setErrors({});
          resetBooking();
        }}
      />
    );
  }

  const stepIndex = bookingSteps.indexOf(step);
  const canContinue =
    (step === "service" && !!draft.serviceId) ||
    (step === "barber" && !!draft.barberId) ||
    (step === "time" && !!draft.date && !!draft.time) ||
    step === "details" ||
    step === "review";

  return (
    <div ref={topRef} className="grid scroll-mt-28 gap-12 lg:grid-cols-12 lg:gap-10">
      <div className="min-w-0 lg:col-span-8">
        <StepProgress dict={dict} current={step} onSelect={goTo} />

        <h2 ref={headingRef} tabIndex={-1} className="mt-10 text-2xl font-semibold tracking-tight focus:outline-none sm:text-3xl">
          {t[step].title}
        </h2>

        {notice && (
          <p role="alert" className="mt-5 border-l-2 border-danger pl-4 text-sm text-danger">
            {notice}
          </p>
        )}

        <div className="mt-8">
          {step === "service" && (
            <ServiceStep
              idPrefix={idPrefix}
              locale={locale}
              dict={dict}
              services={services}
              categoryLabels={categoryLabels}
              value={draft.serviceId}
              onChange={selectService}
            />
          )}
          {step === "barber" && (
            <BarberStep
              idPrefix={idPrefix}
              dict={dict}
              barbers={barbers}
              serviceId={draft.serviceId}
              value={draft.barberId}
              onChange={(barberId) => patchDraft({ barberId, time: null })}
            />
          )}
          {step === "time" && draft.serviceId && draft.barberId && (
            <TimeStep
              idPrefix={idPrefix}
              dict={dict}
              provider={provider}
              dates={dates}
              serviceId={draft.serviceId}
              barberId={draft.barberId}
              date={draft.date}
              time={draft.time}
              refreshKey={slotsVersion}
              isDateOpen={(date) => dateIsOpen(draft, date)}
              onDateChange={(date) => patchDraft({ date, time: null })}
              onTimeChange={(time) => patchDraft({ time })}
            />
          )}
          {step === "details" && (
            <DetailsStep dict={dict} idPrefix={idPrefix} value={draft.customer} errors={errors} onChange={changeCustomer} />
          )}
          {step === "review" && (
            <ReviewStep locale={locale} dict={dict} draft={draft} selection={selection} onEdit={goTo} />
          )}
        </div>

        <div className="sticky bottom-0 z-10 -mx-4 mt-10 flex items-center gap-3 border-t border-line bg-paper px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:mx-0 sm:px-0 lg:static lg:pb-0">
          {stepIndex > 0 ? (
            <Button variant="secondary" onClick={() => goTo(bookingSteps[stepIndex - 1])} disabled={submitting}>
              {t.back}
            </Button>
          ) : (
            <span />
          )}
          {selection.service && (
            <span className="tabular ml-auto text-sm font-semibold lg:hidden">
              {formatPrice(selection.service.price, locale)}
            </span>
          )}
          <Button
            onClick={handleContinue}
            disabled={!canContinue || submitting}
            arrow={step !== "review"}
            className={selection.service ? "lg:ml-auto" : "ml-auto"}
          >
            {step === "review" ? (submitting ? t.review.submitting : t.review.confirm) : t.continue}
          </Button>
        </div>
      </div>

      <aside className="hidden lg:col-span-4 lg:block">
        <div className="sticky top-28 space-y-5">
          <BookingSummary locale={locale} dict={dict} selection={selection} />
          {isDemo && <DemoNotice>{t.demoNotice}</DemoNotice>}
        </div>
      </aside>
    </div>
  );
}

function offersService(barbers: BookingBarber[], barberId: string | null, serviceId: string | null): boolean {
  if (!barberId || barberId === ANY_BARBER || !serviceId) return true;
  return barbers.find((b) => b.id === barberId)?.serviceIds.includes(serviceId) ?? false;
}

/** Barbers who could take the booking: the chosen one, or everyone offering the service. */
function candidateBarbers(barbers: BookingBarber[], barberId: string | null, serviceId: string | null): BookingBarber[] {
  return barbers.filter(
    (b) => (!serviceId || b.serviceIds.includes(serviceId)) && (!barberId || barberId === ANY_BARBER || b.id === barberId),
  );
}
