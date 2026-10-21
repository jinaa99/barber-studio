import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getBarbers, getBookingConfig, getServiceCategories, getServices, getStudioProfile } from "@/lib/data";
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
  const [dict, services, barbers, config, categories, studio] = await Promise.all([
    getDictionary(locale),
    getServices(locale),
    getBarbers(locale),
    getBookingConfig(),
    getServiceCategories(locale),
    getStudioProfile(),
  ]);
  const t = dict.booking;

  const ordered = categories.flatMap((c) => services.filter((s) => s.category === c.id));
  const categoryLabels = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return (
    <>
      <PageIntro eyebrow={t.eyebrow} title={t.title} lead={t.lead} className="pb-10 sm:pb-14">
        {studio.isDemo && <DemoNotice className="mt-8 max-w-2xl lg:hidden">{t.demoNotice}</DemoNotice>}
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
          isDemo={studio.isDemo}
          studioPhone={studio.contact.phoneDisplay}
        />
      </Container>
    </>
  );
}
