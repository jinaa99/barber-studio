import type { Locale } from "@/i18n/config";
import { heroClipRecords, mediaRecords } from "@/content/media";
import { serviceRecords } from "@/content/demo/services";
import { barberRecords } from "@/content/demo/barbers";
import { galleryRecords } from "@/content/demo/gallery";
import { testimonialRecords } from "@/content/demo/testimonials";
import type {
  Barber,
  GalleryItem,
  HeroClip,
  Media,
  Service,
  ServiceCategory,
  Testimonial,
} from "@/content/types";

/*
 * Data access layer. Pages and components only talk to these async functions,
 * never to the demo records directly, so Phase 03 can swap each body for a
 * database query without touching the UI.
 */

export const serviceCategoryOrder: ServiceCategory[] = ["haircut", "beard", "ritual"];

export const serviceCategoryLabels: Record<ServiceCategory, Record<Locale, string>> = {
  haircut: { mn: "Үс засалт", en: "Haircuts" },
  beard: { mn: "Сахал ба хусалт", en: "Beard & shave" },
  ritual: { mn: "Багц үйлчилгээ", en: "Combined services" },
};

export function getMedia(id: string, locale: Locale): Media {
  const record = mediaRecords.find((m) => m.id === id);
  if (!record) {
    return { id, src: null, alt: "" };
  }
  return { id: record.id, src: record.src, alt: record.alt[locale], credit: record.credit };
}

export async function getAllMedia(locale: Locale): Promise<Media[]> {
  return mediaRecords.map((m) => getMedia(m.id, locale));
}

/** The home hero clips, in scroll order. */
export async function getHeroClips(locale: Locale): Promise<HeroClip[]> {
  return heroClipRecords.map((c) => ({
    id: c.id,
    sources: c.sources,
    playback: c.playback,
    poster: c.poster,
    alt: c.alt[locale],
    focus: c.focus,
    credit: c.credit,
  }));
}

export async function getServices(locale: Locale): Promise<Service[]> {
  return serviceRecords.map((s) => ({
    id: s.id,
    category: s.category,
    name: s.name[locale],
    summary: s.summary[locale],
    includes: s.includes.map((i) => i[locale]),
    durationMinutes: s.durationMinutes,
    price: s.price,
    featured: s.featured,
  }));
}

export async function getFeaturedServices(locale: Locale): Promise<Service[]> {
  return (await getServices(locale)).filter((s) => s.featured);
}

export async function getBarbers(locale: Locale): Promise<Barber[]> {
  return barberRecords.map((b) => ({
    id: b.id,
    name: b.name[locale],
    role: b.role[locale],
    bio: b.bio[locale],
    specialties: b.specialties.map((s) => s[locale]),
    yearsExperience: b.yearsExperience,
    image: getMedia(b.imageId, locale),
    serviceIds: b.serviceIds,
    workingDays: b.workingDays,
  }));
}

/** All gallery items, or only `ids` in the order given. */
export async function getGallery(locale: Locale, ids?: string[]): Promise<GalleryItem[]> {
  const records = ids
    ? ids.flatMap((id) => galleryRecords.filter((g) => g.id === id))
    : galleryRecords;
  return records.map((g) => ({
    id: g.id,
    title: g.title[locale],
    image: getMedia(g.imageId, locale),
    barberName: barberRecords.find((b) => b.id === g.barberId)?.name[locale],
    layout: g.layout,
  }));
}

export async function getTestimonials(locale: Locale): Promise<Testimonial[]> {
  return testimonialRecords.map((t) => ({
    id: t.id,
    quote: t.quote[locale],
    attribution: t.attribution[locale],
    isSample: t.isSample,
  }));
}
