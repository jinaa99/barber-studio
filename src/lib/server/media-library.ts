import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { MediaKind, MediaSource, MediaStatus } from "@/generated/prisma/enums";
import type { LocalizedText } from "@/i18n/config";
import { IMAGE_MAX_BYTES, sniffMediaType, VIDEO_MAX_BYTES } from "@/lib/media/files";
import { assetRef, parseMediaRef } from "@/lib/media/refs";
import {
  acceptsBundled,
  galleryOptionsSchema,
  GALLERY_SLOT,
  heroOptionsSchema,
  isMediaSlot,
  slotKind,
  type MediaSlot,
} from "@/lib/media/slots";
import { providerLicense, type StockSelection } from "@/lib/media/stock";
import type { Db } from "./db";
import { audit } from "./audit";
import { processImage, removeStoredFile, writeStoredFile } from "./media-storage";
import { downloadProviderFile, fetchStockAsset, type DownloadError, type StockError } from "./stock-media";

/*
 * The media library: assets saved from stock providers or uploaded, their
 * publication state, and where the website uses them (placements and barber
 * photos, both as media references, see `lib/media/refs.ts`).
 *
 * Rules:
 * - Only PUBLISHED assets appear on the site and can be placed. Publishing
 *   needs alt text in both languages.
 * - Unpublishing an asset in use is allowed; those places show their default.
 * - An asset in use can't be deleted: replace it or remove it from those places first.
 * - Source, creator and licence of stock assets are stored as the provider
 *   reported them and can't be edited; for uploads, staff enter them.
 *
 * Callers authorize (`media.manage`) and refresh the public cache (`updateTag(mediaTag)`).
 */

export type MediaError =
  | "not_found"
  | "in_use"
  | "alt_required"
  | "not_published"
  | "wrong_kind"
  | "invalid_slot"
  | "invalid_ref"
  | "invalid_file"
  | "storage"
  | StockError
  | DownloadError;

export type MediaResult<T = undefined> = { ok: true; value: T } | { ok: false; error: MediaError; retryAfterSeconds?: number };

const fail = (error: MediaError, retryAfterSeconds?: number): { ok: false; error: MediaError; retryAfterSeconds?: number } =>
  retryAfterSeconds === undefined ? { ok: false, error } : { ok: false, error, retryAfterSeconds };

/** A fresh id that matches the media reference and file name patterns. */
const newAssetId = () => randomUUID().replaceAll("-", "");

/* -------------------------------------------------------------------- Read */

export const MEDIA_PAGE_SIZE = 24;
export const mediaKinds = ["IMAGE", "VIDEO"] as const satisfies MediaKind[];
export const mediaStatuses = ["DRAFT", "PUBLISHED"] as const satisfies MediaStatus[];
export const mediaSources = ["PEXELS", "PIXABAY", "UPLOAD"] as const satisfies MediaSource[];

export interface MediaFilters {
  q?: string;
  kind?: MediaKind;
  status?: MediaStatus;
  source?: MediaSource;
  page: number;
}

const assetSelect = {
  id: true,
  kind: true,
  source: true,
  providerAssetId: true,
  sourceUrl: true,
  creatorName: true,
  creatorUrl: true,
  licenseName: true,
  licenseUrl: true,
  providerDescription: true,
  alt: true,
  notes: true,
  fileName: true,
  mimeType: true,
  bytes: true,
  width: true,
  height: true,
  durationSeconds: true,
  posterFileName: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { name: true } },
} satisfies Prisma.MediaAssetSelect;

export type MediaAssetRow = Prisma.MediaAssetGetPayload<{ select: typeof assetSelect }>;

