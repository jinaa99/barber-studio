import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mimeTypeOf, parseRange, sniffMediaType, STORED_FILE } from "./files";
import { assetRef, parseMediaRef } from "./refs";
import { acceptsBundled, heroSlot, isSingleSlot, resolveGalleryOptions, resolveHeroOptions, slotKind } from "./slots";
import { formatClipLength, uploadLicense, uploadSchema, OWN_MEDIA_LICENSE } from "@/lib/admin/media";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array([...values.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v])), ...new Array(16).fill(0)]);

describe("media references", () => {
  it("parses bundled ids and library assets", () => {
    assert.deepEqual(parseMediaRef("studio-interior"), { type: "bundled", id: "studio-interior" });
    assert.deepEqual(parseMediaRef(assetRef("0f3c9a2b7d1e4c5f8a6b9c0d1e2f3a4b")), { type: "asset", id: "0f3c9a2b7d1e4c5f8a6b9c0d1e2f3a4b" });
    for (const bad of ["", "asset:", "asset:../x", "Studio", "a/b", "asset:ABC12345", "studio--x"]) {
      assert.equal(parseMediaRef(bad), null, bad);
    }
  });
});

describe("website slots", () => {
  it("knows the kind of every slot", () => {
    assert.equal(slotKind("home.intro"), "IMAGE");
    assert.equal(slotKind("gallery"), "IMAGE");
    assert.equal(slotKind(heroSlot("arrival", "video")), "VIDEO");
    assert.equal(slotKind(heroSlot("result", "still")), "IMAGE");
    assert.equal(slotKind("hero.lobby.video"), null);
    assert.equal(slotKind("toString"), null);
    assert.equal(slotKind("home"), null);
  });

  it("keeps bundled photos out of video slots and lets only the gallery hold many", () => {
    assert.equal(acceptsBundled("home.visit"), true);
    assert.equal(acceptsBundled(heroSlot("craft", "video")), false);
    assert.equal(isSingleSlot("gallery"), false);
    assert.equal(isSingleSlot("visit.cover"), true);
  });

  it("falls back for bad stored options", () => {
    assert.deepEqual(resolveHeroOptions({ focusX: 30, focusY: 70 }), { focusX: 30, focusY: 70 });
    assert.equal(resolveHeroOptions({ focusX: 300, focusY: 0 }), null);
    assert.equal(resolveHeroOptions(null), null);
    assert.deepEqual(resolveGalleryOptions({ layout: "diagonal" }), { layout: "portrait" });
    assert.deepEqual(resolveGalleryOptions({ layout: "landscape", barberId: "temuulen" }), { layout: "landscape", barberId: "temuulen" });
  });
});

describe("media files", () => {
  it("decides the type from the first bytes", () => {
    assert.deepEqual(sniffMediaType(bytes(0xff, 0xd8, 0xff, 0xe0)), { kind: "IMAGE", format: "jpeg" });
    assert.deepEqual(sniffMediaType(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a)), { kind: "IMAGE", format: "png" });
    assert.deepEqual(sniffMediaType(bytes("RIFF", 0, 0, 0, 0, "WEBP")), { kind: "IMAGE", format: "webp" });
    assert.deepEqual(sniffMediaType(bytes(0, 0, 0, 0x20, "ftyp", "isom")), { kind: "VIDEO", mimeType: "video/mp4", extension: "mp4" });
    assert.deepEqual(sniffMediaType(bytes(0, 0, 0, 0x20, "ftyp", "avif")), { kind: "IMAGE", format: "avif" });
    assert.deepEqual(sniffMediaType(bytes(0x1a, 0x45, 0xdf, 0xa3)), { kind: "VIDEO", mimeType: "video/webm", extension: "webm" });
    assert.equal(sniffMediaType(bytes(0, 0, 0, 0x20, "ftyp", "qt  ")), null);
    assert.equal(sniffMediaType(bytes("<svg xmlns")), null);
    assert.equal(sniffMediaType(bytes("<!doctype html>")), null);
    assert.equal(sniffMediaType(bytes("GIF89a")), null);
    assert.equal(sniffMediaType(new Uint8Array([0xff, 0xd8])), null);
  });

  it("serves only generated file names", () => {
    assert.equal(STORED_FILE.test("0f3c9a2b7d1e4c5f.jpg"), true);
    assert.equal(STORED_FILE.test("0f3c9a2b7d1e4c5f.poster.jpg"), true);
    assert.equal(mimeTypeOf("0f3c9a2b7d1e4c5f.webm"), "video/webm");
    for (const bad of ["../0f3c9a2b7d1e4c5f.jpg", "0f3c9a2b7d1e4c5f.svg", "0f3c9a2b7d1e4c5f.html", "0f3c9a2b7d1e4c5f.jpg.tmp", ".env", "x.jpg"]) {
      assert.equal(mimeTypeOf(bad), null, bad);
    }
  });

  it("parses byte ranges", () => {
    assert.equal(parseRange(null, 100), null);
    assert.deepEqual(parseRange("bytes=0-", 100), { start: 0, end: 99 });
    assert.deepEqual(parseRange("bytes=10-19", 100), { start: 10, end: 19 });
    assert.deepEqual(parseRange("bytes=90-500", 100), { start: 90, end: 99 });
    assert.deepEqual(parseRange("bytes=-10", 100), { start: 90, end: 99 });
    assert.equal(parseRange("bytes=100-", 100), "invalid");
    assert.equal(parseRange("bytes=5-1", 100), "invalid");
    assert.equal(parseRange("bytes=0-1,5-6", 100), "invalid");
    assert.equal(parseRange("items=0-1", 100), "invalid");
  });
});

describe("upload form", () => {
  const valid = {
    credit: { rights: "own", licenseName: "", licenseUrl: "", creatorName: "", sourceUrl: "" },
    alt: { mn: "", en: "" },
    notes: "",
    confirmRights: true,
  };

  it("needs the rights confirmation and a licence name for licensed media", () => {
    assert.equal(uploadSchema.safeParse(valid).success, true);
    assert.equal(uploadSchema.safeParse({ ...valid, confirmRights: false }).success, false);
    assert.equal(uploadSchema.safeParse({ ...valid, credit: { ...valid.credit, rights: "licensed" } }).success, false);
    assert.equal(uploadSchema.safeParse({ ...valid, credit: { ...valid.credit, sourceUrl: "javascript:alert(1)" } }).success, false);
  });

  it("records what was entered, never more", () => {
    assert.deepEqual(uploadLicense({ rights: "own", licenseName: "ignored", licenseUrl: "", creatorName: "", sourceUrl: "" }), {
      licenseName: OWN_MEDIA_LICENSE,
      licenseUrl: null,
      creatorName: null,
      sourceUrl: null,
    });
    assert.deepEqual(
      uploadLicense({ rights: "licensed", licenseName: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", creatorName: "A. Bat", sourceUrl: "" }),
      { licenseName: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/", creatorName: "A. Bat", sourceUrl: null },
    );
  });

  it("formats clip lengths", () => {
    assert.equal(formatClipLength(14), "0:14");
    assert.equal(formatClipLength(75.6), "1:16");
    assert.equal(formatClipLength(null), "");
  });
});
