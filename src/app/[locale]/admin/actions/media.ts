"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { localizedPath } from "@/i18n/config";
import { mediaRecords } from "@/content/media";
import { catalogTag, mediaTag } from "@/lib/data";
import { routes } from "@/lib/navigation";
import { failure, parseForm, success, text, type FormMessage, type FormState } from "@/lib/admin/forms";
import { galleryItemSchema, heroSceneSchema, mediaDetailsSchema, uploadCreditSchema, uploadLicense } from "@/lib/admin/media";
import { assetRef } from "@/lib/media/refs";
import { heroSceneIds, heroSlot, isMediaSlot, pageSlotIds, slotKind } from "@/lib/media/slots";
import { stockSearchSchema, stockSelectionSchema, type StockItem } from "@/lib/media/stock";
import type { HeroClipId } from "@/content/types";
import { db } from "@/lib/server/db";
import { authorize } from "@/lib/server/auth";
import { rateLimit } from "@/lib/server/rate-limit";
import { searchStock, type StockError } from "@/lib/server/stock-media";
import {
  addGalleryItem,
  deleteMediaAsset,
  getMediaAsset,
  removePlacement,
  replaceMediaEverywhere,
  saveStockAsset,
  setMediaStatus,
  setSlots,
  updateMediaDetails,
  type MediaError,
  type SlotEntry,
} from "@/lib/server/media-library";
import { localeFrom, permitted } from "./shared";

/*
 * Media library (`media.manage`, ADMIN only): stock search and saving, asset
 * details and publication, and placing media on the website. Every action
 * checks the permission itself. Changes that reach the site refresh the
 * public media cache.
 */

const bundledIds = mediaRecords.filter((m) => m.src).map((m) => m.id);

function changed(...tags: string[]) {
  for (const tag of [mediaTag, ...tags]) updateTag(tag);
  refresh();
}

const mediaMessage: Partial<Record<MediaError, FormMessage>> = {
  not_found: "notFound",
  in_use: "inUse",
  alt_required: "altRequired",
  not_published: "notPublished",
  wrong_kind: "wrongKind",
  invalid_slot: "invalid",
  invalid_ref: "invalid",
  invalid_file: "invalidFile",
  too_large: "tooLarge",
  storage: "storageUnavailable",
  not_configured: "providerNotConfigured",
  rate_limited: "rateLimited",
  rejected: "providerRejected",
  unavailable: "providerUnavailable",
  blocked: "providerUnavailable",
};

function mediaFailure(error: MediaError, retryAfterSeconds?: number): FormState {
  const state = failure(mediaMessage[error] ?? "generic");
  return retryAfterSeconds && state.status === "error" ? { ...state, detail: { seconds: retryAfterSeconds } } : state;
}

/* ------------------------------------------------------------ Stock search */

export type StockSearchResponse =
  | { ok: true; items: StockItem[]; total: number; hasMore: boolean; page: number }
  | { ok: false; error: StockError | "forbidden" | "invalid"; retryAfterSeconds?: number };

export async function searchStockAction(input: unknown): Promise<StockSearchResponse> {
  const user = await authorize("media.manage");
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = stockSearchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (!rateLimit(`stock-search:${user.id}`, 40, 60_000)) return { ok: false, error: "rate_limited", retryAfterSeconds: 60 };
  const result = await searchStock(parsed.data);
  if (!result.ok) return result;
  return { ok: true, ...result.value, page: parsed.data.page };
}

export type StockSaveResponse =
  | { ok: true; id: string; existing: boolean }
  | { ok: false; error: MediaError | "forbidden" | "invalid"; retryAfterSeconds?: number };

/** Save one search result to the library as a draft. The browser sends only provider, kind and id. */
export async function saveStockAction(input: unknown): Promise<StockSaveResponse> {
  const user = await authorize("media.manage");
  if (!user) return { ok: false, error: "forbidden" };
  const parsed = stockSelectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (!rateLimit(`stock-save:${user.id}`, 30, 10 * 60_000)) return { ok: false, error: "rate_limited", retryAfterSeconds: 600 };
  const result = await saveStockAsset(db, parsed.data, user.id);
  if (!result.ok) return result;
  refresh();
  return { ok: true, ...result.value };
}

/* ------------------------------------------------------------ Asset detail */

export async function updateMediaAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("media.manage", formData);
  if (!user) return failure("forbidden");
  const parsed = parseForm(mediaDetailsSchema, {
    alt: { mn: text(formData, "alt.mn"), en: text(formData, "alt.en") },
    notes: text(formData, "notes"),
  });
  if (!parsed.ok) return parsed.state;
  let credit;
  if (formData.has("rights")) {
    const creditForm = parseForm(uploadCreditSchema, {
      rights: text(formData, "rights"),
      licenseName: text(formData, "licenseName"),
      licenseUrl: text(formData, "licenseUrl"),
      creatorName: text(formData, "creatorName"),
      sourceUrl: text(formData, "sourceUrl"),
    });
    if (!creditForm.ok) return creditForm.state;
    const license = uploadLicense(creditForm.data);
    credit = {
      creatorName: license.creatorName ?? "",
      sourceUrl: license.sourceUrl ?? "",
      licenseName: license.licenseName,
      licenseUrl: license.licenseUrl ?? "",
    };
  }
  const result = await updateMediaDetails(db, text(formData, "id"), { ...parsed.data, credit }, user.id);
  if (!result.ok) return result.error === "alt_required" ? failure("altRequired", { "alt.mn": "required", "alt.en": "required" }) : mediaFailure(result.error);
  changed();
  return success("saved");
}

