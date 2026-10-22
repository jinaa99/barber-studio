/*
 * Media references. Everything that shows an image on the site (barber
 * photos, page slots, gallery items) stores a single string:
 *
 *   "studio-interior"   a photo bundled with the app (`content/media.ts`)
 *   "asset:<id>"        a MediaAsset from the library (shown only while PUBLISHED)
 *
 * so bundled and library media can be swapped freely, and a missing or
 * unpublished asset simply falls back to the slot's default.
 */

export const ASSET_PREFIX = "asset:";

export type MediaRef = { type: "bundled"; id: string } | { type: "asset"; id: string };

/** cuid-shaped ids only: lowercase letters and digits. */
const ASSET_ID = /^[a-z0-9]{8,40}$/;
const BUNDLED_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function parseMediaRef(value: string): MediaRef | null {
  if (value.startsWith(ASSET_PREFIX)) {
    const id = value.slice(ASSET_PREFIX.length);
    return ASSET_ID.test(id) ? { type: "asset", id } : null;
  }
  return BUNDLED_ID.test(value) && value.length <= 64 ? { type: "bundled", id: value } : null;
}

export function assetRef(id: string): string {
  return `${ASSET_PREFIX}${id}`;
}

/** URL path that serves a stored media file (`app/api/media/[file]`). */
export function mediaFileUrl(fileName: string): string {
  return `/api/media/${fileName}`;
}
