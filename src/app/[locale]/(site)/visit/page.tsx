import type { Metadata } from "next";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getMedia, getSiteDictionary, getStudioProfile } from "@/lib/data";
import { pageMetadata } from "@/lib/metadata";
import { routes } from "@/lib/navigation";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { DemoNotice } from "@/components/ui/demo-notice";
import { Reveal } from "@/components/ui/reveal";
import { Photo } from "@/components/media/photo";
import { PageIntro } from "@/components/sections/page-intro";
import { BookingCta } from "@/components/sections/booking-cta";
import { OpeningHoursList } from "@/components/visit/opening-hours";
import { SocialLinks } from "@/components/visit/social-links";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return pageMetadata({ locale, path: routes.visit, title: dict.meta.visit, description: dict.visitPage.lead });
}

export default async function VisitPage() {
  const locale = await getLocale();
  const [dict, studio] = await Promise.all([getSiteDictionary(locale), getStudioProfile()]);
  const t = dict.visitPage;
  const { contact } = studio;
  const iconClass = "mt-0.5 size-4 shrink-0 text-brass";

  return (
    <>
      <PageIntro eyebrow={t.eyebrow} title={t.title} lead={t.lead}>
        {studio.isDemo && <DemoNotice className="mt-8">{t.demoNotice}</DemoNotice>}
      </PageIntro>

      <Container className="pb-section">
        <Reveal>
          <Photo media={getMedia("studio-interior", locale)} ratio="16/10" sizes="(min-width: 1440px) 1360px, 100vw" />
        </Reveal>

        <div className="mt-16 grid gap-14 sm:mt-24 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <section aria-labelledby={`visit-address-${locale}`} className="lg:col-span-4">
            <h2 id={`visit-address-${locale}`} className="eyebrow text-taupe-deep">{t.address}</h2>
            <address className="mt-5 flex gap-3 text-lg not-italic leading-relaxed">
              <MapPin aria-hidden className={iconClass} strokeWidth={1.5} />
              <span>
                {contact.address[locale]}
                <br />
                {contact.city[locale]}
              </span>
            </address>
            {contact.mapsUrl && (
              <a
                href={contact.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonStyles({ variant: "secondary", className: "mt-8" })}
              >
                {t.openMaps}
                <ArrowUpRight aria-hidden className="size-4" strokeWidth={1.75} />
              </a>
            )}

            {contact.directions[locale] && (
              <>
                <h3 className="eyebrow mt-14 text-taupe-deep">{t.directionsTitle}</h3>
                <p className="mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-taupe-deep">{contact.directions[locale]}</p>
              </>
            )}
          </section>

          <section aria-labelledby={`visit-hours-${locale}`} className="lg:col-span-4">
            <h2 id={`visit-hours-${locale}`} className="eyebrow text-taupe-deep">{t.hours}</h2>
            <OpeningHoursList dict={dict} hours={studio.hours} className="mt-3 text-[0.9375rem]" />
          </section>

          <section aria-labelledby={`visit-contact-${locale}`} className="md:col-span-2 lg:col-span-3 lg:col-start-10">
            <h2 id={`visit-contact-${locale}`} className="eyebrow text-taupe-deep">{t.contact}</h2>
            <ul className="mt-5 space-y-4 text-[0.9375rem]">
              {contact.phoneHref && (
                <li>
                  <a href={contact.phoneHref} className="flex gap-3 hover:opacity-70">
                    <Phone aria-hidden className={iconClass} strokeWidth={1.5} />
                    <span>
                      <span className="sr-only">{t.call}: </span>
                      <span className="tabular">{contact.phoneDisplay}</span>
                    </span>
                  </a>
                </li>
              )}
              {contact.email && (
                <li>
                  <a href={`mailto:${contact.email}`} className="flex gap-3 break-all hover:opacity-70">
                    <Mail aria-hidden className={iconClass} strokeWidth={1.5} />
                    <span>
                      <span className="sr-only">{t.email}: </span>
                      {contact.email}
                    </span>
                  </a>
                </li>
              )}
            </ul>

            <h2 className="eyebrow mt-14 text-taupe-deep">{t.social}</h2>
            <SocialLinks socials={studio.socials} className="mt-5" />
          </section>
        </div>
      </Container>

      <BookingCta locale={locale} dict={dict} phoneHref={studio.contact.phoneHref} />
    </>
  );
}
