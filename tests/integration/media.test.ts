import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { assetRef } from "@/lib/media/refs";
import { heroSlot } from "@/lib/media/slots";
import { createStaffUser } from "@/lib/server/accounts";
import {
  addGalleryItem,
  createUploadedAsset,
  deleteMediaAsset,
  mediaUsages,
  readWebsiteMedia,
  replaceMediaEverywhere,
  saveStockAsset,
  setMediaStatus,
  setSlots,
  updateMediaDetails,
  type UploadInput,
} from "@/lib/server/media-library";
import { createTestClient, resetDatabase, seedFixtures } from "./helpers";

const db = createTestClient();
const bundled = ["studio-interior", "studio-chair"];
let storage = "";
let actorId = "";

before(async () => {
  storage = await mkdtemp(path.join(tmpdir(), "studio08-media-"));
  process.env.MEDIA_STORAGE_DIR = storage;
});
after(async () => {
  await db.$disconnect();
  await rm(storage, { recursive: true, force: true });
});

beforeEach(async () => {
  await resetDatabase(db);
  await seedFixtures(db);
  actorId = (await createStaffUser(db, { email: "owner@studio.test", name: "Owner", password: "a long enough password", role: "ADMIN" })).id;
  delete process.env.PEXELS_API_KEY;
  delete process.env.PIXABAY_API_KEY;
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

async function jpeg(width = 64, height = 48, withExif = false) {
  const image = sharp({ create: { width, height, channels: 3, background: { r: 120, g: 90, b: 60 } } }).jpeg();
  return new Uint8Array(await (withExif ? image.withExif({ IFD0: { Copyright: "Someone", Artist: "Camera owner" } }) : image).toBuffer());
}

const mp4 = () => new Uint8Array([0, 0, 0, 0x20, ...Buffer.from("ftypisom"), ...new Array(64).fill(1)]);

const upload = (bytes: Uint8Array, over: Partial<UploadInput> = {}): UploadInput => ({
  bytes,
  licenseName: "Studio's own media",
  licenseUrl: null,
  creatorName: null,
  sourceUrl: null,
  alt: { mn: "Студийн сандал", en: "The studio chair" },
  notes: null,
  ...over,
});

async function publishedImage(alt = { mn: "Зураг", en: "Photo" }) {
  const result = await createUploadedAsset(db, upload(await jpeg(), { alt }), actorId);
  assert.ok(result.ok);
  const status = await setMediaStatus(db, result.value.id, "PUBLISHED", actorId);
  assert.ok(status.ok);
  return result.value.id;
}

describe("media library uploads", () => {
  it("re-encodes images, strips metadata and stores a draft", async () => {
    const result = await createUploadedAsset(db, upload(await jpeg(3000, 2000, true)), actorId);
    assert.ok(result.ok);
    const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id: result.value.id } });
    assert.equal(asset.status, "DRAFT");
    assert.equal(asset.kind, "IMAGE");
    assert.equal(asset.mimeType, "image/jpeg");
    assert.equal(asset.width, 2560, "long edge capped");
    assert.equal(asset.source, "UPLOAD");
    const meta = await sharp(path.join(storage, asset.fileName)).metadata();
    assert.equal(meta.exif, undefined, "EXIF removed");
    assert.equal(await db.auditLog.count({ where: { action: "media.uploaded", entityId: asset.id } }), 1);
  });

  it("rejects files that aren't images or supported videos", async () => {
    const filesBefore = (await readdir(storage)).length;
    for (const body of ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "<!doctype html><p>hi", "GIF89a......"]) {
      const result = await createUploadedAsset(db, upload(new TextEncoder().encode(body)), actorId);
      assert.deepEqual(result, { ok: false, error: "invalid_file" });
    }
    // A JPEG header on bytes that don't decode.
    const fake = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(40).fill(7)]);
    assert.deepEqual(await createUploadedAsset(db, upload(fake), actorId), { ok: false, error: "invalid_file" });
    assert.equal(await db.mediaAsset.count(), 0);
    assert.equal((await readdir(storage)).length, filesBefore, "nothing written");
  });

  it("stores MP4 video as received", async () => {
    const result = await createUploadedAsset(db, upload(mp4()), actorId);
    assert.ok(result.ok);
    const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id: result.value.id } });
    assert.equal(asset.kind, "VIDEO");
    assert.equal(asset.fileName, `${asset.id}.mp4`);
    assert.equal(asset.posterFileName, null);
  });
});

