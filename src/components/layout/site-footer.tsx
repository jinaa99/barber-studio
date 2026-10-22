import Link from "next/link";
import { ArrowUp } from "lucide-react";
import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { StudioProfile } from "@/lib/admin/content";
import { Container } from "@/components/ui/container";
import { DemoNotice } from "@/components/ui/demo-notice";
import { OpeningHoursList } from "@/components/visit/opening-hours";
import { SocialLinks } from "@/components/visit/social-links";
import type { NavItem } from "./site-header";

/**
 * Quiet light footer under the dark booking call to action: four short
 * columns, the legal line, and the wordmark set large as a sign-off.
 */
export function SiteFooter({
  locale,
  dict,
  items,
  studio,
}: {
  locale: Locale;
  dict: Dictionary;
  items: NavItem[];
  studio: StudioProfile;
}) {
  const t = dict.footer;
  const { primary, secondary } = studio.wordmark;
  return (
    <footer className="overflow-hidden bg-canvas text-ink">
      <Container className="pt-16 sm:pt-20">
        <div className="grid gap-12 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-5 lg:col-span-4">
            <p className="max-w-sm text-display-sm text-balance">{t.tagline}</p>
          </div>

          <div className="md:col-span-2 lg:col-start-6">
            <h2 className="eyebrow text-muted">{t.explore}</h2>
            <ul className="mt-5 space-y-2.5 text-[0.9375rem]">
              {items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="link-draw">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <h2 className="eyebrow text-muted">{t.visit}</h2>
            <address className="mt-5 text-[0.9375rem] not-italic leading-relaxed">
              {studio.contact.address[locale]}
              <br />
              {studio.contact.city[locale]}
              <br />
              {studio.contact.phoneHref && (
                <a href={studio.contact.phoneHref} className="tabular link-draw mt-3 inline-block">
                  {studio.contact.phoneDisplay}
                </a>
              )}
            </address>
            <OpeningHoursList dict={dict} hours={studio.hours} compact className="mt-6 max-w-64" />
          </div>

          <div className="md:col-span-2">
            <h2 className="eyebrow text-muted">{t.follow}</h2>
            <SocialLinks socials={studio.socials} className="mt-5" />
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-6 border-t border-line pt-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            {studio.isDemo && <DemoNotice>{t.demoNotice}</DemoNotice>}
            <p className="text-[0.8125rem] text-muted">
              © {studio.name}. {t.rights}{" "}
              <Link href={`${localizedPath(locale, "/gallery")}#credits`} className="underline underline-offset-4 hover:text-ink">
                {t.credits}
              </Link>
            </p>
          </div>
          <a
            href="#top"
            className="group inline-flex items-center gap-2 self-start text-[0.8125rem] font-medium text-muted transition-colors hover:text-ink md:self-auto"
          >
            {t.backToTop}
            <ArrowUp aria-hidden className="size-3.5 transition-transform duration-300 ease-emphasis group-hover:-translate-y-0.5" strokeWidth={1.75} />
          </a>
        </div>
      </Container>

      {/* The sign-off: the studio's own name, set large and cropped by the page edge. */}
      <Container aria-hidden className="select-none">
        <p className="-mb-[0.18em] mt-10 whitespace-nowrap text-[clamp(4.5rem,15.5vw,15rem)] font-semibold leading-none tracking-[-0.065em] text-ink">
          {primary}
          {secondary && <span className="tabular text-stone-deep"> /{secondary}</span>}
        </p>
      </Container>
    </footer>
  );
}
