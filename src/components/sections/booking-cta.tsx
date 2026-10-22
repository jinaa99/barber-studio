import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { routes } from "@/lib/navigation";
import { ButtonLink, buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";

/**
 * Closing call to action shared by every public page: the dark bookend to
 * the hero. One large line, one primary action, the phone as the fallback.
 */
export function BookingCta({ locale, dict, phoneHref }: { locale: Locale; dict: Dictionary; phoneHref: string }) {
  const t = dict.home.finalCta;
  return (
    <section className="relative isolate overflow-hidden bg-ink text-canvas">
      {/* A low, off-centre glow so the block reads as lit, not flat. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_85%_100%,rgb(86_96_47/0.38),transparent_70%)]"
      />
      <Container className="py-section">
        <Reveal className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-8">
            <p className="eyebrow text-canvas/70">{t.eyebrow}</p>
            <h2 className="mt-6 text-display-lg text-balance">{t.title}</h2>
          </div>
          <div className="lg:col-span-4">
            <p className="max-w-sm text-lead text-canvas/70">{t.lead}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <ButtonLink href={localizedPath(locale, routes.booking)} variant="inverse" size="lg" arrow>
                {t.cta}
              </ButtonLink>
              {phoneHref && (
                <a href={phoneHref} className={buttonStyles({ variant: "inverse-outline", size: "lg" })}>
                  {t.secondary}
                </a>
              )}
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
