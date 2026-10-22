import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getServiceCategories, getServices, getSiteDictionary, getSlotMedia, getStudioProfile } from "@/lib/data";
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
  const [dict, services, categories, studio, feature] = await Promise.all([
    getSiteDictionary(locale),
    getServices(locale),
    getServiceCategories(locale),
    getStudioProfile(),
    getSlotMedia("services.feature", locale),
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
        {studio.isDemo && <DemoNotice className="mt-6">{t.demoNotice}</DemoNotice>}
      </PageIntro>

      {groups.length > 1 && (
        <Container>
          <nav aria-label={t.categoriesLabel} className="flex flex-wrap gap-2 border-t border-line pt-6">
            {groups.map(({ category, items }) => (
              <a
                key={category.id}
                href={`#cat-${category.id}-${locale}`}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-medium transition-colors duration-200 hover:border-ink hover:bg-surface"
              >
                {category.name}
                <span className="tabular text-muted">{items.length}</span>
              </a>
            ))}
          </nav>
        </Container>
      )}

      <Container className="pb-section pt-12 sm:pt-16">
        <div className="space-y-16 sm:space-y-24">
          {groups.map(({ category, items, startIndex }) => (
            <section
              key={category.id}
              id={`cat-${category.id}-${locale}`}
              aria-labelledby={`cat-title-${category.id}-${locale}`}
              className="grid scroll-mt-28 gap-6 lg:grid-cols-12 lg:gap-8"
            >
              <div className="lg:col-span-3 lg:pt-6">
                <h2 id={`cat-title-${category.id}-${locale}`} className="text-display-sm lg:sticky lg:top-28">
                  {category.name}
                </h2>
              </div>
              <div className="lg:col-span-9">
                <ServiceList locale={locale} dict={dict} services={items} detailed startIndex={startIndex} />
              </div>
            </section>
          ))}
        </div>
      </Container>

      <section className="bg-stone py-section">
        <Container className="grid gap-12 md:grid-cols-12 md:gap-8">
          <Reveal variant="mask" className="md:col-span-6 lg:col-span-5">
            <Photo media={feature} ratio="4/5" sizes="(min-width: 1024px) 40vw, (min-width: 768px) 50vw, 100vw" />
          </Reveal>
          <Reveal delay={120} className="flex flex-col justify-end md:col-span-6 lg:col-span-6 lg:col-start-7">
            <h2 className="text-display-md">{t.notesTitle}</h2>
            <ol className="mt-10 border-t border-line-strong">
              {t.notes.map((note, i) => (
                <li key={note} className="grid grid-cols-[2.5rem_1fr] gap-4 border-b border-line py-5 text-[1.0625rem] leading-relaxed">
                  <span className="tabular pt-0.5 text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
                  {note}
                </li>
              ))}
            </ol>
          </Reveal>
        </Container>
      </section>

      <BookingCta locale={locale} dict={dict} phoneHref={studio.contact.phoneHref} />
    </>
  );
}
