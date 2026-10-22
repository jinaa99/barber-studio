import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getStudioProfile } from "@/lib/data";
import { siteOrigin } from "@/lib/metadata";
import "../globals.css";

// One variable family for both languages. Cyrillic Extended covers Mongolian Ө ө Ү ү.
const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  display: "swap",
});

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const [dict, studio] = await Promise.all([getDictionary(), getStudioProfile()]);
  return {
    metadataBase: siteOrigin(),
    title: { default: `${studio.name} — ${dict.meta.home}`, template: `%s — ${studio.name}` },
    description: dict.meta.siteDescription,
    applicationName: studio.name,
  };
}

export const viewport: Viewport = {
  themeColor: "#f4f4f1",
  width: "device-width",
  initialScale: 1,
};

/** The document shell. The public site and the staff dashboard each add their own chrome. */
export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();

  return (
    <html lang={locale} id="top" className={onest.variable}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
