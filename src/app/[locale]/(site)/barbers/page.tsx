import type { Metadata } from "next";
import { localizedPath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getBarbers, getServices, getSiteDictionary, getStudioProfile } from "@/lib/data";
import { format } from "@/lib/format";
import { pageMetadata } from "@/lib/metadata";
import { routes } from "@/lib/navigation";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { DemoNotice } from "@/components/ui/demo-notice";
import { Reveal } from "@/components/ui/reveal";
import { Photo } from "@/components/media/photo";
import { PageIntro } from "@/components/sections/page-intro";
import { BookingCta } from "@/components/sections/booking-cta";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return pageMetadata({ locale, path: routes.barbers, title: dict.meta.barbers, description: dict.barbersPage.lead });
}

export default async function BarbersPage() {
  const locale = await getLocale();
  const [dict, barbers, services, studio] = await Promise.all([
    getSiteDictionary(locale),
    getBarbers(locale),
    getServices(locale),
    getStudioProfile(),
  ]);
  const t = dict.barbersPage;

  return (
    <>
      <PageIntro eyebrow={t.eyebrow} title={t.title} lead={t.lead}>
        {studio.isDemo && <DemoNotice className="mt-6">{t.demoNotice}</DemoNotice>}
      </PageIntro>

      {barbers.length > 1 && (
        <Container>
          <nav aria-label={t.eyebrow} className="flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-6 text-[0.9375rem] font-medium">
            {barbers.map((barber, i) => (
              <a key={barber.id} href={`#${barber.id}`} className="group inline-flex items-baseline gap-3">
                <span className="tabular text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
                <span className="link-draw">{barber.name}</span>
              </a>
            ))}
          </nav>
        </Container>
      )}

      <Container className="pb-section pt-14 sm:pt-20">
        <ol className="space-y-24 sm:space-y-36">
          {barbers.map((barber, i) => {
            const flipped = i % 2 === 1;
            const offered = services.filter((s) => barber.serviceIds.includes(s.id));
            return (
              <li key={barber.id} id={barber.id} className="grid scroll-mt-28 gap-10 md:grid-cols-12 md:gap-8">
                <Reveal
                  variant="mask"
                  className={cn("md:col-span-6 lg:col-span-5", flipped && "md:order-2 md:col-start-7 lg:col-start-8")}
                >
                  <Photo media={barber.image} ratio="4/5" sizes="(min-width: 1024px) 40vw, (min-width: 768px) 50vw, 100vw" />
                </Reveal>
                <Reveal
                  delay={120}
                  className={cn(
                    "flex flex-col justify-end md:col-span-6",
                    flipped ? "md:order-1 lg:col-span-6 lg:col-start-1" : "lg:col-span-6 lg:col-start-7",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-6 border-b border-line-strong pb-5">
                    <span className="tabular text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-sm text-muted">
                      <span className="numeric text-2xl font-medium text-ink">{barber.yearsExperience}</span> {dict.common.yearsExperience}
                    </span>
                  </div>
                  <h2 className="mt-8 text-display-lg">{barber.name}</h2>
                  <p className="mt-3 text-lead text-muted">{barber.role}</p>
                  <p className="mt-8 max-w-prose text-[1.0625rem] leading-relaxed">{barber.bio}</p>

                  <dl className="mt-10 grid gap-8 sm:grid-cols-2">
                    <div>
                      <dt className="eyebrow text-muted">{dict.common.specialties}</dt>
                      <dd className="mt-3">
                        <ul className="space-y-1.5 text-[0.9375rem]">
                          {barber.specialties.map((s) => (
                            <li key={s} className="flex items-baseline gap-2.5">
                              <span aria-hidden className="size-1 translate-y-[-0.2em] rounded-full bg-faint" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                    <div>
                      <dt className="eyebrow text-muted">{dict.nav.services}</dt>
                      <dd className="mt-3 text-[0.9375rem] leading-relaxed text-muted">{offered.map((s) => s.name).join(" · ")}</dd>
                    </div>
                  </dl>

                  <div className="mt-10">
                    <ButtonLink href={`${localizedPath(locale, routes.booking)}?barber=${barber.id}`} arrow>
                      {format(t.bookWith, { name: barber.name })}
                    </ButtonLink>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </Container>

      <BookingCta locale={locale} dict={dict} phoneHref={studio.contact.phoneHref} />
    </>
  );
}
