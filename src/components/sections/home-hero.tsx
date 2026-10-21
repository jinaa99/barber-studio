import Image from "next/image";
import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { Media } from "@/content/types";
import { heroVideo } from "@/content/media";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { PhotoFallback } from "@/components/media/photo";
import { routes } from "@/lib/navigation";

/**
 * Full-bleed cinematic hero. Phase 01 uses a still (or an optional muted
 * loop) with a slow settle-in zoom; the scroll-controlled sequence is Phase 02.
 */
export function HomeHero({ locale, dict, media }: { locale: Locale; dict: Dictionary; media: Media }) {
  const t = dict.home.hero;
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ink text-paper">
      <div className="absolute inset-0 -z-10">
        {heroVideo ? (
          <video
            className="motion-safe-zoom h-full w-full animate-slow-zoom object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={media.src?.src}
            aria-hidden
          >
            <source src={heroVideo.src} type={heroVideo.type} />
          </video>
        ) : media.src ? (
          <Image
            src={media.src}
            alt={media.alt}
            fill
            sizes="100vw"
            placeholder="blur"
            loading="eager"
            fetchPriority="high"
            className="motion-safe-zoom animate-slow-zoom object-cover object-[70%_40%]"
          />
        ) : (
          <PhotoFallback />
        )}
        {/* Legibility scrims: a soft vignette plus a deeper floor for the copy. */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(22_21_19/0.72)_0%,rgb(22_21_19/0.25)_55%,rgb(22_21_19/0.1)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-[linear-gradient(0deg,rgb(22_21_19/0.85),transparent)]" />
      </div>

      <Container className="flex flex-1 flex-col justify-end pb-10 pt-[calc(var(--spacing-header)+3rem)] sm:pb-14">
        <p className="eyebrow text-paper/70">{t.eyebrow}</p>
        <h1 className="mt-6 max-w-5xl text-display-xl font-medium">
          <span className="block">{t.titleLead}</span>
          <span className="block font-display font-normal italic tracking-[-0.02em] text-brass-soft">
            {t.titleAccent}
          </span>
        </h1>
        <p className="mt-7 max-w-xl text-base leading-relaxed text-paper/75 sm:text-lg">{t.lead}</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={localizedPath(locale, routes.booking)} variant="inverse" size="lg" arrow>
            {t.primaryCta}
          </ButtonLink>
          <ButtonLink href={localizedPath(locale, routes.services)} variant="inverse-outline" size="lg">
            {t.secondaryCta}
          </ButtonLink>
        </div>

        <div className="mt-14 hidden items-center gap-4 text-paper/55 sm:flex">
          <span aria-hidden className="relative h-10 w-px overflow-hidden bg-paper/20">
            <span className="absolute inset-x-0 top-0 h-1/2 animate-[scroll-cue_2.4s_var(--ease-soft)_infinite] bg-paper motion-reduce:animate-none" />
          </span>
          <span className="eyebrow">{t.scroll}</span>
        </div>
      </Container>
    </section>
  );
}
