import { ArrowUpRight } from "lucide-react";
import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { Media } from "@/content/types";
import type { StudioProfile } from "@/lib/admin/content";
import { routes } from "@/lib/navigation";
import { ArrowLink, buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-heading";
import { Photo } from "@/components/media/photo";
import { OpeningHoursList } from "@/components/visit/opening-hours";
import { SocialLinks } from "@/components/visit/social-links";

/** Location block: the address set large, practical details beneath, and a tall photograph. */
export function VisitSummary({
  locale,
  dict,
  media,
  index,
  studio,
}: {
  locale: Locale;
  dict: Dictionary;
  media: Media;
  index?: string;
  studio: StudioProfile;
}) {
  const t = dict.home.visit;
  const v = dict.visitPage;
  const { contact } = studio;
  return (
    <section className="bg-surface py-section">
      <Container>
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-8">
          <Reveal className="flex flex-col lg:col-span-6">
            <SectionLabel index={index}>{t.eyebrow}</SectionLabel>
            <h2 className="mt-5 max-w-xl text-display-md text-balance">{t.title}</h2>

            <address className="mt-10 border-t border-line-strong pt-6 text-display-sm not-italic">
              {contact.address[locale]}
              <span className="block text-muted">{contact.city[locale]}</span>
            </address>
            {contact.mapsUrl && (
              <div className="mt-6">
                <a href={contact.mapsUrl} target="_blank" rel="noopener noreferrer" className={buttonStyles({ variant: "secondary", size: "sm" })}>
                  {v.openMaps}
                  <ArrowUpRight aria-hidden className="size-4" strokeWidth={1.75} />
                </a>
              </div>
            )}

            <div className="mt-12 grid gap-10 sm:grid-cols-2">
              <div>
                <h3 className="eyebrow text-muted">{v.hours}</h3>
                <OpeningHoursList dict={dict} hours={studio.hours} className="mt-2" />
              </div>
              <div className="space-y-8">
                <div>
                  <h3 className="eyebrow text-muted">{v.contact}</h3>
                  <p className="mt-3 text-[0.9375rem] leading-relaxed">
                    {contact.phoneHref && (
                      <a href={contact.phoneHref} className="tabular link-draw">
                        {contact.phoneDisplay}
                      </a>
                    )}
                    <br />
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="link-draw break-all">
                        {contact.email}
                      </a>
                    )}
                  </p>
                </div>
                <div>
                  <h3 className="eyebrow text-muted">{v.social}</h3>
                  <SocialLinks socials={studio.socials} className="mt-3" />
                </div>
              </div>
            </div>

            <div className="mt-12">
              <ArrowLink href={localizedPath(locale, routes.visit)}>{t.link}</ArrowLink>
            </div>
          </Reveal>

          <Reveal variant="mask" delay={120} className="lg:col-span-5 lg:col-start-8">
            <Photo media={media} ratio="3/4" sizes="(min-width: 1024px) 40vw, 100vw" className="lg:sticky lg:top-28" />
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
