import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { site } from "@/content/site";
import type { ServiceCategory } from "@/content/types";
import { getBarbers, getBookingConfig, getServices, serviceCategoryLabels, serviceCategoryOrder } from "@/lib/data";
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
  const [dict, services, barbers, config] = await Promise.all([
    getDictionary(locale),
    getServices(locale),
    getBarbers(locale),
    getBookingConfig(),
  ]);
  const t = dict.booking;

  const ordered = serviceCategoryOrder.flatMap((c) => services.filter((s) => s.category === c));
  const categoryLabels = Object.fromEntries(
    serviceCategoryOrder.map((c) => [c, serviceCategoryLabels[c][locale]]),
  ) as Record<ServiceCategory, string>;

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
          // Only what the browser needs: no images, bios or unused copy cross the boundary.
          barbers={barbers.map(({ id, name, role, specialties, serviceIds, workingHours }) => ({
            id,
            name,
            role,
            specialties,
            serviceIds,
            workingHours,
          }))}
          categoryLabels={categoryLabels}
          config={config}
          isDemo={site.isDemo}
        />
      </Container>
    </>
  );
}
