import type { NextRequest } from "next/server";
import { can } from "@/lib/admin/permissions";
import { fieldErrors } from "@/lib/admin/forms";
import { uploadLicense, uploadSchema } from "@/lib/admin/media";
import { VIDEO_MAX_BYTES } from "@/lib/media/files";
import { db } from "@/lib/server/db";
import { getCurrentUser } from "@/lib/server/auth";
import { createUploadedAsset } from "@/lib/server/media-library";
import { isSameOrigin } from "@/lib/server/origin";
import { rateLimit } from "@/lib/server/rate-limit";

/*
 * POST /api/admin/media/upload (multipart) — a staff upload to the media
 * library, saved as a draft. A route handler rather than a Server Action so
 * the large body limit applies to this endpoint only. Same-origin requests
 * from a signed-in user with `media.manage` only. The file's type is decided
 * from its bytes; images are re-encoded, videos must be MP4 or WebM.
 */

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  // The browser's Origin must be this site (the session cookie is SameSite=Lax as well).
  if (!isSameOrigin(request.headers)) return json({ ok: false, error: "forbidden" }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ ok: false, error: "unauthenticated" }, 401);
  if (!can(user, "media.manage")) return json({ ok: false, error: "forbidden" }, 403);
  if (!rateLimit(`media-upload:${user.id}`, 30, 10 * 60_000)) return json({ ok: false, error: "rate_limited" }, 429);

  // Browsers always declare the length of a FormData body; without it the body size is unbounded.
  const declared = Number(request.headers.get("content-length") ?? NaN);
  if (!Number.isFinite(declared)) return json({ ok: false, error: "invalid_file" }, 411);
  if (declared > VIDEO_MAX_BYTES + 64 * 1024) return json({ ok: false, error: "too_large" }, 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "invalid_file" }, 400);
  }
  const value = (name: string) => {
    const v = form.get(name);
    return typeof v === "string" ? v : "";
  };
  const parsed = uploadSchema.safeParse({
    credit: {
      rights: value("rights"),
      licenseName: value("licenseName"),
      licenseUrl: value("licenseUrl"),
      creatorName: value("creatorName"),
      sourceUrl: value("sourceUrl"),
    },
    alt: { mn: value("alt.mn"), en: value("alt.en") },
    notes: value("notes"),
    confirmRights: value("confirmRights") === "on",
  });
  if (!parsed.success) return json({ ok: false, error: "invalid", fields: fieldErrors(parsed.error) }, 400);

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return json({ ok: false, error: "invalid", fields: { file: "required" } }, 400);
  if (file.size > VIDEO_MAX_BYTES) return json({ ok: false, error: "too_large" }, 413);

  const result = await createUploadedAsset(
    db,
    { bytes: new Uint8Array(await file.arrayBuffer()), ...uploadLicense(parsed.data.credit), alt: parsed.data.alt, notes: parsed.data.notes || null },
    user.id,
  );
  if (!result.ok) return json({ ok: false, error: result.error }, result.error === "storage" ? 503 : 400);
  return json({ ok: true, id: result.value.id });
}