export async function setMediaStatusAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("media.manage", formData);
  if (!user) return failure("forbidden");
  const status = text(formData, "status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  const result = await setMediaStatus(db, text(formData, "id"), status, user.id);
  if (!result.ok) return mediaFailure(result.error);
  changed(catalogTag);
  if (status === "DRAFT" && result.value.uses > 0) return success("unpublishedInUse", { count: result.value.uses });
  return success(status === "PUBLISHED" ? "published" : "unpublished");
}

export async function deleteMediaAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("media.manage", formData);
  if (!user) return failure("forbidden");
  const result = await deleteMediaAsset(db, text(formData, "id"), user.id);
  if (!result.ok) return mediaFailure(result.error);
  changed();
  redirect(localizedPath(localeFrom(formData), routes.adminMedia));
}

export async function replaceMediaAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("media.manage", formData);
  if (!user) return failure("forbidden");
  const replacement = text(formData, "replacement");
  if (!replacement) return failure("invalid", { replacement: "required" });
  const result = await replaceMediaEverywhere(db, text(formData, "id"), replacement, user.id);
  if (!result.ok) return mediaFailure(result.error);
  changed(catalogTag);
  return success("replaced", { count: result.value.count });
}

/* -------------------------------------------------------------- Placements */

/** From an asset's detail: put it into one website slot (replacing what's there). */
export async function placeMediaAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("media.manage", formData);
  if (!user) return failure("forbidden");
  const slot = text(formData, "slot");
  const asset = await getMediaAsset(db, text(formData, "id"));
  if (!asset) return failure("notFound");
  if (!isMediaSlot(slot) || slot === "gallery") return failure("invalid", { slot: "required" });
  if (slotKind(slot) !== asset.kind) return failure("wrongKind");
  const options = slot.endsWith(".still") ? { focusX: 50, focusY: 50 } : undefined;
  const result = await setSlots(db, [{ slot, ref: assetRef(asset.id), options }], bundledIds, user.id);
  if (!result.ok) return mediaFailure(result.error);
  changed();
  return success("placed");
}

export async function addGalleryItemAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("media.manage", formData);
  if (!user) return failure("forbidden");
  const parsed = parseForm(galleryItemSchema, {
    caption: { mn: text(formData, "caption.mn"), en: text(formData, "caption.en") },
    layout: text(formData, "layout"),
    barberId: text(formData, "barberId"),
  });
  if (!parsed.ok) return parsed.state;
  const result = await addGalleryItem(db, { ref: assetRef(text(formData, "id")), ...parsed.data }, bundledIds, user.id);
  if (!result.ok) return mediaFailure(result.error);
  changed();
  return success("placed");
}

export async function removePlacementAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("media.manage", formData);
  if (!user) return failure("forbidden");
  const result = await removePlacement(db, text(formData, "placementId"), user.id);
  if (!result.ok) return mediaFailure(result.error);
  changed();
  return success("removed");
}

/** Website page: a hero scene's still, video and focal point. Both empty restores the bundled scene. */
export async function saveHeroSceneAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("media.manage", formData);
  if (!user) return failure("forbidden");
  const scene = text(formData, "scene") as HeroClipId;
  if (!heroSceneIds.includes(scene)) return failure("invalid");
  const reset = text(formData, "intent") === "reset";
  const parsed = parseForm(heroSceneSchema, {
    still: reset ? "" : text(formData, "still"),
    video: reset ? "" : text(formData, "video"),
    focusX: text(formData, "focusX") || "50",
    focusY: text(formData, "focusY") || "50",
  });
  if (!parsed.ok) return parsed.state;
  const { still, video, focusX, focusY } = parsed.data;
  const entries: SlotEntry[] = [
    { slot: heroSlot(scene, "still"), ref: still || null, options: { focusX, focusY } },
    { slot: heroSlot(scene, "video"), ref: video || null },
  ];
  const result = await setSlots(db, entries, bundledIds, user.id);
  if (!result.ok) return mediaFailure(result.error);
  changed();
  return success(still || video ? "saved" : "restored");
}

/** Website page: the single images on public pages. Empty restores the bundled default. */
export async function savePageImagesAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await permitted("media.manage", formData);
  if (!user) return failure("forbidden");
  const entries: SlotEntry[] = pageSlotIds.map((slot) => ({ slot, ref: text(formData, slot) || null }));
  const result = await setSlots(db, entries, bundledIds, user.id);
  if (!result.ok) return mediaFailure(result.error);
  changed();
  return success("saved");
}
