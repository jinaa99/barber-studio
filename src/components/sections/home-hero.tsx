import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { HeroClip } from "@/content/types";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { routes } from "@/lib/navigation";
import { format } from "@/lib/format";
import { HeroSequence } from "./hero-sequence";

/**
 * Home hero: a scroll-controlled walk from the studio door to a finished cut.
 * The intro copy and booking links render on the server and are usable
 * before any footage or script loads; `HeroSequence` adds the motion.
 */
export function HomeHero({
  locale,
  dict,
  clips,
  afterId,
}: {
  locale: Locale;
  dict: Dictionary;
  clips: HeroClip[];
  afterId: string;
}) {
  const t = dict.home.hero;
  // Name the stock libraries in use; other licensed media gets a general note, the studio's own none.
  const stock = clips.flatMap((c) => (c.credit?.stock ? [c.credit] : []));
  const providers = [...new Set(stock.flatMap((c) => (c.provider ? [c.provider] : [])))];
  const footageNote = providers.length > 0 ? format(t.footageNote, { providers: providers.join(", ") }) : stock.length > 0 ? t.footageNoteLicensed : "";
  return (
    <HeroSequence
      clips={clips}
      captions={t.scenes}
      skipLabel={t.skipIntro}
      footageNote={footageNote}
      afterId={afterId}
      intro={
        <Container className="pb-10 pt-[calc(var(--spacing-header)+3rem)] sm:pb-14">
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
      }
      finale={
        <ButtonLink href={localizedPath(locale, routes.booking)} variant="inverse" size="lg" arrow>
          {t.primaryCta}
        </ButtonLink>
      }
    />
  );
}
