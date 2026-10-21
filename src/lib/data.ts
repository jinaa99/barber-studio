import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Locale, LocalizedText } from "@/i18n/config";
import { heroClipRecords, mediaRecords } from "@/content/media";
import { galleryRecords } from "@/content/demo/gallery";
import { db } from "@/lib/server/db";
import { getBookingRules } from "@/lib/server/settings";
import type { BookingConfig } from "@/lib/booking/types";
import type {
  Barber,
  GalleryItem,
  HeroClip,
  Media,
  Service,
  ServiceCategory,
  Testimonial,
  Weekday,
} from "@/content/types";

/*
 * Data access layer. Pages and components only talk to these async functions.
 * Services, barbers, schedules, reviews and booking settings come from
 * PostgreSQL; images, hero clips and the gallery ship with the app.
 *
 * Database reads are cached (`use cache`) so public pages still prerender,
 * and tagged so staff changes show up at once: call `updateTag(catalogTag)`
 * after changing services, barbers, hours or reviews, and
 * `updateTag(settingsTag)` after changing business settings.
 */

export const catalogTag = "catalog";
export const settingsTag = "settings";

const weekdayNames: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** JSON columns hold LocalizedText (or arrays of it); this narrows them. */
const text = (value: unknown, locale: Locale) => (value as LocalizedText)[locale];
const texts = (value: unknown, locale: Locale) => (value as LocalizedText[]).map((v) => v[locale]);

async function loadServices() {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogTag);
  return db.service.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      category: true,
      name: true,
      summary: true,
      includes: true,
      durationMinutes: true,
      priceMnt: true,
      featured: true,
    },
  });
}

async function loadBarbers() {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogTag);
  return db.barber.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      role: true,
      bio: true,
      specialties: true,
      yearsExperience: true,
      imageId: true,
      services: { where: { service: { active: true } }, select: { serviceId: true } },
      workingHours: {
        orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
        select: { weekday: true, startMinute: true, endMinute: true },
      },
    },
  });
}

async function loadReviews() {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogTag);
  return db.review.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 6,
    select: { id: true, quote: true, attribution: true, isSample: true },
  });
}

async function loadBookingConfig(): Promise<BookingConfig> {
  "use cache";
  cacheLife("hours");
  cacheTag(settingsTag);
  const { timeZone, bookingHorizonDays, minLeadMinutes } = await getBookingRules(db);
  return { timeZone, bookingHorizonDays, minLeadMinutes };
}

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
  return (await loadServices()).map((s) => ({
    id: s.id,
    category: s.category,
    name: text(s.name, locale),
    summary: text(s.summary, locale),
    includes: texts(s.includes, locale),
    durationMinutes: s.durationMinutes,
    price: s.priceMnt,
    featured: s.featured,
  }));
}

export async function getFeaturedServices(locale: Locale): Promise<Service[]> {
  return (await getServices(locale)).filter((s) => s.featured);
}

export async function getBarbers(locale: Locale): Promise<Barber[]> {
  return (await loadBarbers()).map((b) => ({
    id: b.id,
    name: text(b.name, locale),
    role: text(b.role, locale),
    bio: text(b.bio, locale),
    specialties: texts(b.specialties, locale),
    yearsExperience: b.yearsExperience,
    image: getMedia(b.imageId, locale),
    serviceIds: b.services.map((s) => s.serviceId),
    workingDays: [...new Set(b.workingHours.map((h) => weekdayNames[h.weekday]))],
    workingHours: b.workingHours,
  }));
}

/** Booking rules the browser needs for date hints. */
export async function getBookingConfig(): Promise<BookingConfig> {
  return loadBookingConfig();
}

/** All gallery items, or only `ids` in the order given. */
export async function getGallery(locale: Locale, ids?: string[]): Promise<GalleryItem[]> {
  const records = ids
    ? ids.flatMap((id) => galleryRecords.filter((g) => g.id === id))
    : galleryRecords;
  const barbers = await loadBarbers();
  return records.map((g) => {
    const barber = barbers.find((b) => b.id === g.barberId);
    return {
      id: g.id,
      title: g.title[locale],
      image: getMedia(g.imageId, locale),
      barberName: barber ? text(barber.name, locale) : undefined,
      layout: g.layout,
    };
  });
}

export async function getTestimonials(locale: Locale): Promise<Testimonial[]> {
  return (await loadReviews()).map((r) => ({
    id: r.id,
    quote: text(r.quote, locale),
    attribution: text(r.attribution, locale),
    isSample: r.isSample,
  }));
}
