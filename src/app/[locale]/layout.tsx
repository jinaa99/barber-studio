import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { site } from "@/content/site";
import { getNavItems } from "@/lib/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import "../globals.css";

// Both families ship Cyrillic Extended, which covers Mongolian Ө ө Ү ү.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: { default: `${site.brand.name} — ${dict.meta.home}`, template: `%s — ${site.brand.name}` },
    description: dict.meta.siteDescription,
    applicationName: site.brand.name,
  };
}

export const viewport: Viewport = {
  themeColor: "#f3efe7",
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const navItems = getNavItems(locale, dict);

  return (
    <html lang={locale} id="top" className={`${manrope.variable} ${cormorant.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <SiteHeader locale={locale} labels={dict.nav} items={navItems} />
        <main id={`main-${locale}`} className="flex-1">
          {children}
        </main>
        <SiteFooter locale={locale} dict={dict} items={navItems} />
      </body>
    </html>
  );
}
