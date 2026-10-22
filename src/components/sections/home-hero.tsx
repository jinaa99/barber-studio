import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { StudioProfile } from "@/lib/admin/content";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { HeroStage } from "@/components/hero3d/hero-stage";
import { routes } from "@/lib/navigation";
import storefrontEn from "@/assets/media/hero-storefront-en.jpg";
import storefrontMn from "@/assets/media/hero-storefront-mn.jpg";
import storefrontPortraitEn from "@/assets/media/hero-storefront-portrait-en.jpg";
import storefrontPortraitMn from "@/assets/media/hero-storefront-portrait-mn.jpg";

/** Frame one of the scene, rendered per language because the signage is localized. */
const posters = {
  mn: { landscape: storefrontMn, portrait: storefrontPortraitMn },
  en: { landscape: storefrontEn, portrait: storefrontPortraitEn },
} satisfies Record<Locale, unknown>;

/**
 * Home hero: a scroll-directed 3D walk from the pavement outside the studio,
 * through its door, to a haircut in close-up. The copy and booking links are
 * server-rendered and work before (or without) the scene; `HeroStage` adds
 * the walk-through where the device and the visitor's settings allow it.
 */
export function HomeHero({
  locale,
  dict,
  studio,
  afterId,
}: {
  locale: Locale;
  dict: Dictionary;
  studio: StudioProfile;
  afterId: string;
}) {
  const t = dict.home.hero;
  const book = localizedPath(locale, routes.booking);
  return (
    <HeroStage
      poster={posters[locale].landscape}
      posterPortrait={posters[locale].portrait}
      posterAlt={t.posterAlt}
      labels={{ wordmark: studio.wordmark, signLine: t.signLine, windowLines: [studio.name, t.windowLine] }}
      sceneNote={t.sceneNote}
      skipLabel={t.skipIntro}
      afterId={afterId}
      intro={
        <Container>
          <div className="max-w-lg">
            <p className="eyebrow flex items-center gap-2.5 text-canvas/80">
              <span aria-hidden className="size-1.5 rounded-full bg-accent-soft" />
              {t.eyebrow}
            </p>
            <h1 className="mt-5 text-display-md text-balance">
              <span className="block">{t.titleLead}</span>
              <span className="block text-canvas/60">{t.titleAccent}</span>
            </h1>
            <p className="mt-5 max-w-md text-lead text-canvas/80">{t.lead}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={book} variant="inverse" size="lg" arrow>
                {t.primaryCta}
              </ButtonLink>
              <ButtonLink href={localizedPath(locale, routes.services)} variant="inverse-outline" size="lg">
                {t.secondaryCta}
              </ButtonLink>
            </div>
          </div>
        </Container>
      }
      finale={
        <Container>
          <div className="max-w-md">
            <p className="text-display-md text-balance">{t.finaleTitle}</p>
            <div className="mt-7">
              <ButtonLink href={book} variant="inverse" size="lg" arrow>
                {t.primaryCta}
              </ButtonLink>
            </div>
          </div>
        </Container>
      }
    />
  );
}
