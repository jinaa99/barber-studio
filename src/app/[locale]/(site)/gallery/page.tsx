import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getGallery, getMediaCredits, getSiteDictionary, getStudioProfile } from "@/lib/data";
import { pageMetadata } from "@/lib/metadata";
import { routes } from "@/lib/navigation";
import { Container } from "@/components/ui/container";
import { PageIntro } from "@/components/sections/page-intro";
import { GalleryGrid } from "@/components/sections/gallery-grid";
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
        {items.length === 0 ? (
          <p className="border-t border-line py-16 text-center text-muted">{t.empty}</p>
        ) : (
          <GalleryGrid
            items={items}
            labels={{ filter: t.filterLabel, all: t.all, studio: t.studio, showing: t.showing }}
          />
        )}

        <section id="credits" aria-labelledby={`credits-title-${locale}`} className="mt-24 scroll-mt-28 border-t border-line-strong pt-8 sm:mt-32">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <h2 id={`credits-title-${locale}`} className="text-xl tracking-[-0.02em]">{t.creditsTitle}</h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">{t.creditsLead}</p>
            </div>
            <ul className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:col-span-8">
              {credits.map((c) => {
                const label = (
                  <>
                    {c.name ?? t.unnamed}
                    {(c.provider ?? c.license) && <span className="text-muted"> / {c.provider ?? c.license}</span>}
                  </>
                );
                return (
                  <li key={c.id} className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
                    <span className="shrink-0 text-muted">{c.kind === "footage" ? t.footage : t.photoBy}</span>
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="min-w-0 text-right break-words underline-offset-4 hover:underline">
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