describe("publishing", () => {
  it("needs alt text in both languages", async () => {
    const result = await createUploadedAsset(db, upload(await jpeg(), { alt: { mn: "", en: "Chair" } }), actorId);
    assert.ok(result.ok);
    const id = result.value.id;
    assert.deepEqual(await setMediaStatus(db, id, "PUBLISHED", actorId), { ok: false, error: "alt_required" });
    assert.ok((await updateMediaDetails(db, id, { alt: { mn: "Сандал", en: "Chair" }, notes: "" }, actorId)).ok);
    assert.ok((await setMediaStatus(db, id, "PUBLISHED", actorId)).ok);
    // A published asset can't lose its alt text.
    assert.deepEqual(await updateMediaDetails(db, id, { alt: { mn: "", en: "Chair" }, notes: "" }, actorId), { ok: false, error: "alt_required" });
  });

  it("only exposes published assets to the site", async () => {
    const published = await publishedImage();
    const draft = await createUploadedAsset(db, upload(await jpeg()), actorId);
    assert.ok(draft.ok);
    const media = await readWebsiteMedia(db);
    assert.deepEqual(media.assets.map((a) => a.id), [published]);
  });
});

describe("placing media", () => {
  it("validates slot kind, publication and bundled ids", async () => {
    const image = await publishedImage();
    const video = await createUploadedAsset(db, upload(mp4()), actorId);
    assert.ok(video.ok);

    assert.deepEqual(await setSlots(db, [{ slot: heroSlot("arrival", "video"), ref: assetRef(video.value.id) }], bundled, actorId), {
      ok: false,
      error: "not_published",
    });
    assert.deepEqual(await setSlots(db, [{ slot: heroSlot("arrival", "video"), ref: assetRef(image) }], bundled, actorId), { ok: false, error: "wrong_kind" });
    assert.deepEqual(await setSlots(db, [{ slot: heroSlot("arrival", "video"), ref: "studio-interior" }], bundled, actorId), { ok: false, error: "invalid_ref" });
    assert.deepEqual(await setSlots(db, [{ slot: "home.intro", ref: "not-bundled" }], bundled, actorId), { ok: false, error: "invalid_ref" });
    assert.deepEqual(await setSlots(db, [{ slot: "home.lobby", ref: "studio-interior" }], bundled, actorId), { ok: false, error: "invalid_slot" });
    assert.deepEqual(await setSlots(db, [{ slot: "gallery", ref: assetRef(image) }], bundled, actorId), { ok: false, error: "invalid_slot" });
    assert.ok((await setSlots(db, [{ slot: "home.intro", ref: "studio-chair" }], bundled, actorId)).ok);
  });

  it("keeps one item per slot and rolls back a partly invalid change", async () => {
    const first = await publishedImage();
    const second = await publishedImage();
    assert.ok((await setSlots(db, [{ slot: "home.intro", ref: assetRef(first) }], bundled, actorId)).ok);
    assert.ok((await setSlots(db, [{ slot: "home.intro", ref: assetRef(second) }], bundled, actorId)).ok);
    const rows = await db.mediaPlacement.findMany({ where: { slot: "home.intro" } });
    assert.deepEqual(rows.map((r) => r.ref), [assetRef(second)]);

    const result = await setSlots(
      db,
      [
        { slot: "home.visit", ref: assetRef(first) },
        { slot: "visit.cover", ref: "missing-photo" },
      ],
      bundled,
      actorId,
    );
    assert.deepEqual(result, { ok: false, error: "invalid_ref" });
    assert.equal(await db.mediaPlacement.count({ where: { slot: "home.visit" } }), 0, "first entry rolled back");

    // The database refuses a second row for a single slot even without the service.
    await assert.rejects(db.mediaPlacement.create({ data: { slot: "home.intro", ref: "studio-chair" } }));

    assert.ok((await setSlots(db, [{ slot: "home.intro", ref: null }], bundled, actorId)).ok);
    assert.equal(await db.mediaPlacement.count({ where: { slot: "home.intro" } }), 0);
  });

  it("adds gallery items with captions in order", async () => {
    const image = await publishedImage();
    const caption = { mn: "Шинэ ажил", en: "New work" };
    assert.deepEqual(await addGalleryItem(db, { ref: assetRef(image), caption: { mn: "", en: "x" }, layout: "portrait" }, bundled, actorId), {
      ok: false,
      error: "invalid_slot",
    });
    assert.deepEqual(await addGalleryItem(db, { ref: assetRef(image), caption, layout: "portrait", barberId: "nobody" }, bundled, actorId), {
      ok: false,
      error: "invalid_ref",
    });
    const a = await addGalleryItem(db, { ref: assetRef(image), caption, layout: "portrait", barberId: "a" }, bundled, actorId);
    const b = await addGalleryItem(db, { ref: "studio-chair", caption, layout: "landscape" }, bundled, actorId);
    assert.ok(a.ok && b.ok);
    const rows = await db.mediaPlacement.findMany({ where: { slot: "gallery" }, orderBy: { position: "asc" } });
    assert.deepEqual(rows.map((r) => r.id), [a.value.id, b.value.id]);
    assert.deepEqual(rows[0].options, { layout: "portrait", barberId: "a" });
  });
});

