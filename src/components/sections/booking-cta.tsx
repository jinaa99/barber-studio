import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { routes } from "@/lib/navigation";
import { ButtonLink, buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";

/** Closing call to action shared by every public page. */
export function BookingCta({ locale, dict, phoneHref }: { locale: Locale; dict: Dictionary; phoneHref: string }) {
  const t = dict.home.finalCta;
  return (
    <section className="border-b border-line-inverse bg-ink text-paper">
      <Container className="py-section">
        <Reveal className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <p className="eyebrow text-paper/55">{t.eyebrow}</p>
          <h2 className="mt-6 text-display-lg font-medium text-balance">
            <span className="font-display font-normal italic text-brass-soft">{t.title}</span>
          </h2>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-paper/65 sm:text-lg">{t.lead}</p>
          <div className="mt-10 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <ButtonLink href={localizedPath(locale, routes.booking)} variant="inverse" size="lg" arrow>
              {t.cta}
            </ButtonLink>
            {phoneHref && (
              <a href={phoneHref} className={buttonStyles({ variant: "inverse-outline", size: "lg" })}>
                {t.secondary}
              </a>
            )}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
