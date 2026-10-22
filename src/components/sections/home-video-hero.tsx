import Link from "next/link";
import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ScrollVideoHero, type ScrollVideoSource } from "@/components/hero-video/scroll-video-hero";
import { routes } from "@/lib/navigation";
import firstFrame from "@/assets/media/hero-video-first.jpg";
import stillFrame from "@/assets/media/hero-video-still.jpg";

/** Generated test footage (docs/MEDIA.md). Add `portraitSrc` once a vertical cut exists. */
const video: ScrollVideoSource = { src: "/media/hero-scroll-test.mp4", fps: 24 };

/*
 * The source is 16:9. Landscape screens crop little, so the centre holds.
 * Portrait screens see about a quarter of the width, so the crop follows the
 * action: the door, then the barber (right of centre), then the clipper.
 */
const focus = {
  landscape: { x: 0.5, y: 0.5 },
  portrait: [
    { at: 0, x: 0.3, y: 0.5 },
    { at: 0.3, x: 0.62, y: 0.5 },
    { at: 0.45, x: 0.56, y: 0.5 },
    { at: 0.62, x: 0.7, y: 0.45 },
    { at: 0.72, x: 0.62, y: 0.5 },
    { at: 1, x: 0.7, y: 0.5 },
  ],
};

/** Home hero, video version: copy and booking links are server-rendered; the client scrubs the footage. */
export function HomeVideoHero({ locale, dict, afterId }: { locale: Locale; dict: Dictionary; afterId: string }) {
  const t = dict.home.hero;
  const v = dict.home.videoHero;
  const book = localizedPath(locale, routes.booking);
  return (
    <ScrollVideoHero
      video={video}
      poster={firstFrame}
      still={stillFrame}
      posterAlt={v.posterAlt}
      stillAlt={v.stillAlt}
      focus={focus}
      scrollHint={v.scrollHint}
      skipLabel={t.skipIntro}
      afterId={afterId}
      footer={<p>{v.note}</p>}
      bookCta={
        <Link href={book} className="link-draw text-[0.8125rem] font-medium text-canvas">
          {v.bookShort}
        </Link>
      }
      intro={
        <Container>
          <div className="max-w-xl">
            <p className="eyebrow flex items-center gap-2.5 text-canvas/80">
              <span aria-hidden className="size-1.5 rounded-full bg-accent-soft" />
              {t.eyebrow}
            </p>
            <h1 className="mt-5 text-display-lg text-balance">{v.title}</h1>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
    />
  );
}
