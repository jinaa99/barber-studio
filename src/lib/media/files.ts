/*
 * File types the media library stores. Types are decided from the file's
 * first bytes, never from a name, a browser-supplied type or a provider's
 * header. Images are always re-encoded on the server (see
 * `lib/server/media-storage.ts`), so only these video containers are stored
 * as received.
 */

export const IMAGE_MAX_BYTES = 25 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 80 * 1024 * 1024;
/** Long edge of stored images. */
export const IMAGE_MAX_EDGE = 2560;

export type SniffedType =
  | { kind: "IMAGE"; format: "jpeg" | "png" | "webp" | "avif" }
  | { kind: "VIDEO"; mimeType: "video/mp4" | "video/webm"; extension: "mp4" | "webm" };

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

export function sniffMediaType(bytes: Uint8Array): SniffedType | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { kind: "IMAGE", format: "jpeg" };
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG" && bytes[4] === 0x0d && bytes[5] === 0x0a) return { kind: "IMAGE", format: "png" };
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return { kind: "IMAGE", format: "webp" };
  if (ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (brand === "avif" || brand === "avis") return { kind: "IMAGE", format: "avif" };
    // ISO base media (MP4 family). QuickTime ("qt  ") and HEIF stills are not accepted.
    if (["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "dash", "M4V "].includes(brand)) {
      return { kind: "VIDEO", mimeType: "video/mp4", extension: "mp4" };
    }
    return null;
  }
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { kind: "VIDEO", mimeType: "video/webm", extension: "webm" };
  }
  return null;
}

/** Stored file names: `<asset id>.<ext>` or `<asset id>.poster.jpg`. Nothing else is ever served. */
export const STORED_FILE = /^[a-z0-9]{8,40}(\.poster)?\.(jpg|mp4|webm)$/;

export const storedMimeTypes: Record<string, string> = {
  jpg: "image/jpeg",
  mp4: "video/mp4",
  webm: "video/webm",
};

export function mimeTypeOf(fileName: string): string | null {
  if (!STORED_FILE.test(fileName)) return null;
  return storedMimeTypes[fileName.slice(fileName.lastIndexOf(".") + 1)] ?? null;
}

/** Parse a single `Range: bytes=…` header against a file of `size` bytes. */
export function parseRange(header: string | null, size: number): { start: number; end: number } | "invalid" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return "invalid";
  let start: number;
  let end: number;
  if (match[1] === "") {
    // Suffix range: the last N bytes.
    const length = Number(match[2]);
    if (length === 0) return "invalid";
    start = Math.max(0, size - length);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start > end || start >= size) return "invalid";
  return { start, end };
}
