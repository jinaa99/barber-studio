import { z } from "zod";

/*
 * Validation for the media library's forms and the upload endpoint. Pure and
 * unit-tested; the Server Actions and `app/api/admin/media/upload` are the
 * authority. Refinement messages are `FieldErrorCode`s (see ./forms.ts).
 */

/** Licence recorded for an upload the studio holds the rights to (shown translated in the dashboard). */
export const OWN_MEDIA_LICENSE = "Studio's own media";

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/[^\s<>"]+$/.test(v), "url");

const altText = z.object({ mn: z.string().trim().max(300), en: z.string().trim().max(300) });

export const mediaDetailsSchema = z.object({
  alt: altText,
  notes: z.string().trim().max(1000),
});

export const uploadCreditSchema = z
  .object({
    rights: z.enum(["own", "licensed"]),
    licenseName: z.string().trim().max(120),
    licenseUrl: httpsUrl,
    creatorName: z.string().trim().max(120),
    sourceUrl: httpsUrl,
  })
  .superRefine((v, ctx) => {
    if (v.rights === "licensed" && !v.licenseName) ctx.addIssue({ code: "custom", path: ["licenseName"], message: "required" });
  });

export type UploadCredit = z.output<typeof uploadCreditSchema>;

export const uploadSchema = z
  .object({
    credit: uploadCreditSchema,
    alt: altText,
    notes: z.string().trim().max(1000),
    /** The uploader confirms the studio may use the file on its website. */
    confirmRights: z.literal(true, { error: "required" }),
  });

/** Licence fields as stored for an upload. */
export function uploadLicense(credit: UploadCredit) {
  return credit.rights === "own"
    ? { licenseName: OWN_MEDIA_LICENSE, licenseUrl: null, creatorName: credit.creatorName || null, sourceUrl: credit.sourceUrl || null }
    : {
        licenseName: credit.licenseName,
        licenseUrl: credit.licenseUrl || null,
        creatorName: credit.creatorName || null,
        sourceUrl: credit.sourceUrl || null,
      };
}

export const galleryItemSchema = z.object({
  caption: z.object({ mn: z.string().trim().min(1).max(80), en: z.string().trim().min(1).max(80) }),
  layout: z.enum(["portrait", "landscape"]),
  barberId: z.string().trim().max(64),
});

export const heroSceneSchema = z.object({
  still: z.string().max(80),
  video: z.string().max(80),
  focusX: z.coerce.number().int("invalid").min(0, "range").max(100, "range"),
  focusY: z.coerce.number().int("invalid").min(0, "range").max(100, "range"),
});

/** Seconds as m:ss. */
export function formatClipLength(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "";
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
