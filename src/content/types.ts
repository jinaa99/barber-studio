import type { StaticImageData } from "next/image";
import type { LocalizedText } from "@/i18n/config";

/*
 * Record types mirror what a database would store: localized fields keep
 * every language side by side. Data access functions in lib/data resolve them
 * into the flat, single-language view models below.
 */

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface MediaCredit {
  author: string;
  sourceUrl: string;
  license: "Unsplash License";
}

export interface MediaRecord {
  id: string;
  /** `null` renders the designed fallback frame instead of an image. */
  src: StaticImageData | null;
  alt: LocalizedText;
  credit?: MediaCredit;
}

export interface VideoCredit {
  /** Clip title as listed on the source page (Mixkit doesn't name its videographers). */
  title: string;
  sourceUrl: string;
  provider: "Mixkit";
  license: "Mixkit Stock Video Free License";
  licenseUrl: string;
  /** What was changed from the original download. */
  edits: string;
}

/** One stage of the home hero sequence, in scroll order. */
export type HeroClipId = "arrival" | "craft" | "detail" | "result";

export interface HeroClipRecord {
  id: HeroClipId;
  /** Muted, audio-free sources in /public. Empty renders the poster only. */
  sources: { src: string; type: "video/mp4" | "video/webm" }[];
  /** `scrub` follows the scroll position frame by frame; `loop` plays while its scene is on screen. */
  playback: "scrub" | "loop";
  /** Frame 0 of the clip, shown before the video loads and if it fails. */
  poster: StaticImageData | null;
  alt: LocalizedText;
  /** `object-position` for landscape and portrait screens. */
  focus: { landscape: string; portrait: string };
  credit?: VideoCredit;
}

/** Category id (a slug from the `service_categories` table, e.g. "haircut"). */
export type ServiceCategory = string;

export interface ServiceCategoryView {
  id: ServiceCategory;
  name: string;
}

export interface ServiceRecord {
  id: string;
  category: ServiceCategory;
  name: LocalizedText;
  summary: LocalizedText;
  includes: LocalizedText[];
  durationMinutes: number;
  /** Whole tögrög (MNT). */
  price: number;
  featured: boolean;
}

export interface BarberRecord {
  id: string;
  name: LocalizedText;
  role: LocalizedText;
  bio: LocalizedText;
  specialties: LocalizedText[];
  yearsExperience: number;
  imageId: string;
  serviceIds: string[];
  workingDays: Weekday[];
}

export interface GalleryRecord {
  id: string;
  title: LocalizedText;
  imageId: string;
  barberId?: string;
  serviceId?: string;
  layout: "portrait" | "landscape";
}

export interface TestimonialRecord {
  id: string;
  quote: LocalizedText;
  attribution: LocalizedText;
  /** Always true until replaced with verified reviews. */
  isSample: boolean;
}

/* ---------- Resolved, single-language view models ---------- */

export interface Media {
  id: string;
  src: StaticImageData | null;
  alt: string;
  credit?: MediaCredit;
}

export interface HeroClip {
  id: HeroClipId;
  sources: HeroClipRecord["sources"];
  playback: HeroClipRecord["playback"];
  poster: StaticImageData | null;
  alt: string;
  focus: HeroClipRecord["focus"];
  credit?: VideoCredit;
}

export interface Service {
  id: string;
  category: ServiceCategory;
  name: string;
  summary: string;
  includes: string[];
  durationMinutes: number;
  price: number;
  featured: boolean;
}

export interface Barber {
  id: string;
  name: string;
  role: string;
  bio: string;
  specialties: string[];
  yearsExperience: number;
  image: Media;
  serviceIds: string[];
  workingDays: Weekday[];
  /** Working blocks; weekday 0 = Sunday, minutes after midnight in the studio zone. */
  workingHours: { weekday: number; startMinute: number; endMinute: number }[];
}

export interface GalleryItem {
  id: string;
  title: string;
  image: Media;
  barberName?: string;
  layout: GalleryRecord["layout"];
}

export interface Testimonial {
  id: string;
  quote: string;
  attribution: string;
  isSample: boolean;
}
