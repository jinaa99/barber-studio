import type { GalleryItem } from "@/content/types";
import { Photo } from "@/components/media/photo";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/cn";

/**
 * Fixed editorial composition for five pieces: a wide image beside a square,
 * then three portraits. Extra items are ignored; fewer simply leave gaps out.
 */
const composition = [
  { span: "md:col-span-7", ratio: "3/2", sizes: "(min-width: 768px) 58vw, 100vw" },
  // 17/16 keeps this frame the same height as the 3/2 frame beside it.
  { span: "md:col-span-5", ratio: "1/1", frame: "md:aspect-[17/16]", sizes: "(min-width: 768px) 42vw, 100vw" },
  { span: "md:col-span-4", ratio: "4/5", sizes: "(min-width: 768px) 33vw, 100vw" },
  { span: "md:col-span-4", ratio: "4/5", sizes: "(min-width: 768px) 33vw, 100vw" },
  { span: "md:col-span-4", ratio: "4/5", sizes: "(min-width: 768px) 33vw, 100vw" },
] as const;

export function WorkGrid({ items, tone = "inverse" }: { items: GalleryItem[]; tone?: "default" | "inverse" }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 md:grid-cols-12 md:gap-y-12">
      {items.slice(0, composition.length).map((item, i) => {
        const slot = composition[i];
        return (
          <Reveal
            as="li"
            key={item.id}
            delay={(i % 3) * 90}
            className={cn(i === 2 || i === 3 ? "col-span-1" : "col-span-2", slot.span)}
          >
            <figure>
              <Photo
                media={item.image}
                ratio={slot.ratio}
                sizes={slot.sizes}
                className={"frame" in slot ? slot.frame : undefined}
              />
              <figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                <span className="font-medium">{item.title}</span>
                {item.barberName && (
                  <span className={tone === "inverse" ? "text-paper/50" : "text-taupe-deep"}>{item.barberName}</span>
                )}
              </figcaption>
            </figure>
          </Reveal>
        );
      })}
    </ul>
  );
}