export async function listMediaAssets(db: Db, filters: MediaFilters) {
  const page = Math.max(1, filters.page);
  const q = filters.q?.trim().slice(0, 80);
  const where: Prisma.MediaAssetWhereInput = {
    kind: filters.kind,
    status: filters.status,
    source: filters.source,
    ...(q
      ? {
          OR: [
            { creatorName: { contains: q, mode: "insensitive" } },
            { providerDescription: { contains: q, mode: "insensitive" } },
            { notes: { contains: q, mode: "insensitive" } },
            { providerAssetId: q },
            { alt: { path: ["en"], string_contains: q } },
            { alt: { path: ["mn"], string_contains: q } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.mediaAsset.count({ where }),
    db.mediaAsset.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * MEDIA_PAGE_SIZE,
      take: MEDIA_PAGE_SIZE,
      select: assetSelect,
    }),
  ]);
  const refs = rows.map((r) => assetRef(r.id));
  const [placed, barbers] = await Promise.all([
    db.mediaPlacement.groupBy({ by: ["ref"], where: { ref: { in: refs } }, _count: { _all: true } }),
    db.barber.groupBy({ by: ["imageId"], where: { imageId: { in: refs } }, _count: { _all: true } }),
  ]);
  const uses = (id: string) =>
    (placed.find((p) => p.ref === assetRef(id))?._count._all ?? 0) + (barbers.find((b) => b.imageId === assetRef(id))?._count._all ?? 0);
  return { total, page, pageSize: MEDIA_PAGE_SIZE, rows: rows.map((r) => ({ ...r, uses: uses(r.id) })) };
}

export async function getMediaAsset(db: Db, id: string) {
  return db.mediaAsset.findUnique({ where: { id }, select: assetSelect });
}

/** Where a media reference is used on the website. */
export async function mediaUsages(db: Db | Prisma.TransactionClient, ref: string) {
  const [placements, barbers] = await Promise.all([
    db.mediaPlacement.findMany({ where: { ref }, orderBy: [{ slot: "asc" }, { position: "asc" }], select: { id: true, slot: true, caption: true } }),
    db.barber.findMany({ where: { imageId: ref }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return { placements, barbers };
}

/** Published assets for the dashboard's pickers. */
export async function listPublishedAssets(db: Db, kind?: MediaKind) {
  return db.mediaAsset.findMany({
    where: { status: "PUBLISHED", kind },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, kind: true, fileName: true, posterFileName: true, alt: true, width: true, height: true, source: true, creatorName: true },
  });
}

export async function listPlacements(db: Db) {
  return db.mediaPlacement.findMany({
    orderBy: [{ slot: "asc" }, { position: "asc" }, { createdAt: "asc" }],
    select: { id: true, slot: true, ref: true, position: true, caption: true, options: true },
  });
}

/** Everything the public site needs: placements and published assets (cached by `lib/data.ts`). */
export async function readWebsiteMedia(db: Db) {
  const [placements, assets] = await Promise.all([
    listPlacements(db),
    db.mediaAsset.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        kind: true,
        source: true,
        fileName: true,
        posterFileName: true,
        mimeType: true,
        width: true,
        height: true,
        alt: true,
        creatorName: true,
        creatorUrl: true,
        sourceUrl: true,
        licenseName: true,
        licenseUrl: true,
      },
    }),
  ]);
  return { placements, assets };
}

export type WebsiteMedia = Awaited<ReturnType<typeof readWebsiteMedia>>;

/* ------------------------------------------------------------------ Create */

interface NewAsset {
  kind: MediaKind;
  source: MediaSource;
  providerAssetId: string | null;
  sourceUrl: string | null;
  creatorName: string | null;
  creatorUrl: string | null;
  licenseName: string;
  licenseUrl: string | null;
  providerDescription: string | null;
  providerPreviewUrl: string | null;
  alt: LocalizedText;
  notes: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

/** Write the files first, then the row; a failed insert removes the files again. */
async function storeAsset(
  db: Db,
  meta: NewAsset,
  files: { main: Uint8Array; extension: "jpg" | "mp4" | "webm"; poster: Uint8Array | null },
  actorId: string,
): Promise<MediaResult<{ id: string; existing: boolean }>> {
  const id = newAssetId();
  const fileName = `${id}.${files.extension}`;
  const posterFileName = files.poster ? `${id}.poster.jpg` : null;
  try {
    await writeStoredFile(fileName, files.main);
    if (posterFileName && files.poster) await writeStoredFile(posterFileName, files.poster);
  } catch (error) {
    console.error("[media] could not write to media storage:", error instanceof Error ? error.message : error);
    await removeStoredFile(fileName).catch(() => {});
    return fail("storage");
  }
  try {
    await db.$transaction(async (tx) => {
      await tx.mediaAsset.create({
        data: { id, ...meta, fileName, posterFileName, bytes: files.main.byteLength, createdById: actorId },
      });
      await audit(tx, {
        actorId,
        action: meta.source === "UPLOAD" ? "media.uploaded" : "media.saved",
        entityType: "MediaAsset",
        entityId: id,
        metadata: { source: meta.source, kind: meta.kind, providerAssetId: meta.providerAssetId },
      });
    });
  } catch (error) {
    await Promise.all([removeStoredFile(fileName), removeStoredFile(posterFileName)]).catch(() => {});
    if (meta.providerAssetId && (error as { code?: string }).code === "P2002") {
      // Saved by someone else a moment ago.
      const existing = await db.mediaAsset.findUnique({
        where: { source_providerAssetId: { source: meta.source, providerAssetId: meta.providerAssetId } },
        select: { id: true },
      });
      if (existing) return { ok: true, value: { id: existing.id, existing: true } };
    }
    throw error;
  }
  return { ok: true, value: { id, existing: false } };
}

const sourceOf = { pexels: "PEXELS", pixabay: "PIXABAY" } as const;

/**
 * Save a stock asset to the library as a draft. The asset is looked up again
 * by id at the provider, then its file is downloaded from the provider's media
 * host, checked and stored. Saving the same asset twice returns the first copy.
 */
export async function saveStockAsset(db: Db, selection: StockSelection, actorId: string): Promise<MediaResult<{ id: string; existing: boolean }>> {
  const source = sourceOf[selection.provider];
  const existing = await db.mediaAsset.findUnique({
    where: { source_providerAssetId: { source, providerAssetId: selection.id } },
    select: { id: true },
  });
  if (existing) return { ok: true, value: { id: existing.id, existing: true } };

  const found = await fetchStockAsset(selection);
  if (!found.ok) return fail(found.error, found.retryAfterSeconds);
  const { item, download } = found.value;
  const isVideo = selection.kind === "video";

  const file = await downloadProviderFile(selection.provider, download.url, isVideo ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES);
  if (!file.ok) return fail(file.error);
  const sniffed = sniffMediaType(file.bytes);
  if (!sniffed || sniffed.kind !== (isVideo ? "VIDEO" : "IMAGE")) return fail("invalid_file");

  let main: Uint8Array;
  let extension: "jpg" | "mp4" | "webm";
  let mimeType: string;
  let width: number;
  let height: number;
  let poster: Uint8Array | null = null;
  if (sniffed.kind === "IMAGE") {
    const image = await processImage(file.bytes);
    if (!image) return fail("invalid_file");
    ({ data: main, width, height } = image);
    extension = "jpg";
    mimeType = "image/jpeg";
  } else {
    main = file.bytes;
    ({ extension, mimeType } = sniffed);
    ({ width, height } = download);
    if (download.posterUrl) {
      const still = await downloadProviderFile(selection.provider, download.posterUrl, IMAGE_MAX_BYTES);
      const image = still.ok ? await processImage(still.bytes) : null;
      poster = image?.data ?? null;
    }
  }

  const license = providerLicense[selection.provider];
  return storeAsset(
    db,
    {
      kind: sniffed.kind,
      source,
      providerAssetId: item.id,
      sourceUrl: item.pageUrl,
      creatorName: item.creatorName,
      creatorUrl: item.creatorUrl,
      licenseName: license.name,
      licenseUrl: license.url,
      providerDescription: item.description,
      providerPreviewUrl: item.thumbnailUrl,
      // Pexels writes real alt text for photos; Pixabay only has tags, which are not a description.
      alt: { mn: "", en: selection.provider === "pexels" && !isVideo ? (item.description ?? "").slice(0, 300) : "" },
      notes: null,
      mimeType,
      width,
      height,
      durationSeconds: item.durationSeconds,
    },
    { main, extension, poster },
    actorId,
  );
}

export interface UploadInput {
  bytes: Uint8Array;
  licenseName: string;
  licenseUrl: string | null;
  creatorName: string | null;
  sourceUrl: string | null;
  alt: LocalizedText;
  notes: string | null;
}

/** Store a staff upload as a draft. Images are re-encoded; only MP4 and WebM videos are kept as sent. */
export async function createUploadedAsset(db: Db, input: UploadInput, actorId: string): Promise<MediaResult<{ id: string; existing: boolean }>> {
  const sniffed = sniffMediaType(input.bytes);
  if (!sniffed) return fail("invalid_file");
  if (input.bytes.byteLength > (sniffed.kind === "IMAGE" ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES)) return fail("too_large");
  const meta = {
    source: "UPLOAD" as const,
    providerAssetId: null,
    sourceUrl: input.sourceUrl,
    creatorName: input.creatorName,
    creatorUrl: null,
    licenseName: input.licenseName,
    licenseUrl: input.licenseUrl,
    providerDescription: null,
    providerPreviewUrl: null,
    alt: input.alt,
    notes: input.notes,
    durationSeconds: null,
  };
  if (sniffed.kind === "IMAGE") {
    const image = await processImage(input.bytes);
    if (!image) return fail("invalid_file");
    return storeAsset(
      db,
      { ...meta, kind: "IMAGE", mimeType: "image/jpeg", width: image.width, height: image.height },
      { main: image.data, extension: "jpg", poster: null },
      actorId,
    );
  }
  return storeAsset(
    db,
    { ...meta, kind: "VIDEO", mimeType: sniffed.mimeType, width: null, height: null },
    { main: input.bytes, extension: sniffed.extension, poster: null },
    actorId,
  );
}

/* ------------------------------------------------------------------ Update */

export interface MediaDetailsInput {
  alt: LocalizedText;
  notes: string;
  /** Uploads only: stock credits stay as the provider reported them. */
  credit?: { creatorName: string; sourceUrl: string; licenseName: string; licenseUrl: string };
}

export async function updateMediaDetails(db: Db, id: string, input: MediaDetailsInput, actorId: string): Promise<MediaResult> {
  const asset = await db.mediaAsset.findUnique({ where: { id }, select: { source: true, status: true } });
  if (!asset) return fail("not_found");
  // A published asset must keep its alt text.
  if (asset.status === "PUBLISHED" && (!input.alt.mn.trim() || !input.alt.en.trim())) return fail("alt_required");
  const credit =
    asset.source === "UPLOAD" && input.credit
      ? {
          creatorName: input.credit.creatorName || null,
          sourceUrl: input.credit.sourceUrl || null,
          licenseName: input.credit.licenseName,
          licenseUrl: input.credit.licenseUrl || null,
        }
      : {};
  await db.$transaction(async (tx) => {
    await tx.mediaAsset.update({ where: { id }, data: { alt: input.alt, notes: input.notes || null, ...credit } });
    await audit(tx, { actorId, action: "media.updated", entityType: "MediaAsset", entityId: id });
  });
  return { ok: true, value: undefined };
}

export async function setMediaStatus(db: Db, id: string, status: MediaStatus, actorId: string): Promise<MediaResult<{ uses: number }>> {
  const asset = await db.mediaAsset.findUnique({ where: { id }, select: { alt: true, status: true } });
  if (!asset) return fail("not_found");
  const alt = asset.alt as LocalizedText;
  if (status === "PUBLISHED" && (!alt?.mn?.trim() || !alt?.en?.trim())) return fail("alt_required");
  const usages = await mediaUsages(db, assetRef(id));
  if (asset.status !== status) {
    await db.$transaction(async (tx) => {
      await tx.mediaAsset.update({ where: { id }, data: { status, publishedAt: status === "PUBLISHED" ? new Date() : null } });
      await audit(tx, {
        actorId,
        action: status === "PUBLISHED" ? "media.published" : "media.unpublished",
        entityType: "MediaAsset",
        entityId: id,
      });
    });
  }
  return { ok: true, value: { uses: usages.placements.length + usages.barbers.length } };
}

export async function deleteMediaAsset(db: Db, id: string, actorId: string): Promise<MediaResult> {
  const files = await db.$transaction(async (tx) => {
    const asset = await tx.mediaAsset.findUnique({ where: { id }, select: { fileName: true, posterFileName: true, source: true, providerAssetId: true } });
    if (!asset) return "not_found" as const;
    const usages = await mediaUsages(tx, assetRef(id));
    if (usages.placements.length + usages.barbers.length > 0) return "in_use" as const;
    await tx.mediaAsset.delete({ where: { id } });
    await audit(tx, {
      actorId,
      action: "media.deleted",
      entityType: "MediaAsset",
      entityId: id,
      metadata: { source: asset.source, providerAssetId: asset.providerAssetId },
    });
    return asset;
  });
  if (typeof files === "string") return fail(files);
  await Promise.all([removeStoredFile(files.fileName), removeStoredFile(files.posterFileName)]).catch((error) => {
    console.error("[media] could not remove stored files:", error instanceof Error ? error.message : error);
  });
  return { ok: true, value: undefined };
}

/** Point every placement and barber photo that uses `fromId` at `toId` (published, same kind). */
export async function replaceMediaEverywhere(db: Db, fromId: string, toId: string, actorId: string): Promise<MediaResult<{ count: number }>> {
  if (fromId === toId) return fail("invalid_ref");
  const [from, to] = await Promise.all([
    db.mediaAsset.findUnique({ where: { id: fromId }, select: { kind: true } }),
    db.mediaAsset.findUnique({ where: { id: toId }, select: { kind: true, status: true } }),
  ]);
  if (!from || !to) return fail("not_found");
  if (to.status !== "PUBLISHED") return fail("not_published");
  if (to.kind !== from.kind) return fail("wrong_kind");
  const count = await db.$transaction(async (tx) => {
    const placed = await tx.mediaPlacement.updateMany({ where: { ref: assetRef(fromId) }, data: { ref: assetRef(toId) } });
    const barbers = await tx.barber.updateMany({ where: { imageId: assetRef(fromId) }, data: { imageId: assetRef(toId) } });
    await audit(tx, { actorId, action: "media.replaced", entityType: "MediaAsset", entityId: fromId, metadata: { replacement: toId } });
    return placed.count + barbers.count;
  });
  return { ok: true, value: { count } };
}

/* -------------------------------------------------------------- Placements */

/**
 * Whether `ref` can go into `slot`: a bundled image id from `bundledIds`
 * (image slots only), or a PUBLISHED library asset of the slot's kind.
 */
export async function checkRef(db: Db | Prisma.TransactionClient, slot: MediaSlot, ref: string, bundledIds: readonly string[]): Promise<MediaError | null> {
  const parsed = parseMediaRef(ref);
  if (!parsed) return "invalid_ref";
  if (parsed.type === "bundled") return acceptsBundled(slot) && bundledIds.includes(parsed.id) ? null : "invalid_ref";
  const asset = await db.mediaAsset.findUnique({ where: { id: parsed.id }, select: { kind: true, status: true } });
  if (!asset) return "invalid_ref";
  if (asset.kind !== slotKind(slot)) return "wrong_kind";
  return asset.status === "PUBLISHED" ? null : "not_published";
}

export interface SlotEntry {
  slot: string;
  /** null clears the slot (the site shows its default again). */
  ref: string | null;
  options?: Record<string, unknown>;
}

/**
 * Set or clear several single-asset slots at once (all or nothing), e.g. a
 * hero scene's still, video and focal point.
 */
export async function setSlots(db: Db, entries: SlotEntry[], bundledIds: readonly string[], actorId: string): Promise<MediaResult> {
  for (const entry of entries) {
    if (!isMediaSlot(entry.slot) || entry.slot === GALLERY_SLOT) return fail("invalid_slot");
    if (entry.options && !heroOptionsSchema.safeParse(entry.options).success) return fail("invalid_slot");
  }
  try {
    await db.$transaction(async (tx) => {
      for (const entry of entries) {
        const slot = entry.slot as MediaSlot;
        if (entry.ref === null) {
          await tx.mediaPlacement.deleteMany({ where: { slot } });
          continue;
        }
        const error = await checkRef(tx, slot, entry.ref, bundledIds);
        // Throwing rolls back the entries already written.
        if (error) throw new RefRejected(error);
        const options = (entry.options ?? {}) as Prisma.InputJsonValue;
        const current = await tx.mediaPlacement.findFirst({ where: { slot }, select: { id: true } });
        if (current) await tx.mediaPlacement.update({ where: { id: current.id }, data: { ref: entry.ref, options } });
        else await tx.mediaPlacement.create({ data: { slot, ref: entry.ref, options } });
      }
      await audit(tx, {
        actorId,
        action: "media.placed",
        entityType: "MediaPlacement",
        metadata: entries.map((e) => ({ slot: e.slot, ref: e.ref })),
      });
    });
  } catch (error) {
    if (error instanceof RefRejected) return fail(error.reason);
    throw error;
  }
  return { ok: true, value: undefined };
}

class RefRejected extends Error {
  constructor(readonly reason: MediaError) {
    super(reason);
  }
}

export interface GalleryItemInput {
  ref: string;
  caption: LocalizedText;
  layout: "portrait" | "landscape";
  barberId?: string;
}

export async function addGalleryItem(db: Db, input: GalleryItemInput, bundledIds: readonly string[], actorId: string): Promise<MediaResult<{ id: string }>> {
  const options = galleryOptionsSchema.safeParse({ layout: input.layout, barberId: input.barberId || undefined });
  if (!options.success || !input.caption.mn.trim() || !input.caption.en.trim()) return fail("invalid_slot");
  if (options.data.barberId && !(await db.barber.findUnique({ where: { id: options.data.barberId }, select: { id: true } }))) {
    return fail("invalid_ref");
  }
  return db.$transaction(async (tx) => {
    const error = await checkRef(tx, GALLERY_SLOT, input.ref, bundledIds);
    if (error) return fail(error);
    const last = await tx.mediaPlacement.aggregate({ where: { slot: GALLERY_SLOT }, _max: { position: true } });
    const placement = await tx.mediaPlacement.create({
      data: {
        slot: GALLERY_SLOT,
        ref: input.ref,
        position: (last._max.position ?? 0) + 1,
        caption: { mn: input.caption.mn.trim(), en: input.caption.en.trim() },
        options: options.data,
      },
      select: { id: true },
    });
    await audit(tx, { actorId, action: "media.placed", entityType: "MediaPlacement", entityId: placement.id, metadata: { slot: GALLERY_SLOT, ref: input.ref } });
    return { ok: true as const, value: placement };
  });
}

export async function removePlacement(db: Db, id: string, actorId: string): Promise<MediaResult> {
  const placement = await db.mediaPlacement.findUnique({ where: { id }, select: { slot: true, ref: true } });
  if (!placement) return fail("not_found");
  await db.$transaction(async (tx) => {
    await tx.mediaPlacement.delete({ where: { id } });
    await audit(tx, { actorId, action: "media.unplaced", entityType: "MediaPlacement", entityId: id, metadata: placement });
  });
  return { ok: true, value: undefined };
}
