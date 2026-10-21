import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { Barber } from "@/content/types";
import { Photo } from "@/components/media/photo";
import { Reveal } from "@/components/ui/reveal";

export function BarberGrid({ dict, barbers }: { dict: Dictionary; barbers: Barber[] }) {
  return (
    <ul className="grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
      {barbers.map((barber, i) => (
        <Reveal as="li" key={barber.id} delay={i * 100}>
          <Photo
            media={barber.image}
            ratio="3/4"
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
            imageClassName="grayscale-[35%] transition-[filter,transform] duration-700 ease-soft hover:grayscale-0"
          />
          <div className="mt-6 flex items-baseline justify-between gap-4">
            <h3 className="text-2xl font-semibold tracking-tight">{barber.name}</h3>
            <span className="tabular shrink-0 text-xs text-taupe-deep">
              {barber.yearsExperience} {dict.common.yearsExperience}
            </span>
          </div>
          <p className="mt-1 text-sm text-taupe-deep">{barber.role}</p>
          <p className="mt-4 text-sm leading-relaxed">
            <span className="sr-only">{dict.common.specialties}: </span>
            {barber.specialties.join(" · ")}
          </p>
        </Reveal>
      ))}
    </ul>
  );
}
