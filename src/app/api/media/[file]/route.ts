import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { can } from "@/lib/admin/permissions";
import { mimeTypeOf, parseRange } from "@/lib/media/files";
import { db } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { mediaFilePath } from "@/lib/server/media-storage";

/*
 * GET /api/media/<asset id>.<ext> — a stored media library file (or a video's
 * `.poster.jpg`). Published assets are public; drafts only reach staff who
 * manage media. The name must match an asset row, so nothing else in the
 * storage directory can be read. Supports byte ranges (Safari needs them for
 * video). Files are served as inert media: fixed type, nosniff, sandboxed.
 */

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

async function serve(request: NextRequest, file: string, withBody: boolean) {
  const mimeType = mimeTypeOf(file);
  const path = mediaFilePath(file);
  if (!mimeType || !path) return notFound();

  const id = file.slice(0, file.indexOf("."));
  const asset = await db.mediaAsset.findUnique({ where: { id }, select: { status: true, fileName: true, posterFileName: true, updatedAt: true } });
  if (!asset || (asset.fileName !== file && asset.posterFileName !== file)) return notFound();
  const published = asset.status === "PUBLISHED";
  if (!published) {
    const user = await getCurrentUser();
    if (!user || !can(user, "media.manage")) return notFound();
  }

  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    return notFound();
  }

  const headers = new Headers({
    "Content-Type": mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": published ? "public, max-age=86400" : "private, no-store",
    "Last-Modified": asset.updatedAt.toUTCString(),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Disposition": "inline",
    "Cross-Origin-Resource-Policy": "same-origin",
  });

  const range = parseRange(request.headers.get("range"), size);
  if (range === "invalid") {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  headers.set("Content-Length", String(size === 0 ? 0 : end - start + 1));
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);

  const body = withBody && size > 0 ? (Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream<Uint8Array>) : null;
  return new Response(body, { status: range ? 206 : 200, headers });
}

export async function GET(request: NextRequest, { params }: RouteContext<"/api/media/[file]">) {
  return serve(request, (await params).file, true);
}

export async function HEAD(request: NextRequest, { params }: RouteContext<"/api/media/[file]">) {
  return serve(request, (await params).file, false);
}
