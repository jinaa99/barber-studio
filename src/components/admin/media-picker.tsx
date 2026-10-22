import Image, { type StaticImageData } from "next/image";
import type { ReactNode } from "react";
import type { Locale, LocalizedText } from "@/i18n/config";
import { mediaRecords } from "@/content/media";
import { assetRef, mediaFileUrl } from "@/lib/media/refs";
import { cn } from "@/lib/cn";
import { db } from "@/lib/server/db";
import { listPublishedAssets } from "@/lib/server/media-library";

/*
 * Choosing media in dashboard forms: a radio grid of the published library
 * assets (newest first) and, for image slots, the bundled photos. The value
 * is a media reference (`lib/media/refs.ts`). Works without JavaScript.
 */

export interface MediaChoice {
  ref: string;
  src: StaticImageData | string | null;
  alt: string;
  library: boolean;
}

export async function mediaChoices(locale: Locale, kind: "IMAGE" | "VIDEO"): Promise<MediaChoice[]> {
  const assets = await listPublishedAssets(db, kind);
  const library = assets.map((a) => {
    const file = a.kind === "IMAGE" ? a.fileName : a.posterFileName;
    const alt = a.alt as Partial<LocalizedText> | null;
    return { ref: assetRef(a.id), src: file ? mediaFileUrl(file) : null, alt: alt?.[locale] || alt?.en || "", library: true };
  });
  if (kind === "VIDEO") return library;
  return [...library, ...mediaRecords.map((m) => ({ ref: m.id, src: m.src, alt: m.alt[locale], library: false }))];
}

/**
 * A thumbnail for a bundled or library image. Library files are loaded
 * directly (not through the image optimizer) so drafts, which need the staff
 * session, preview too.
 */
export function MediaThumb({ src, alt, sizes, fit = "cover" }: { src: StaticImageData | string | null; alt: string; sizes: string; fit?: "cover" | "contain" }) {
  if (!src) return <span className="absolute inset-0 bg-paper-deep" />;
  const className = fit === "cover" ? "object-cover" : "object-contain";
  return typeof src === "string" ? (
    <Image src={src} alt={alt} fill sizes={sizes} unoptimized className={className} />
  ) : (
    <Image src={src} alt={alt} fill sizes={sizes} placeholder="blur" className={className} />
  );
}

export function MediaPicker({
  name,
  legend,
  hint,
  choices,
  defaultValue,
  none,
  libraryLabel,
  ratio = "portrait",
  children,
}: {
  name: string;
  legend: ReactNode;
  hint?: ReactNode;
  choices: MediaChoice[];
  defaultValue?: string;
  /** Label of an extra "nothing chosen" option (value ""), e.g. "Default". */
  none?: string;
  libraryLabel: string;
  ratio?: "portrait" | "landscape";
  /** Rendered under the grid, e.g. a group error. */
  children?: ReactNode;
}) {
  const frame = ratio === "portrait" ? "aspect-[4/5]" : "aspect-video";
  const tile =
    "relative block overflow-hidden border-2 bg-paper-deep peer-checked:border-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brass";
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold">{legend}</legend>
      {hint && <p className="mt-1 text-xs leading-relaxed text-taupe-deep">{hint}</p>}
      <div className="mt-3 max-h-[26rem] overflow-y-auto overscroll-contain pr-1">
        <div className={cn("grid gap-3", ratio === "portrait" ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-4")}>
          {none !== undefined && (
            <label className="relative block cursor-pointer">
              <input type="radio" name={name} value="" defaultChecked={!defaultValue} className="peer sr-only" />
              <span className={cn(tile, frame, "flex items-center justify-center border-dashed border-line-strong p-2 text-center text-xs text-taupe-deep")}>
                {none}
              </span>
            </label>
          )}
          {choices.map((c) => (
            <label key={c.ref} className="relative block cursor-pointer">
              <input type="radio" name={name} value={c.ref} defaultChecked={defaultValue === c.ref} className="peer sr-only" />
              <span className={cn(tile, frame, "border-transparent")}>
                <MediaThumb src={c.src} alt={c.alt} sizes="120px" />
                {c.library && (
                  <span className="absolute left-1 top-1 rounded-full bg-ink/80 px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wide text-paper uppercase">
                    {libraryLabel}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>
      {children}
    </fieldset>
  );
}
