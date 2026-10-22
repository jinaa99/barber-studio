import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Locale, LocalizedText } from "@/i18n/config";
import { heroClipRecords, mediaRecords } from "@/content/media";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { getDictionary } from "@/i18n/get-dictionary";
import { applyTextOverrides, curate, type StudioProfile } from "@/lib/admin/content";
import { readSiteContent } from "@/lib/server/content";
import { readWebsiteMedia, type WebsiteMedia } from "@/lib/server/media-library";
import { galleryRecords } from "@/content/demo/gallery";
import { db } from "@/lib/server/db";
import { getBookingRules } from "@/lib/server/settings";
import type { BookingConfig } from "@/lib/booking/types";
import { assetRef, mediaFileUrl, parseMediaRef } from "@/lib/media/refs";
import { GALLERY_SLOT, heroSlot, pageSlots, resolveGalleryOptions, resolveHeroOptions, type PageSlot } from "@/lib/media/slots";
import { providerLicense } from "@/lib/media/stock";
import { OWN_MEDIA_LICENSE } from "@/lib/admin/media";
import type {
  Barber,
  Credit,
  GalleryItem,
  GalleryRecord,
  HeroClip,
  HeroClipRecord,
  Media,
  Service,
  ServiceCategoryView,
  Testimonial,
  Weekday,
} from "@/content/types";

/*
 * Data access layer. Pages and components only talk to these async functions.
 * Services, barbers, schedules, reviews, booking settings, website content and
 * the media library's placements come from PostgreSQL; the bundled photos,
 * hero clips and default gallery ship with the app and are the fallback for
 * every media slot.
 *
 * Database reads are cached (`use cache`) so public pages still prerender,
 * and tagged so staff changes show up at once: call `updateTag(catalogTag)`
 * after changing services, categories, barbers, hours or reviews,
 * `updateTag(settingsTag)` after changing business settings,
 * `updateTag(contentTag)` after changing website content (studio profile,
 * copy overrides, gallery curation), and `updateTag(mediaTag)` after changing
 * library assets or where they are placed.
 */

export const catalogTag = "catalog";
export const settingsTag = "settings";
export const contentTag = "content";
export const mediaTag = "media";

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
      categoryId: true,
      name: true,
      summary: true,
      includes: true,
      durationMinutes: true,
      priceMnt: true,
      featured: true,
    },
  });
}

async function loadCategories() {
  "use cache";
  cacheLife("hours");
  cacheTag(catalogTag);
  return db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true } });
}

async function loadSiteContent() {
  "use cache";
  cacheLife("hours");
  cacheTag(contentTag);
  return readSiteContent(db);
}

