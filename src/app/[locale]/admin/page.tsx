import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath, type Locale, type LocalizedText } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { routes } from "@/lib/navigation";
import { format, formatPrice } from "@/lib/format";
import { formatLongDate, minutesToTime } from "@/lib/booking/dates";
import { addCalendarDays, isISODate, zonedParts } from "@/lib/booking/time";
import { allowedTransitions } from "@/lib/booking/status";
import { cn } from "@/lib/cn";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/auth";
import { hasRole, type StaffUser } from "@/lib/server/accounts";
import { listAppointmentsForDay } from "@/lib/server/appointments";
import { getBookingRules } from "@/lib/server/settings";
import { Container } from "@/components/ui/container";
import { changeStatusAction, logoutAction, setServiceActiveAction, type AdminNotice } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.admin, robots: { index: false, follow: false } };
}

export default async function AdminPage({ searchParams }: PageProps<"/[locale]/admin">) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Container className="py-16 sm:py-20">
      <p className="eyebrow text-taupe-deep">{dict.admin.eyebrow}</p>
      {/* The session is read per request, so everything below streams in behind this boundary. */}
      <Suspense fallback={<p className="mt-6 text-sm text-taupe-deep">{dict.admin.dashboard.loading}</p>}>
        <Dashboard locale={locale} dict={dict} searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

const noticeKeys: AdminNotice[] = ["forbidden", "invalidTransition", "generic"];

