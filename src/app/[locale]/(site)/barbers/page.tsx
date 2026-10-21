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
        {studio.isDemo && <DemoNotice className="mt-8 max-w-2xl">{t.demoNotice}</DemoNotice>}
      </PageIntro>

      <Container className="pb-section">
        <ol className="space-y-24 sm:space-y-36">
          {barbers.map((barber, i) => {
            const flipped = i % 2 === 1;
            const offered = services.filter((s) => barber.serviceIds.includes(s.id));
            return (
              <li key={barber.id} id={barber.id} className="grid scroll-mt-28 gap-10 md:grid-cols-12 md:gap-8">
                <Reveal className={cn("md:col-span-6 lg:col-span-5", flipped && "md:order-2 md:col-start-7 lg:col-start-8")}>
                  <Photo media={barber.image} ratio="4/5" sizes="(min-width: 1024px) 40vw, (min-width: 768px) 50vw, 100vw" />
                </Reveal>
                <Reveal
                  delay={120}
                  className={cn(
                    "flex flex-col justify-end md:col-span-6",
                    flipped ? "md:order-1 lg:col-span-5 lg:col-start-1" : "lg:col-span-6 lg:col-start-7",
                  )}
                >
                  <span className="tabular text-xs font-semibold text-brass">{String(i + 1).padStart(2, "0")}</span>
                  <h2 className="mt-4 text-display-md font-medium">{barber.name}</h2>
                  <p className="mt-2 text-taupe-deep">{barber.role}</p>
                  <p className="mt-8 max-w-prose text-base leading-relaxed sm:text-lg">{barber.bio}</p>

                  <dl className="mt-10 grid gap-8 border-t border-line-strong pt-8 sm:grid-cols-2">
                    <div>
                      <dt className="eyebrow text-taupe-deep">{dict.common.specialties}</dt>
                      <dd className="mt-3">
                        <ul className="space-y-1.5 text-[0.9375rem]">
                          {barber.specialties.map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                    <div>
                      <dt className="eyebrow text-taupe-deep">{dict.nav.services}</dt>
                      <dd className="mt-3 text-[0.9375rem] leading-relaxed text-taupe-deep">
                        {offered.map((s) => s.name).join(" · ")}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
                    <ButtonLink href={`${localizedPath(locale, routes.booking)}?barber=${barber.id}`} arrow>
                      {format(t.bookWith, { name: barber.name })}
                    </ButtonLink>
                    <span className="tabular text-sm text-taupe-deep">
                      {barber.yearsExperience} {dict.common.yearsExperience}
                    </span>
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
