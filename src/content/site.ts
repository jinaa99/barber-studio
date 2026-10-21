import type { LocalizedText } from "@/i18n/config";
import type { Weekday } from "./types";

/**
 * Brand identity and business details. This is the one file to edit when the
 * template is customised for a real studio. While `isDemo` is true the UI
 * marks placeholder details as demo content.
 */
export const site = {
  isDemo: true,
  brand: {
    name: "STUDIO / 08",
    /** Split for the wordmark: "STUDIO" + "08". */
    wordmark: { primary: "STUDIO", secondary: "08" },
  },
  contact: {
    // Placeholder details — not a real address or phone line.
    address: {
      mn: "Демо гудамж 8, Сүхбаатар дүүрэг",
      en: "8 Demo Street, Sükhbaatar District",
    } satisfies LocalizedText,
    city: { mn: "Улаанбаатар, Монгол", en: "Ulaanbaatar, Mongolia" } satisfies LocalizedText,
    directions: {
      mn: "Сүхбаатарын талбайгаас явганаар 8 минут. Барилгын арын хаалгаар орж, хоёрдугаар давхарт гарна.",
      en: "An eight-minute walk from Sükhbaatar Square. Enter through the rear courtyard door and take the stairs to the second floor.",
    } satisfies LocalizedText,
    phoneDisplay: "+976 0000 0808",
    phoneHref: "tel:+97600000808",
    email: "hello@studio08.example",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Sukhbaatar+Square+Ulaanbaatar",
  },
  hours: [
    { day: "mon", open: null, close: null },
    { day: "tue", open: "10:00", close: "20:00" },
    { day: "wed", open: "10:00", close: "20:00" },
    { day: "thu", open: "10:00", close: "20:00" },
    { day: "fri", open: "10:00", close: "20:00" },
    { day: "sat", open: "10:00", close: "18:00" },
    { day: "sun", open: "11:00", close: "17:00" },
  ] satisfies OpeningHours[],
  socials: [
    // Placeholder handles: rendered without links while the site is a demo.
    { label: "Instagram", handle: "@studio08.demo", href: null },
    { label: "Facebook", handle: "STUDIO / 08", href: null },
  ] satisfies SocialLink[],
  booking: {
    slotIntervalMinutes: 30,
    daysAhead: 14,
  },
};

export interface OpeningHours {
  day: Weekday;
  open: string | null;
  close: string | null;
}

export interface SocialLink {
  label: string;
  handle: string;
  href: string | null;
}