async function Dashboard({
  locale,
  dict,
  searchParams,
}: {
  locale: Locale;
  dict: Dictionary;
  searchParams: PageProps<"/[locale]/admin">["searchParams"];
}) {
  const user = await requireUser(locale);
  const params = await searchParams;
  const t = dict.admin;

  const { timeZone } = await getBookingRules(db);
  const today = zonedParts(new Date(), timeZone).date;
  const date = typeof params.date === "string" && isISODate(params.date) ? params.date : today;
  const includeDemo = params.demo !== "0";
  const notice = noticeKeys.find((n) => n === params.notice);

  const base = localizedPath(locale, routes.admin);
  const href = (next: { date?: string; demo?: boolean }) => {
    const query = new URLSearchParams();
    const d = next.date ?? date;
    if (d !== today) query.set("date", d);
    if (!(next.demo ?? includeDemo)) query.set("demo", "0");
    const qs = query.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const returnTo = href({});

  const [appointments, services] = await Promise.all([
    listAppointmentsForDay(db, date, { includeDemo }),
    db.service.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true, active: true, priceMnt: true } }),
  ]);
  const now = new Date();
  const name = (value: unknown) => (value as LocalizedText)[locale];
  const dateLabel = formatLongDate(date, { weekdays: dict.weekdays, monthsLong: dict.calendar.monthsLong, dateLong: dict.calendar.dateLong });

  return (
    <>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
        <h1 className="text-display-md font-medium">{t.dashboard.title}</h1>
        <form action={logoutAction} className="flex items-center gap-4 text-sm text-taupe-deep">
          <input type="hidden" name="locale" value={locale} />
          <span>{format(t.dashboard.signedInAs, { name: user.name })}</span>
          <button type="submit" className="font-medium text-ink underline underline-offset-4 hover:opacity-70">
            {t.dashboard.signOut}
          </button>
        </form>
      </div>

      {notice && (
        <p role="alert" className="mt-8 border-l-2 border-danger pl-4 text-sm text-danger">
          {t.errors[notice]}
        </p>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div className="flex items-center gap-2">
          <Link href={href({ date: addCalendarDays(date, -1) })} aria-label={t.dashboard.prevDay} className={navButton}>
            <ChevronLeft aria-hidden className="size-4" strokeWidth={1.75} />
          </Link>
          <Link href={href({ date: addCalendarDays(date, 1) })} aria-label={t.dashboard.nextDay} className={navButton}>
            <ChevronRight aria-hidden className="size-4" strokeWidth={1.75} />
          </Link>
          <p className="ml-2 font-semibold">
            {dateLabel}
            <span className="ml-3 text-sm font-normal text-taupe-deep">
              {format(t.dashboard.count, { count: appointments.length })}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {date !== today && (
            <Link href={href({ date: today })} className="underline underline-offset-4 hover:opacity-70">
              {t.dashboard.today}
            </Link>
          )}
          <Link href={href({ demo: !includeDemo })} className="text-taupe-deep underline underline-offset-4 hover:text-ink">
            {includeDemo ? t.dashboard.hideDemo : t.dashboard.showDemo}
          </Link>
        </div>
      </div>

      {appointments.length === 0 ? (
        <p className="py-10 text-sm text-taupe-deep">{t.dashboard.empty}</p>
      ) : (
        <ul>
          {appointments.map((a) => {
            const start = minutesToTime(zonedParts(a.startsAt, timeZone).minutes);
            const end = minutesToTime(zonedParts(a.endsAt, timeZone).minutes);
            const email = a.notifications.find((n) => n.channel === "EMAIL");
            const next = allowedTransitions(a.status, a.startsAt, now);
            return (
              <li key={a.id} className="grid gap-4 border-b border-line py-6 md:grid-cols-[7rem_1fr_1fr_auto] md:gap-6">
                <div className="tabular">
                  <p className="font-semibold">{start}</p>
                  <p className="text-sm text-taupe-deep">{end}</p>
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{name(a.service.name)}</p>
                  <p className="text-sm text-taupe-deep">
                    {name(a.barber.name)} · <span className="tabular">{formatPrice(a.priceMnt, locale)}</span>
                  </p>
                  <p className="tabular mt-1 text-xs text-taupe">{a.reference}</p>
                </div>
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {a.customerName}
                    {a.isDemo && <span className="eyebrow ml-2 rounded-full border border-line-strong px-2 py-0.5 text-[0.625rem]">{t.dashboard.sample}</span>}
                  </p>
                  <p className="tabular text-taupe-deep">{a.customer.phone}</p>
                  {a.customerEmail && <p className="break-all text-taupe-deep">{a.customerEmail}</p>}
                  {email && <p className="mt-1 text-xs text-taupe">{t.notification[email.status]}</p>}
                  {a.notes && <p className="mt-2 whitespace-pre-line text-taupe-deep">{a.notes}</p>}
                </div>
                <div className="flex flex-col items-start gap-3 md:items-end">
                  <span className={cn("eyebrow rounded-full px-2.5 py-1 text-[0.625rem]", statusTone[a.status])}>
                    {t.status[a.status]}
                  </span>
                  {next.length > 0 && (
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      {next.map((status) => (
                        <form key={status} action={changeStatusAction}>
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <input type="hidden" name="appointmentId" value={a.id} />
                          <input type="hidden" name="status" value={status} />
                          <button type="submit" className={actionButton}>
                            {t.actions[status]}
                          </button>
                        </form>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ServiceAdmin user={user} locale={locale} dict={dict} returnTo={returnTo} services={services} name={name} />
    </>
  );
}

function ServiceAdmin({
  user,
  locale,
  dict,
  returnTo,
  services,
  name,
}: {
  user: StaffUser;
  locale: Locale;
  dict: Dictionary;
  returnTo: string;
  services: { id: string; name: unknown; active: boolean; priceMnt: number }[];
  name: (value: unknown) => string;
}) {
  const t = dict.admin.services;
  const canEdit = hasRole(user, "ADMIN");
  return (
    <section className="mt-20">
      <h2 className="text-2xl font-semibold tracking-tight">{t.title}</h2>
      <p className="mt-2 text-sm text-taupe-deep">{canEdit ? t.lead : t.adminOnly}</p>
      <ul className="mt-6 border-t border-line-strong">
        {services.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-4">
            <div>
              <p className="font-medium">{name(s.name)}</p>
              <p className="tabular text-sm text-taupe-deep">{formatPrice(s.priceMnt, locale)}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={cn("text-sm", s.active ? "text-ink" : "text-taupe")}>{s.active ? t.active : t.inactive}</span>
              {canEdit && (
                <form action={setServiceActiveAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <input type="hidden" name="serviceId" value={s.id} />
                  <input type="hidden" name="active" value={String(!s.active)} />
                  <button type="submit" className={actionButton}>
                    {s.active ? t.deactivate : t.activate}
                  </button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const navButton =
  "inline-flex size-10 items-center justify-center rounded-full border border-line transition-colors hover:border-ink";

const actionButton =
  "h-9 rounded-full border border-line-strong px-4 text-sm font-medium transition-colors duration-300 hover:border-ink hover:bg-ink hover:text-paper";

const statusTone: Record<string, string> = {
  PENDING: "border border-brass text-ink",
  CONFIRMED: "bg-ink text-paper",
  COMPLETED: "border border-line-strong text-taupe-deep",
  CANCELLED: "border border-line text-taupe line-through",
  NO_SHOW: "border border-danger text-danger",
};
