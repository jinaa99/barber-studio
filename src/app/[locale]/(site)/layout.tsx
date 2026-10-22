import { ViewTransition } from "react";
import { localizedPath } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getStudioProfile } from "@/lib/data";
import { getNavItems } from "@/lib/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteStrings } from "@/components/layout/site-strings";

/**
 * Public pages: site header, main landmark and footer. Route changes
 * crossfade through a view transition (the `page` class in globals.css)
 * where the browser supports it.
 */
export default async function SiteLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  const [dict, studio] = await Promise.all([getDictionary(locale), getStudioProfile()]);
  const navItems = getNavItems(locale, dict);

  return (
    <SiteStrings value={{ errorPage: dict.errorPage, homeHref: localizedPath(locale) }}>
      <SiteHeader
        locale={locale}
        labels={dict.nav}
        items={navItems}
        studio={{ name: studio.name, wordmark: studio.wordmark, phoneDisplay: studio.contact.phoneDisplay, phoneHref: studio.contact.phoneHref }}
      />
      <main id={`main-${locale}`} className="flex-1">
        <ViewTransition default="page">{children}</ViewTransition>
      </main>
      <SiteFooter locale={locale} dict={dict} items={navItems} studio={studio} />
    </SiteStrings>
  );
}
