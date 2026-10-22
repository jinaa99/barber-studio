import { z } from "zod";
import type { HeroClipId } from "@/content/types";

/*
 * Website slots that take media from the library. A slot with no placement
 * shows its bundled default, so an empty `media_placements` table changes
 * nothing on the site. Pure: shared by the dashboard, the Server Actions (the
 * authority) and the public data layer.
 */

export type MediaKindName = "IMAGE" | "VIDEO";

/** Single images on public pages, with the bundled photo shown by default. */
export const pageSlots = {
  "home.intro": { fallback: "studio-interior" },
  "home.visit": { fallback: "studio-chair" },
  "services.feature": { fallback: "studio-tools" },
  "visit.cover": { fallback: "studio-interior" },
} as const;

export type PageSlot = keyof typeof pageSlots;
export const pageSlotIds = Object.keys(pageSlots) as PageSlot[];

/** Hero scenes in scroll order; each takes a still (poster) and an optional video. */
export const heroSceneIds: HeroClipId[] = ["arrival", "craft", "detail", "result"];

export type HeroSlot = `hero.${HeroClipId}.${"still" | "video"}`;
export const GALLERY_SLOT = "gallery";

export type MediaSlot = PageSlot | HeroSlot | typeof GALLERY_SLOT;

export function heroSlot(scene: HeroClipId, part: "still" | "video"): HeroSlot {
  return `hero.${scene}.${part}`;
}

/** The kind of media a slot accepts, or null when `slot` isn't one. */
export function slotKind(slot: string): MediaKindName | null {
  if (slot === GALLERY_SLOT || Object.hasOwn(pageSlots, slot)) return "IMAGE";
  const match = /^hero\.([a-z]+)\.(still|video)$/.exec(slot);
  if (!match || !heroSceneIds.includes(match[1] as HeroClipId)) return null;
  return match[2] === "video" ? "VIDEO" : "IMAGE";
}

export function isMediaSlot(slot: string): slot is MediaSlot {
  return slotKind(slot) !== null;
}

/** Every slot except the gallery holds one item (also enforced by a unique index). */
export function isSingleSlot(slot: MediaSlot): boolean {
  return slot !== GALLERY_SLOT;
}

/** Bundled videos can't be referenced: video slots take library assets only. */
export function acceptsBundled(slot: MediaSlot): boolean {
  return slotKind(slot) === "IMAGE";
}

/* ------------------------------------------------------------ Slot options */

const percent = z.coerce.number().int().min(0).max(100);

/** Focal point of a hero still, in percent; used as `object-position`. */
export const heroOptionsSchema = z.object({ focusX: percent, focusY: percent });
export type HeroOptions = z.output<typeof heroOptionsSchema>;

export const galleryOptionsSchema = z.object({
  layout: z.enum(["portrait", "landscape"]),
  barberId: z.string().max(64).optional(),
});
export type GalleryOptions = z.output<typeof galleryOptionsSchema>;

export function resolveHeroOptions(stored: unknown): HeroOptions | null {
  const parsed = heroOptionsSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

export function resolveGalleryOptions(stored: unknown): GalleryOptions {
  const parsed = galleryOptionsSchema.safeParse(stored);
  return parsed.success ? parsed.data : { layout: "portrait" };
}
