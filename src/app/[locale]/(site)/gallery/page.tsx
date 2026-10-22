import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getGallery, getMediaCredits, getSiteDictionary, getStudioProfile } from "@/lib/data";
import { pageMetadata } from "@/lib/metadata";
import { routes } from "@/lib/navigation";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { Photo } from "@/components/media/photo";
import { PageIntro } from "@/components/sections/page-intro";
import { BookingCta } from "@/components/sections/booking-cta";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return pageMetadata({ locale, path: routes.gallery, title: dict.meta.gallery, description: dict.galleryPage.lead });
}

export default async function GalleryPage() {
  const locale = await getLocale();
  const [dict, items, credits, studio] = await Promise.all([
    getSiteDictionary(locale),
    getGallery(locale),
    getMediaCredits(locale),
    getStudioProfile(),
  ]);
  const t = dict.galleryPage;

  return (
    <>
      <PageIntro eyebrow={t.eyebrow} title={t.title} lead={t.lead} />

      <Container className="pb-section">
        {/* Masonry via CSS columns keeps each photo near its natural ratio. */}
        <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>li]:mb-10 [&>li]:break-inside-avoid">
          {items.map((item, i) => (
            <Reveal as="li" key={item.id} delay={(i % 3) * 80}>
              <figure>
                <Photo
                  media={item.image}
                  ratio={item.layout === "landscape" ? "3/2" : "4/5"}
                  sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
                />
                <figcaption className="mt-3 flex items-baseline justify-between gap-4 text-sm">
                  <span className="font-medium">{item.title}</span>
                  {item.barberName && <span className="text-taupe-deep">{item.barberName}</span>}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>

        <section id="credits" aria-labelledby={`credits-title-${locale}`} className="mt-24 scroll-mt-28 border-t border-line-strong pt-10 sm:mt-32">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 id={`credits-title-${locale}`} className="eyebrow text-taupe-deep">{t.creditsTitle}</h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-taupe-deep">{t.creditsLead}</p>
            </div>
            <ul className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:col-span-8">
              {credits.map((c) => {
                const label = (
                  <>
                    {c.name ?? t.unnamed}
                    {(c.provider ?? c.license) && <span className="text-taupe-deep"> / {c.provider ?? c.license}</span>}
                  </>
                );
                return (
                  <li key={c.id} className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
                    <span className="shrink-0 text-taupe-deep">{c.kind === "footage" ? t.footage : t.photoBy}</span>
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="min-w-0 text-right break-words hover:opacity-70">
                        {label}
                      </a>
                    ) : (
                      <span className="min-w-0 text-right break-words">{label}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </Container>

      <BookingCta locale={locale} dict={dict} phoneHref={studio.contact.phoneHref} />
    </>
  );
}
