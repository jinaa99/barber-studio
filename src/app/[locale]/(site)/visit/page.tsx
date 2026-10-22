import type { Metadata } from "next";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getSiteDictionary, getSlotMedia, getStudioProfile } from "@/lib/data";
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
  const [dict, studio, cover] = await Promise.all([getSiteDictionary(locale), getStudioProfile(), getSlotMedia("visit.cover", locale)]);
  const t = dict.visitPage;
  const { contact } = studio;
  const iconClass = "mt-0.5 size-4 shrink-0 text-faint";

  return (
    <>
      <PageIntro eyebrow={t.eyebrow} title={t.title} lead={t.lead}>
        {studio.isDemo && <DemoNotice className="mt-6">{t.demoNotice}</DemoNotice>}
      </PageIntro>

      <Container>
        <Reveal variant="mask">
          <Photo media={cover} ratio="4/5" className="sm:aspect-[16/10] lg:aspect-[21/9]" sizes="(min-width: 1472px) 1376px, 100vw" />
        </Reveal>
      </Container>

      <Container className="pb-section pt-14 sm:pt-20">
        <div className="grid gap-14 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <section aria-labelledby={`visit-address-${locale}`} className="md:col-span-2 lg:col-span-5">
            <h2 id={`visit-address-${locale}`} className="eyebrow text-muted">{t.address}</h2>
            <address className="mt-5 text-display-sm not-italic">
              {contact.address[locale]}
              <span className="block text-muted">{contact.city[locale]}</span>
            </address>
            {contact.mapsUrl && (
              <a
                href={contact.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonStyles({ variant: "secondary", className: "mt-8" })}
              >
                <MapPin aria-hidden className="size-4" strokeWidth={1.5} />
                {t.openMaps}
                <ArrowUpRight aria-hidden className="size-4" strokeWidth={1.75} />
              </a>
            )}

            {contact.directions[locale] && (
              <div className="mt-12 max-w-md border-t border-line pt-6">
                <h3 className="eyebrow text-muted">{t.directionsTitle}</h3>
                <p className="mt-3 text-[1.0625rem] leading-relaxed">{contact.directions[locale]}</p>
              </div>
            )}
          </section>

          <section aria-labelledby={`visit-hours-${locale}`} className="lg:col-span-3 lg:col-start-7">
            <h2 id={`visit-hours-${locale}`} className="eyebrow text-muted">{t.hours}</h2>
            <OpeningHoursList dict={dict} hours={studio.hours} className="mt-3 border-t border-line-strong text-[0.9375rem]" />
          </section>

          <section aria-labelledby={`visit-contact-${locale}`} className="lg:col-span-3 lg:col-start-10">
            <h2 id={`visit-contact-${locale}`} className="eyebrow text-muted">{t.contact}</h2>
            <ul className="mt-5 space-y-4 text-[0.9375rem]">
              {contact.phoneHref && (
                <li>
                  <a href={contact.phoneHref} className="group flex gap-3">
                    <Phone aria-hidden className={iconClass} strokeWidth={1.5} />
                    <span>
                      <span className="sr-only">{t.call}: </span>
                      <span className="tabular link-draw">{contact.phoneDisplay}</span>
                    </span>
                  </a>
                </li>
              )}
              {contact.email && (
                <li>
                  <a href={`mailto:${contact.email}`} className="group flex gap-3 break-all">
                    <Mail aria-hidden className={iconClass} strokeWidth={1.5} />
                    <span>
                      <span className="sr-only">{t.email}: </span>
                      <span className="link-draw">{contact.email}</span>
                    </span>
                  </a>
                </li>
              )}
            </ul>

            <h2 className="eyebrow mt-12 text-muted">{t.social}</h2>
            <SocialLinks socials={studio.socials} className="mt-5" />
          </section>
        </div>
      </Container>

      <BookingCta locale={locale} dict={dict} phoneHref={studio.contact.phoneHref} />
    </>
  );
}
