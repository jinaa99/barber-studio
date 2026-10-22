import Image from "next/image";
import { Scissors } from "lucide-react";
import type { Media } from "@/content/types";
import { cn } from "@/lib/cn";

const ratios = {
  "4/5": "aspect-[4/5]",
  "3/4": "aspect-[3/4]",
  "2/3": "aspect-[2/3]",
  "3/2": "aspect-[3/2]",
  "5/4": "aspect-[5/4]",
  "16/10": "aspect-[16/10]",
  "21/9": "aspect-[21/9]",
  "1/1": "aspect-square",
  fill: "h-full",
} as const;

export type PhotoRatio = keyof typeof ratios;

interface PhotoProps {
  media: Media;
  ratio?: PhotoRatio;
  /** Responsive `sizes` hint — always set this to the real rendered width. */
  sizes: string;
  eager?: boolean;
  className?: string;
  imageClassName?: string;
}

/**
 * Art-directed image frame. Crops to a fixed ratio with `object-cover`, shows
 * a blur placeholder while a bundled image loads (library images sit on the
 * stone frame), and falls back to a designed frame when an asset is missing
 * so layouts never collapse.
 */
export function Photo({ media, ratio = "4/5", sizes, eager, className, imageClassName }: PhotoProps) {
  return (
    <div className={cn("relative overflow-hidden bg-stone", ratios[ratio], className)}>
      {media.src ? (
        <Image
          src={media.src}
          alt={media.alt}
          fill
          sizes={sizes}
          placeholder={typeof media.src === "object" ? "blur" : "empty"}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          className={cn("object-cover", imageClassName)}
        />
      ) : (
        <PhotoFallback label={media.alt} />
      )}
    </div>
  );
}

export function PhotoFallback({ label }: { label?: string }) {
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(120%_90%_at_30%_20%,var(--color-stone),var(--color-stone-deep)_70%,var(--color-faint)_160%)]"
    >
      <Scissors aria-hidden className="size-6 text-faint" strokeWidth={1.25} />
    </div>
  );
}
