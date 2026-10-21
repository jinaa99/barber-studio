import Link from "next/link";
import { ArrowUp } from "lucide-react";
import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { StudioProfile } from "@/lib/admin/content";
import { Container } from "@/components/ui/container";
import { DemoNotice } from "@/components/ui/demo-notice";
import { OpeningHoursList } from "@/components/visit/opening-hours";
import { SocialLinks } from "@/components/visit/social-links";
import { Wordmark } from "./wordmark";
import type { NavItem } from "./site-header";

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
  return (
    <footer className="bg-ink text-paper">
      <Container className="pb-10 pt-20 sm:pt-24">
        <div className="grid gap-14 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-4">
            <Link href={localizedPath(locale)} aria-label={studio.name}>
              <Wordmark className="text-lg" wordmark={studio.wordmark} />
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-paper/60">{t.tagline}</p>
          </div>

          <div className="md:col-span-2">
            <h2 className="eyebrow text-paper/45">{t.explore}</h2>
            <ul className="mt-5 space-y-3 text-sm">
              {items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-paper/80 transition-colors hover:text-paper">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <h2 className="eyebrow text-paper/45">{t.visit}</h2>
            <address className="mt-5 text-sm not-italic leading-relaxed text-paper/80">
              {studio.contact.address[locale]}
              <br />
              {studio.contact.city[locale]}
              <br />
              {studio.contact.phoneHref && (
                <a href={studio.contact.phoneHref} className="tabular mt-3 inline-block hover:text-paper">
                  {studio.contact.phoneDisplay}
                </a>
              )}
            </address>
            <OpeningHoursList dict={dict} hours={studio.hours} tone="inverse" compact className="mt-6" />
          </div>

          <div className="md:col-span-3">
            <h2 className="eyebrow text-paper/45">{t.follow}</h2>
            <SocialLinks socials={studio.socials} tone="inverse" className="mt-5" />
          </div>
        </div>

        <div className="mt-20 flex flex-col gap-6 border-t border-line-inverse pt-8 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            {studio.isDemo && <DemoNotice tone="inverse">{t.demoNotice}</DemoNotice>}
            <p className="text-xs text-paper/45">
              © {studio.name}. {t.rights}{" "}
              <Link href={`${localizedPath(locale, "/gallery")}#credits`} className="underline underline-offset-4 hover:text-paper">
                {t.credits}
              </Link>
            </p>
          </div>
          <a
            href="#top"
            className="inline-flex items-center gap-2 self-start text-xs font-semibold tracking-[0.14em] text-paper/60 uppercase hover:text-paper md:self-auto"
          >
            {t.backToTop}
            <ArrowUp aria-hidden className="size-3.5" strokeWidth={1.75} />
          </a>
        </div>
      </Container>
    </footer>
  );
}
