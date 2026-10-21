import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { site } from "@/content/site";
import type { ServiceCategory } from "@/content/types";
import { getBarbers, getServices, serviceCategoryLabels, serviceCategoryOrder } from "@/lib/data";
import type { BookingCatalog } from "@/lib/booking/types";
import { pageMetadata } from "@/lib/metadata";
import { routes } from "@/lib/navigation";
import { Container } from "@/components/ui/container";
import { DemoNotice } from "@/components/ui/demo-notice";
import { PageIntro } from "@/components/sections/page-intro";
import { BookingFlow } from "@/components/booking/booking-flow";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return pageMetadata({ locale, path: routes.booking, title: dict.meta.booking, description: dict.booking.lead });
}

export default async function BookingPage() {
  const locale = await getLocale();
  const [dict, services, barbers] = await Promise.all([getDictionary(locale), getServices(locale), getBarbers(locale)]);
  const t = dict.booking;

  const ordered = serviceCategoryOrder.flatMap((c) => services.filter((s) => s.category === c));
  const categoryLabels = Object.fromEntries(
    serviceCategoryOrder.map((c) => [c, serviceCategoryLabels[c][locale]]),
  ) as Record<ServiceCategory, string>;

  // Only what the browser needs: no images, bios or unused copy cross the boundary.
  const catalog: BookingCatalog = {
    services: services.map(({ id, durationMinutes }) => ({ id, durationMinutes })),
    barbers: barbers.map(({ id, serviceIds, workingDays }) => ({ id, serviceIds, workingDays })),
    hours: site.hours,
    slotIntervalMinutes: site.booking.slotIntervalMinutes,
  };

  return (
    <>
      <PageIntro eyebrow={t.eyebrow} title={t.title} lead={t.lead} className="pb-10 sm:pb-14">
        {site.isDemo && <DemoNotice className="mt-8 max-w-2xl lg:hidden">{t.demoNotice}</DemoNotice>}
      </PageIntro>
      <Container className="pb-section">
        <BookingFlow
          locale={locale}
          dict={{ booking: dict.booking, common: dict.common, calendar: dict.calendar, weekdays: dict.weekdays }}
          services={ordered.map(({ id, category, name, summary, durationMinutes, price }) => ({
            id,
            category,
            name,
            summary,
            durationMinutes,
            price,
          }))}
          barbers={barbers.map(({ id, name, role, specialties, serviceIds, workingDays }) => ({
            id,
            name,
            role,
            specialties,
            serviceIds,
            workingDays,
          }))}
          categoryLabels={categoryLabels}
          catalog={catalog}
          daysAhead={site.booking.daysAhead}
        />
      </Container>
    </>
  );
}
