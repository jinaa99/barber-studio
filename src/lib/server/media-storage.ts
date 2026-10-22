import "server-only";
import { constants } from "node:fs";
import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { IMAGE_MAX_EDGE, STORED_FILE } from "@/lib/media/files";

/*
 * Files of the media library: stock assets downloaded when saved, and staff
 * uploads. They live in one directory (`MEDIA_STORAGE_DIR`, default
 * `storage/media`) outside `public/`, and are served only through
 * `app/api/media/[file]`, which checks the database first. File names are
 * generated here (`<asset id>.<ext>`), never taken from a request.
 *
 * The directory must persist between deploys and be shared by every server
 * instance (a mounted volume). See docs/MEDIA.md.
 */

// Paths are runtime data, not build inputs: `turbopackIgnore` keeps the bundler from tracing the project.
export function mediaStorageDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.MEDIA_STORAGE_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "media"));
}

function storedPath(fileName: string): string {
  if (!STORED_FILE.test(fileName)) throw new Error(`Refusing unexpected media file name: ${fileName}`);
  return path.join(/*turbopackIgnore: true*/ mediaStorageDir(), fileName);
}

export function mediaFilePath(fileName: string): string | null {
  return STORED_FILE.test(fileName) ? path.join(/*turbopackIgnore: true*/ mediaStorageDir(), fileName) : null;
}

/** Whether new files can be written (shown in the dashboard instead of failing on save). */
export async function storageWritable(): Promise<boolean> {
  try {
    await mkdir(mediaStorageDir(), { recursive: true });
    await access(mediaStorageDir(), constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/** Write atomically: a partly written file is never served. */
export async function writeStoredFile(fileName: string, data: Uint8Array): Promise<void> {
  const target = storedPath(fileName);
  await mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temp, data, { flag: "wx" });
  await rename(temp, target);
}

export async function removeStoredFile(fileName: string | null | undefined): Promise<void> {
  if (!fileName) return;
  await rm(storedPath(fileName), { force: true });
}

/**
 * Decode and re-encode an image as a baseline JPEG: applies the EXIF
 * orientation, drops every metadata block (location, camera, embedded
 * profiles), flattens transparency onto the paper colour and caps the size.
 * Anything that doesn't decode as an image is rejected here.
 */
export async function processImage(input: Uint8Array): Promise<{ data: Buffer; width: number; height: number } | null> {
  try {
    const { data, info } = await sharp(input, { limitInputPixels: 120_000_000, failOn: "error" })
      .rotate()
      .resize({ width: IMAGE_MAX_EDGE, height: IMAGE_MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#f3efe7" })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch {
    return null;
  }
}
