import type { GalleryItem } from "@/content/types";
import { Photo, type PhotoRatio } from "@/components/media/photo";
import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/cn";

/**
 * Fixed editorial composition for five pieces: a wide frame beside a tall
 * one, then three frames on a stepped baseline so the row doesn't read as a
 * grid. Extra items are ignored; fewer simply leave gaps out.
 */
const composition: { span: string; ratio: PhotoRatio; sizes: string; offset?: string }[] = [
  { span: "col-span-2 md:col-span-8", ratio: "3/2", sizes: "(min-width: 768px) 64vw, 100vw" },
  { span: "col-span-2 md:col-span-4 md:self-end", ratio: "4/5", sizes: "(min-width: 768px) 32vw, 100vw" },
  { span: "col-span-1 md:col-span-4", ratio: "4/5", sizes: "(min-width: 768px) 32vw, 50vw" },
  { span: "col-span-1 md:col-span-4", ratio: "4/5", sizes: "(min-width: 768px) 32vw, 50vw", offset: "md:mt-24" },
  { span: "col-span-2 md:col-span-4", ratio: "1/1", sizes: "(min-width: 768px) 32vw, 100vw", offset: "md:mt-12" },
];

export function WorkGrid({ items, tone = "inverse" }: { items: GalleryItem[]; tone?: "default" | "inverse" }) {
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-4 md:grid-cols-12 md:gap-x-6 md:gap-y-16">
      {items.slice(0, composition.length).map((item, i) => {
        const slot = composition[i];
        return (
          <Reveal as="li" key={item.id} variant="scale" delay={(i % 3) * 90} className={cn(slot.span, slot.offset)}>
            <figure className="group">
              <Photo
                media={item.image}
                ratio={slot.ratio}
                sizes={slot.sizes}
                imageClassName="transition-transform duration-[1200ms] ease-emphasis group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
              />
              <figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                <span className="flex items-baseline gap-3">
                  <span className={cn("tabular", tone === "inverse" ? "text-canvas/50" : "text-muted")}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-medium">{item.title}</span>
                </span>
                {item.barberName && (
                  <span className={tone === "inverse" ? "text-canvas/65" : "text-muted"}>{item.barberName}</span>
                )}
              </figcaption>
            </figure>
          </Reveal>
        );
      })}
    </ul>
  );
}
