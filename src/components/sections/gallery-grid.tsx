"use client";

import { useId, useState } from "react";
import type { GalleryItem } from "@/content/types";
import { format } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Photo } from "@/components/media/photo";
import { Reveal } from "@/components/ui/reveal";

const STUDIO = "__studio";

/**
 * The full gallery on a three-column rhythm: portraits take one column at
 * 4:5 and landscapes two columns at 16:10, which is the same height, so rows
 * stay level and dense packing fills the gaps. Visitors can narrow it to one
 * barber's work; without scripting the filter is hidden and everything shows.
 */
export function GalleryGrid({
  items,
  labels,
}: {
  items: GalleryItem[];
  labels: { filter: string; all: string; studio: string; showing: string };
}) {
  const [filter, setFilter] = useState<string | null>(null);
  const statusId = useId();

  const groups = [
    ...new Map(items.flatMap((i) => (i.barberId && i.barberName ? [[i.barberId, i.barberName] as const] : []))).entries(),
  ];
  const hasStudio = items.some((i) => !i.barberId);
  const options = [
    { id: null, label: labels.all },
    ...groups.map(([id, name]) => ({ id, label: name })),
    ...(hasStudio && groups.length > 0 ? [{ id: STUDIO, label: labels.studio }] : []),
  ];
  const matches = (item: GalleryItem) => filter === null || (filter === STUDIO ? !item.barberId : item.barberId === filter);
  const count = items.filter(matches).length;

  return (
    <>
      {options.length > 2 && (
        <div className="mb-10 hidden flex-wrap items-center justify-between gap-4 border-t border-line pt-6 scripted:flex">
          <div role="group" aria-label={labels.filter} aria-describedby={statusId} className="flex flex-wrap gap-2">
            {options.map((o) => {
              const active = filter === o.id;
              return (
                <button
                  key={o.id ?? "all"}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(o.id)}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition-[background-color,border-color,color] duration-200",
                    active ? "border-ink bg-ink text-canvas" : "border-line-strong hover:border-ink hover:bg-surface",
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          <p id={statusId} role="status" className="tabular text-sm text-muted">
            {format(labels.showing, { count })}
          </p>
        </div>
      )}

      <ul className="grid grid-flow-row-dense gap-x-4 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-14">
        {items.map((item, i) => {
          const wide = item.layout === "landscape";
          return (
            <Reveal
              as="li"
              key={item.id}
              variant="scale"
              delay={(i % 3) * 80}
              className={cn(wide && "sm:col-span-2", !matches(item) && "hidden")}
            >
              <figure className="group">
                <Photo
                  media={item.image}
                  ratio={wide ? "16/10" : "4/5"}
                  sizes={wide ? "(min-width: 1024px) 62vw, (min-width: 640px) 92vw, 100vw" : "(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 100vw"}
                  imageClassName="transition-transform duration-[1200ms] ease-emphasis group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
                />
                <figcaption className="mt-3 flex items-baseline justify-between gap-4 text-sm">
                  <span className="font-medium">{item.title}</span>
                  {item.barberName && <span className="shrink-0 text-muted">{item.barberName}</span>}
                </figcaption>
              </figure>
            </Reveal>
          );
        })}
      </ul>
    </>
  );
}