async function loadWebsiteMedia() {
  "use cache";
  cacheLife("hours");
  cacheTag(mediaTag);
  return readWebsiteMedia(db);
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

/** Service categories in display order. */
export async function getServiceCategories(locale: Locale): Promise<ServiceCategoryView[]> {
  return (await loadCategories()).map((c) => ({ id: c.id, name: text(c.name, locale) }));
}

/** Studio name, contact details, opening hours and socials (database, else `content/site.ts`). */
export async function getStudioProfile(): Promise<StudioProfile> {
  return (await loadSiteContent()).profile;
}

/** The dictionary with the studio's website-copy overrides applied. Use it for pages that show editable copy. */
export async function getSiteDictionary(locale: Locale): Promise<Dictionary> {
  const [dict, content] = await Promise.all([getDictionary(locale), loadSiteContent()]);
  return applyTextOverrides(dict, content.texts, locale);
}

/* ------------------------------------------------------------------- Media */

type LibraryAsset = WebsiteMedia["assets"][number];

const providerName = { PEXELS: providerLicense.pexels.label, PIXABAY: providerLicense.pixabay.label } as const;

function assetCredit(asset: LibraryAsset): Credit | undefined {
  if (asset.source !== "UPLOAD") {
    return { name: asset.creatorName, provider: providerName[asset.source], license: asset.licenseName, url: asset.sourceUrl, stock: true };
  }
  const own = asset.licenseName === OWN_MEDIA_LICENSE;
  if (own && !asset.creatorName) return undefined;
  return { name: asset.creatorName, provider: null, license: own ? null : asset.licenseName, url: asset.sourceUrl, stock: !own };
}

function assetAlt(asset: LibraryAsset, locale: Locale): string {
  const alt = asset.alt as Partial<LocalizedText> | null;
  return alt?.[locale] || alt?.en || alt?.mn || "";
}

function assetMedia(asset: LibraryAsset, locale: Locale): Media {
  const file = asset.kind === "IMAGE" ? asset.fileName : asset.posterFileName;
  return { id: assetRef(asset.id), src: file ? mediaFileUrl(file) : null, alt: assetAlt(asset, locale), credit: assetCredit(asset) };
}

/** A published library asset of `kind` by reference, or null (missing, unpublished or a bundled id). */
function libraryAsset(library: WebsiteMedia, ref: string, kind: LibraryAsset["kind"]): LibraryAsset | null {
  const parsed = parseMediaRef(ref);
  if (parsed?.type !== "asset") return null;
  return library.assets.find((a) => a.id === parsed.id && a.kind === kind) ?? null;
}

/** An image by media reference: a bundled photo or a published library image; null if neither. */
function resolveImage(library: WebsiteMedia, ref: string, locale: Locale): Media | null {
  const parsed = parseMediaRef(ref);
  if (!parsed) return null;
  if (parsed.type === "bundled") return mediaRecords.some((m) => m.id === parsed.id) ? getMedia(parsed.id, locale) : null;
  const asset = libraryAsset(library, ref, "IMAGE");
  return asset ? assetMedia(asset, locale) : null;
}

/** A bundled photo by id (the fallback frame if there is none). */
export function getMedia(id: string, locale: Locale): Media {
  const record = mediaRecords.find((m) => m.id === id);
  if (!record) {
    return { id, src: null, alt: "" };
  }
  return {
    id: record.id,
    src: record.src,
    alt: record.alt[locale],
    credit: { name: record.credit.author, provider: "Unsplash", license: record.credit.license, url: record.credit.sourceUrl, stock: true },
  };
}

/** The image chosen for a page slot in the dashboard, or the slot's bundled default. */
export async function getSlotMedia(slot: PageSlot, locale: Locale): Promise<Media> {
  const library = await loadWebsiteMedia();
  const placement = library.placements.find((p) => p.slot === slot);
  return (placement && resolveImage(library, placement.ref, locale)) || getMedia(pageSlots[slot].fallback, locale);
}

function bundledClip(c: HeroClipRecord, locale: Locale): HeroClip {
  return {
    id: c.id,
    sources: c.sources,
    playback: c.playback,
    poster: c.poster,
    alt: c.alt[locale],
    focus: c.focus,
    credit: c.credit
      ? { name: c.credit.title, provider: c.credit.provider, license: c.credit.license, url: c.credit.sourceUrl, stock: true }
      : undefined,
  };
}

/**
 * The home hero clips, in scroll order. A scene with a still and/or a video
 * chosen in the dashboard uses them; otherwise (or if they were unpublished)
 * it keeps the bundled clip. A scene with a still and no video stays a still,
 * and a video without a still uses the video's own poster frame.
 */
export async function getHeroClips(locale: Locale): Promise<HeroClip[]> {
  const library = await loadWebsiteMedia();
  return (heroClipRecords as HeroClipRecord[]).map((record) => {
    const stillPlacement = library.placements.find((p) => p.slot === heroSlot(record.id, "still"));
    const videoPlacement = library.placements.find((p) => p.slot === heroSlot(record.id, "video"));
    const still = stillPlacement ? resolveImage(library, stillPlacement.ref, locale) : null;
    const video = videoPlacement ? libraryAsset(library, videoPlacement.ref, "VIDEO") : null;
    if (!still && !video) return bundledClip(record, locale);

    const focus = resolveHeroOptions(stillPlacement?.options);
    const position = focus ? `${focus.focusX}% ${focus.focusY}%` : "50% 50%";
    return {
      id: record.id,
      sources: video ? [{ src: mediaFileUrl(video.fileName), type: video.mimeType === "video/webm" ? "video/webm" : "video/mp4" }] : [],
      // Library footage isn't encoded for frame-accurate seeking, so it plays while its scene is on screen.
      playback: "loop",
      poster: still?.src ?? (video?.posterFileName ? mediaFileUrl(video.posterFileName) : null),
      alt: still?.alt || (video ? assetAlt(video, locale) : ""),
      focus: { landscape: position, portrait: position },
      credit: video ? assetCredit(video) : still?.credit,
    };
  });
}

/** Credits for every photo and clip the site can show, for the gallery page. */
export async function getMediaCredits(locale: Locale): Promise<(Credit & { id: string; kind: "photo" | "footage" })[]> {
  const [library, barbers, clips] = await Promise.all([loadWebsiteMedia(), loadBarbers(), getHeroClips(locale)]);
  const used = new Set([...library.placements.map((p) => p.ref), ...barbers.map((b) => b.imageId)]);
  const credits = [
    ...mediaRecords.map((m) => ({ ...getMedia(m.id, locale).credit!, id: m.id, kind: "photo" as const })),
    ...library.assets
      .filter((a) => a.kind === "IMAGE" && used.has(assetRef(a.id)))
      .flatMap((a) => {
        const credit = assetCredit(a);
        return credit ? [{ ...credit, id: assetRef(a.id), kind: "photo" as const }] : [];
      }),
    ...clips.flatMap((c) => (c.credit ? [{ ...c.credit, id: `hero-${c.id}`, kind: "footage" as const }] : [])),
  ];
  // The same asset can be used in several places (e.g. one clip in two hero scenes): credit it once.
  const key = (c: (typeof credits)[number]) => JSON.stringify([c.kind, c.name, c.provider, c.license, c.url]);
  return credits.filter((c, i) => credits.findIndex((o) => key(o) === key(c)) === i);
}

export async function getServices(locale: Locale): Promise<Service[]> {
  return (await loadServices()).map((s) => ({
    id: s.id,
    category: s.categoryId,
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
  const [barbers, library] = await Promise.all([loadBarbers(), loadWebsiteMedia()]);
  return barbers.map((b) => ({
    id: b.id,
    name: text(b.name, locale),
    role: text(b.role, locale),
    bio: text(b.bio, locale),
    specialties: texts(b.specialties, locale),
    yearsExperience: b.yearsExperience,
    image: resolveImage(library, b.imageId, locale) ?? { id: b.imageId, src: null, alt: "" },
    serviceIds: b.services.map((s) => s.serviceId),
    workingDays: [...new Set(b.workingHours.map((h) => weekdayNames[h.weekday]))],
    workingHours: b.workingHours,
  }));
}

/** Booking rules the browser needs for date hints. */
export async function getBookingConfig(): Promise<BookingConfig> {
  return loadBookingConfig();
}

/** Bundled gallery records plus the photos added from the media library, as one list. */
function galleryEntries(library: WebsiteMedia): (Omit<GalleryRecord, "imageId" | "serviceId"> & { ref: string })[] {
  return [
    ...galleryRecords.map((g) => ({ id: g.id, title: g.title, ref: g.imageId, barberId: g.barberId, layout: g.layout })),
    ...library.placements
      .filter((p) => p.slot === GALLERY_SLOT)
      .map((p) => {
        const options = resolveGalleryOptions(p.options);
        const caption = p.caption as LocalizedText | null;
        return { id: p.id, title: caption ?? { mn: "", en: "" }, ref: p.ref, barberId: options.barberId, layout: options.layout };
      }),
  ];
}

/**
 * Gallery items in the studio's curated order, without hidden ones (and
 * without library photos that were unpublished). With `ids`, only those items
 * in the order given (hidden ones still left out).
 */
export async function getGallery(locale: Locale, ids?: string[]): Promise<GalleryItem[]> {
  const [barbers, content, library] = await Promise.all([loadBarbers(), loadSiteContent(), loadWebsiteMedia()]);
  const entries = galleryEntries(library);
  const records = ids
    ? curate(ids.flatMap((id) => entries.filter((g) => g.id === id)), { order: ids, hidden: content.gallery.hidden })
    : curate(entries, content.gallery);
  return records.flatMap((g) => {
    const image = resolveImage(library, g.ref, locale);
    if (!image) return [];
    const barber = barbers.find((b) => b.id === g.barberId);
    return [
      {
        id: g.id,
        title: g.title[locale],
        image,
        barberName: barber ? text(barber.name, locale) : undefined,
        layout: g.layout,
      },
    ];
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
