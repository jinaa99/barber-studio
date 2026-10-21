import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { Media } from "@/content/types";
import { site } from "@/content/site";
import { routes } from "@/lib/navigation";
import { ArrowLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { Photo } from "@/components/media/photo";
import { OpeningHoursList } from "@/components/visit/opening-hours";
import { SocialLinks } from "@/components/visit/social-links";

export function VisitSummary({
  locale,
  dict,
  media,
  index,
}: {
  locale: Locale;
  dict: Dictionary;
  media: Media;
  index?: string;
}) {
  const t = dict.home.visit;
  const v = dict.visitPage;
  return (
    <section className="bg-paper-deep py-section">
      <Container>
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-8">
          <Reveal className="lg:col-span-6">
            <Photo media={media} ratio="4/5" sizes="(min-width: 1024px) 45vw, 100vw" className="max-h-[42rem]" />
          </Reveal>

          <Reveal delay={120} className="flex flex-col lg:col-span-5 lg:col-start-8">
            <p className="eyebrow flex items-center gap-3 text-taupe-deep">
              {index && <span className="tabular text-brass">{index}</span>}
              {index && <span aria-hidden className="h-px w-8 bg-current opacity-40" />}
              {t.eyebrow}
            </p>
            <h2 className="mt-5 text-display-md font-medium text-balance">{t.title}</h2>

            <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div>
                <h3 className="eyebrow text-taupe-deep">{v.address}</h3>
                <address className="mt-4 text-[0.9375rem] not-italic leading-relaxed">
                  {site.contact.address[locale]}
                  <br />
                  {site.contact.city[locale]}
                </address>
                <h3 className="eyebrow mt-8 text-taupe-deep">{v.contact}</h3>
                <p className="mt-4 text-[0.9375rem] leading-relaxed">
                  <a href={site.contact.phoneHref} className="tabular hover:opacity-70">
                    {site.contact.phoneDisplay}
                  </a>
                  <br />
                  <a href={`mailto:${site.contact.email}`} className="hover:opacity-70">
                    {site.contact.email}
                  </a>
                </p>
                <h3 className="eyebrow mt-8 text-taupe-deep">{v.social}</h3>
                <SocialLinks className="mt-4 max-w-60" />
              </div>
              <div>
                <h3 className="eyebrow text-taupe-deep">{v.hours}</h3>
                <OpeningHoursList dict={dict} className="mt-2" />
              </div>
            </div>

            <div className="mt-auto pt-12">
              <ArrowLink href={localizedPath(locale, routes.visit)}>{t.link}</ArrowLink>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
