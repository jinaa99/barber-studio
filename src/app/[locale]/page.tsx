import type { Metadata } from "next";
import { localizedPath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { site } from "@/content/site";
import { getBarbers, getFeaturedServices, getGallery, getMedia, getTestimonials } from "@/lib/data";
import { pageMetadata } from "@/lib/metadata";
import { routes } from "@/lib/navigation";
import { ArrowLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { HomeHero } from "@/components/sections/home-hero";
import { Statement } from "@/components/sections/statement";
import { StudioIntro } from "@/components/sections/studio-intro";
import { ServiceList } from "@/components/sections/service-list";
import { BarberGrid } from "@/components/sections/barber-grid";
import { WorkGrid } from "@/components/sections/work-grid";
import { Testimonials } from "@/components/sections/testimonials";
import { VisitSummary } from "@/components/sections/visit-summary";
import { BookingCta } from "@/components/sections/booking-cta";

const featuredWork = ["g-side-part", "g-beard", "g-line-up", "g-texture", "g-razor"];

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return {
    ...pageMetadata({ locale, path: routes.home, description: dict.meta.siteDescription }),
    title: { absolute: `${site.brand.name} — ${dict.meta.home}` },
  };
}

export default async function HomePage() {
  const locale = await getLocale();
  const [dict, services, barbers, work, testimonials] = await Promise.all([
    getDictionary(locale),
    getFeaturedServices(locale),
    getBarbers(locale),
    getGallery(locale, featuredWork),
    getTestimonials(locale),
  ]);
  const t = dict.home;

  return (
    <>
      <HomeHero locale={locale} dict={dict} media={getMedia("studio-hero", locale)} />
      <Statement text={t.statement} />
      <StudioIntro dict={dict} media={getMedia("studio-interior", locale)} />

      <section className="bg-paper-deep py-section">
        <Container>
          <SectionHeading
            index="01"
            eyebrow={t.services.eyebrow}
            title={t.services.title}
            lead={t.services.lead}
            action={<ArrowLink href={localizedPath(locale, routes.services)}>{t.services.link}</ArrowLink>}
          />
          <div className="mt-14">
            <ServiceList locale={locale} dict={dict} services={services} />
          </div>
        </Container>
      </section>

      <section className="py-section">
        <Container>
          <SectionHeading
            index="02"
            eyebrow={t.barbers.eyebrow}
            title={t.barbers.title}
            action={<ArrowLink href={localizedPath(locale, routes.barbers)}>{t.barbers.link}</ArrowLink>}
          />
          <div className="mt-14">
            <BarberGrid dict={dict} barbers={barbers} />
          </div>
        </Container>
      </section>

      <section className="bg-ink py-section text-paper">
        <Container>
          <SectionHeading
            index="03"
            tone="inverse"
            eyebrow={t.work.eyebrow}
            title={t.work.title}
            action={
              <ArrowLink href={localizedPath(locale, routes.gallery)} className="text-paper">
                {t.work.link}
              </ArrowLink>
            }
          />
          <div className="mt-14">
            <WorkGrid items={work} />
          </div>
        </Container>
      </section>

      <Testimonials dict={dict} testimonials={testimonials} index="04" />
      <VisitSummary locale={locale} dict={dict} media={getMedia("studio-chair", locale)} index="05" />
      <BookingCta locale={locale} dict={dict} />
    </>
  );
}
