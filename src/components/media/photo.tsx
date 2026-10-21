import Image from "next/image";
import { Scissors } from "lucide-react";
import type { Media } from "@/content/types";
import { cn } from "@/lib/cn";

const ratios = {
  "4/5": "aspect-[4/5]",
  "3/4": "aspect-[3/4]",
  "2/3": "aspect-[2/3]",
  "3/2": "aspect-[3/2]",
  "16/10": "aspect-[16/10]",
  "1/1": "aspect-square",
  fill: "h-full",
} as const;

interface PhotoProps {
  media: Media;
  ratio?: keyof typeof ratios;
  /** Responsive `sizes` hint — always set this to the real rendered width. */
  sizes: string;
  eager?: boolean;
  className?: string;
  imageClassName?: string;
}

/**
 * Art-directed image frame. Crops to a fixed ratio with `object-cover`, shows
 * a blur placeholder while loading, and falls back to a designed frame when an
 * asset is missing so layouts never collapse.
 */
export function Photo({ media, ratio = "4/5", sizes, eager, className, imageClassName }: PhotoProps) {
  return (
    <div className={cn("relative overflow-hidden bg-paper-deep", ratios[ratio], className)}>
      {media.src ? (
        <Image
          src={media.src}
          alt={media.alt}
          fill
          sizes={sizes}
          placeholder="blur"
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
      className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(120%_90%_at_30%_20%,var(--color-sand),var(--color-paper-deep)_55%,var(--color-taupe)_140%)]"
    >
      <Scissors aria-hidden className="size-6 text-taupe-deep/50" strokeWidth={1.25} />
    </div>
  );
}