describe("removing and replacing", () => {
  it("won't delete an asset in use, replaces it everywhere, then deletes its files", async () => {
    const old = await publishedImage();
    const replacement = await publishedImage();
    await setSlots(db, [{ slot: "home.intro", ref: assetRef(old) }], bundled, actorId);
    await addGalleryItem(db, { ref: assetRef(old), caption: { mn: "А", en: "A" }, layout: "portrait" }, bundled, actorId);
    await db.barber.update({ where: { id: "a" }, data: { imageId: assetRef(old) } });

    assert.deepEqual(await deleteMediaAsset(db, old, actorId), { ok: false, error: "in_use" });

    const draft = await createUploadedAsset(db, upload(await jpeg()), actorId);
    assert.ok(draft.ok);
    assert.deepEqual(await replaceMediaEverywhere(db, old, draft.value.id, actorId), { ok: false, error: "not_published" });
    const video = await createUploadedAsset(db, upload(mp4()), actorId);
    assert.ok(video.ok);
    await setMediaStatus(db, video.value.id, "PUBLISHED", actorId);
    assert.deepEqual(await replaceMediaEverywhere(db, old, video.value.id, actorId), { ok: false, error: "wrong_kind" });

    assert.deepEqual(await replaceMediaEverywhere(db, old, replacement, actorId), { ok: true, value: { count: 3 } });
    const usages = await mediaUsages(db, assetRef(replacement));
    assert.equal(usages.placements.length, 2);
    assert.deepEqual(usages.barbers.map((b) => b.id), ["a"]);

    const file = (await db.mediaAsset.findUniqueOrThrow({ where: { id: old } })).fileName;
    assert.equal(existsSync(path.join(storage, file)), true);
    assert.ok((await deleteMediaAsset(db, old, actorId)).ok);
    assert.equal(existsSync(path.join(storage, file)), false);
    assert.equal(await db.auditLog.count({ where: { action: "media.deleted" } }), 1);
  });

  it("unpublishing keeps placements but hides the asset from the site", async () => {
    const id = await publishedImage();
    await setSlots(db, [{ slot: "home.intro", ref: assetRef(id) }], bundled, actorId);
    assert.deepEqual(await setMediaStatus(db, id, "DRAFT", actorId), { ok: true, value: { uses: 1 } });
    const media = await readWebsiteMedia(db);
    assert.equal(media.placements.length, 1);
    assert.equal(media.assets.length, 0);
  });
});

