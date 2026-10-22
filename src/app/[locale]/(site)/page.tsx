import type { Metadata } from "next";
import { localizedPath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import {
  getBarbers,
  getFeaturedServices,
  getGallery,
  getSiteDictionary,
  getSlotMedia,
  getStudioProfile,
  getTestimonials,
} from "@/lib/data";
import { pageMetadata } from "@/lib/metadata";
import { routes } from "@/lib/navigation";
import { ArrowLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { HomeHero } from "@/components/sections/home-hero";
import { HomeVideoHero } from "@/components/sections/home-video-hero";
import { homeHeroVariant } from "@/lib/hero/variant";
import { Statement } from "@/components/sections/statement";
import { StudioIntro } from "@/components/sections/studio-intro";
import { ServiceList } from "@/components/sections/service-list";
import { BarberFeature } from "@/components/sections/barber-grid";
import { WorkGrid } from "@/components/sections/work-grid";
import { Testimonials } from "@/components/sections/testimonials";
import { VisitSummary } from "@/components/sections/visit-summary";
import { BookingCta } from "@/components/sections/booking-cta";

const featuredWork = ["g-side-part", "g-beard", "g-line-up", "g-texture", "g-razor"];

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const [dict, studio] = await Promise.all([getDictionary(locale), getStudioProfile()]);
  return {
    ...pageMetadata({ locale, path: routes.home, description: dict.meta.siteDescription }),
    title: { absolute: `${studio.name} — ${dict.meta.home}` },
  };
}

export default async function HomePage() {
  const locale = await getLocale();
  const [dict, services, barbers, work, testimonials, studio, introMedia, visitMedia] = await Promise.all([
    getSiteDictionary(locale),
    getFeaturedServices(locale),
    getBarbers(locale),
    getGallery(locale, featuredWork),
    getTestimonials(locale),
    getStudioProfile(),
    getSlotMedia("home.intro", locale),
    getSlotMedia("home.visit", locale),
  ]);
  const t = dict.home;

  return (
    <>
      {homeHeroVariant === "video" ? (
        <HomeVideoHero locale={locale} dict={dict} afterId={`after-hero-${locale}`} />
      ) : (
        <HomeHero locale={locale} dict={dict} studio={studio} afterId={`after-hero-${locale}`} />
      )}
      {/* Skip-intro target; focusable so keyboard users land after the sequence. */}
      <span id={`after-hero-${locale}`} tabIndex={-1} className="block outline-none" />
      <Statement text={t.statement} label={studio.name} />
      <StudioIntro dict={dict} media={introMedia} />

      <section className="bg-surface py-section">
        <Container>
          <SectionHeading
            index="01"
            layout="split"
            eyebrow={t.services.eyebrow}
            title={t.services.title}
            lead={t.services.lead}
            action={<ArrowLink href={localizedPath(locale, routes.services)}>{t.services.link}</ArrowLink>}
          />
          <div className="mt-12 lg:mt-16 lg:grid lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-9 lg:col-start-4">
              <ServiceList locale={locale} dict={dict} services={services} />
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-stone py-section">
        <Container>
          <SectionHeading
            index="02"
            eyebrow={t.barbers.eyebrow}
            title={t.barbers.title}
            action={<ArrowLink href={localizedPath(locale, routes.barbers)}>{t.barbers.link}</ArrowLink>}
          />
          <div className="mt-14 lg:mt-20">
            <BarberFeature locale={locale} dict={dict} barbers={barbers} />
          </div>
        </Container>
      </section>

      <section className="bg-ink py-section text-canvas">
        <Container>
          <SectionHeading
            index="03"
            tone="inverse"
            layout="split"
            eyebrow={t.work.eyebrow}
            title={t.work.title}
            action={
              <ArrowLink href={localizedPath(locale, routes.gallery)} className="text-canvas">
                {t.work.link}
              </ArrowLink>
            }
          />
          <div className="mt-14 lg:mt-20">
            <WorkGrid items={work} />
          </div>
        </Container>
      </section>

      {testimonials.length > 0 && <Testimonials dict={dict} testimonials={testimonials} index="04" />}
      <VisitSummary locale={locale} dict={dict} media={visitMedia} index={testimonials.length > 0 ? "05" : "04"} studio={studio} />
      <BookingCta locale={locale} dict={dict} phoneHref={studio.contact.phoneHref} />
    </>
  );
}
