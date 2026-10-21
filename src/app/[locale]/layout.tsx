import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import { locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getStudioProfile } from "@/lib/data";
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
  const [dict, studio] = await Promise.all([getDictionary(), getStudioProfile()]);
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: { default: `${studio.name} — ${dict.meta.home}`, template: `%s — ${studio.name}` },
    description: dict.meta.siteDescription,
    applicationName: studio.name,
  };
}

export const viewport: Viewport = {
  themeColor: "#f3efe7",
  width: "device-width",
  initialScale: 1,
};

/** The document shell. The public site and the staff dashboard each add their own chrome. */
export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();

  return (
    <html lang={locale} id="top" className={`${manrope.variable} ${cormorant.variable}`}>
      <body className="flex min-h-dvh flex-col">{children}</body>
    </html>
  );
}