describe("saving stock media", () => {
  const photo = {
    id: 3998429,
    width: 4000,
    height: 3000,
    url: "https://www.pexels.com/photo/barber-3998429/",
    photographer: "Jane Doe",
    photographer_url: "https://www.pexels.com/@jane",
    alt: "Barber at work",
    src: {
      original: "https://images.pexels.com/photos/3998429/original.jpeg",
      large: "https://images.pexels.com/photos/3998429/large.jpeg",
      medium: "https://images.pexels.com/photos/3998429/medium.jpeg",
    },
  };

  /** Stand-in for the Pexels API and CDN; records every URL requested. */
  function stubPexels(body: unknown, image: Uint8Array, requested: string[]) {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      requested.push(url);
      if (url.startsWith("https://api.pexels.com/")) {
        assert.equal((init?.headers as Record<string, string>).Authorization, "test-key");
        return Response.json(body);
      }
      if (url.startsWith("https://images.pexels.com/")) return new Response(Buffer.from(image), { headers: { "Content-Type": "image/jpeg" } });
      return new Response("unexpected host", { status: 599 });
    }) as typeof fetch;
  }

  it("reports a missing API key instead of failing", async () => {
    assert.deepEqual(await saveStockAsset(db, { provider: "pexels", kind: "photo", id: "1" }, actorId), { ok: false, error: "not_configured" });
  });

  it("looks the asset up again, downloads from the provider host and records its credits", async () => {
    process.env.PEXELS_API_KEY = "test-key";
    const requested: string[] = [];
    stubPexels(photo, await jpeg(800, 600), requested);
    const result = await saveStockAsset(db, { provider: "pexels", kind: "photo", id: "3998429" }, actorId);
    assert.ok(result.ok);
    assert.equal(result.value.existing, false);
    assert.deepEqual(requested, ["https://api.pexels.com/v1/photos/3998429", "https://images.pexels.com/photos/3998429/original.jpeg"]);
    const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id: result.value.id } });
    assert.equal(asset.source, "PEXELS");
    assert.equal(asset.providerAssetId, "3998429");
    assert.equal(asset.creatorName, "Jane Doe");
    assert.equal(asset.creatorUrl, "https://www.pexels.com/@jane");
    assert.equal(asset.sourceUrl, photo.url);
    assert.equal(asset.licenseName, "Pexels License");
    assert.equal(asset.licenseUrl, "https://www.pexels.com/license/");
    assert.deepEqual(asset.alt, { mn: "", en: "Barber at work" });
    assert.equal(asset.status, "DRAFT");

    const again = await saveStockAsset(db, { provider: "pexels", kind: "photo", id: "3998429" }, actorId);
    assert.deepEqual(again, { ok: true, value: { id: result.value.id, existing: true } });
    assert.equal(await db.mediaAsset.count(), 1);
  });

  it("never downloads from a host the provider doesn't own", async () => {
    process.env.PEXELS_API_KEY = "test-key";
    const requested: string[] = [];
    const tampered = { ...photo, id: 7, src: { ...photo.src, original: "http://169.254.169.254/latest/meta-data/" } };
    stubPexels(tampered, await jpeg(), requested);
    assert.deepEqual(await saveStockAsset(db, { provider: "pexels", kind: "photo", id: "7" }, actorId), { ok: false, error: "not_found" });
    assert.deepEqual(requested, ["https://api.pexels.com/v1/photos/7"]);
  });

  it("refuses a download that isn't an image", async () => {
    process.env.PEXELS_API_KEY = "test-key";
    stubPexels({ ...photo, id: 8 }, new TextEncoder().encode("<html>not an image</html>"), []);
    assert.deepEqual(await saveStockAsset(db, { provider: "pexels", kind: "photo", id: "8" }, actorId), { ok: false, error: "invalid_file" });
    assert.equal(await db.mediaAsset.count(), 0);
  });
});
