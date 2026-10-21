import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getMedia, getServiceCategories, getServices, getSiteDictionary, getStudioProfile } from "@/lib/data";
import { pageMetadata } from "@/lib/metadata";
import { routes } from "@/lib/navigation";
import { Container } from "@/components/ui/container";
import { DemoNotice } from "@/components/ui/demo-notice";
import { Reveal } from "@/components/ui/reveal";
import { Photo } from "@/components/media/photo";
import { PageIntro } from "@/components/sections/page-intro";
import { ServiceList } from "@/components/sections/service-list";
import { BookingCta } from "@/components/sections/booking-cta";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return pageMetadata({ locale, path: routes.services, title: dict.meta.services, description: dict.servicesPage.lead });
}

export default async function ServicesPage() {
  const locale = await getLocale();
  const [dict, services, categories, studio] = await Promise.all([
    getSiteDictionary(locale),
    getServices(locale),
    getServiceCategories(locale),
    getStudioProfile(),
  ]);
  const t = dict.servicesPage;

  // Group by category while keeping one running number across the whole list.
  const groups = categories
    .map((category) => ({ category, items: services.filter((s) => s.category === category.id) }))
    .filter((g) => g.items.length > 0)
    .map((g, i, all) => ({ ...g, startIndex: all.slice(0, i).reduce((n, prev) => n + prev.items.length, 0) }));

  return (
    <>
      <PageIntro eyebrow={t.eyebrow} title={t.title} lead={t.lead}>
        {studio.isDemo && <DemoNotice className="mt-8">{t.demoNotice}</DemoNotice>}
      </PageIntro>

      <Container className="pb-section">
        <div className="space-y-20 sm:space-y-28">
          {groups.map(({ category, items, startIndex }) => {
            return (
              <section key={category.id} aria-labelledby={`cat-${category.id}-${locale}`} className="grid gap-8 lg:grid-cols-12">
                <h2 id={`cat-${category.id}-${locale}`} className="eyebrow text-taupe-deep lg:col-span-3 lg:pt-9">
                  {category.name}
                </h2>
                <div className="lg:col-span-9">
                  <ServiceList locale={locale} dict={dict} services={items} detailed startIndex={startIndex} />
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-24 grid gap-12 sm:mt-32 md:grid-cols-12 md:gap-8">
          <Reveal className="md:col-span-5">
            <Photo media={getMedia("studio-tools", locale)} ratio="4/5" sizes="(min-width: 768px) 40vw, 100vw" />
          </Reveal>
          <Reveal delay={120} className="flex flex-col justify-end md:col-span-6 md:col-start-7">
            <h2 className="text-display-md font-medium">{t.notesTitle}</h2>
            <ul className="mt-8 border-t border-line-strong">
              {t.notes.map((note, i) => (
                <li key={note} className="flex gap-5 border-b border-line py-5 text-[0.9375rem] leading-relaxed">
                  <span className="tabular pt-0.5 text-xs font-semibold text-brass">{String(i + 1).padStart(2, "0")}</span>
                  {note}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Container>

      <BookingCta locale={locale} dict={dict} phoneHref={studio.contact.phoneHref} />
    </>
  );
}
