import Link from "next/link";
import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { Barber } from "@/content/types";
import { format } from "@/lib/format";
import { routes } from "@/lib/navigation";
import { ArrowLink } from "@/components/ui/button";
import { Photo } from "@/components/media/photo";
import { Reveal } from "@/components/ui/reveal";

/**
 * The team as an editorial feature: the first barber in the studio's order
 * gets a large portrait and their biography; the others follow as a ruled
 * list with smaller portraits. Every entry links to booking with that barber.
 */
export function BarberFeature({ locale, dict, barbers }: { locale: Locale; dict: Dictionary; barbers: Barber[] }) {
  const [lead, ...rest] = barbers;
  if (!lead) return null;
  const bookHref = (id: string) => `${localizedPath(locale, routes.booking)}?barber=${id}`;
  const profileHref = (id: string) => `${localizedPath(locale, routes.barbers)}#${id}`;

  return (
    <div className="grid gap-14 lg:grid-cols-12 lg:gap-8">
      <Reveal variant="mask" className="lg:col-span-6">
        <article>
          <Link href={profileHref(lead.id)} className="group block" tabIndex={-1} aria-hidden>
            <Photo
              media={lead.image}
              ratio="4/5"
              sizes="(min-width: 1024px) 46vw, 100vw"
              imageClassName="transition-transform duration-[1200ms] ease-emphasis group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
            />
          </Link>
          <div className="mt-7 grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <h3 className="text-display-sm">
                <Link href={profileHref(lead.id)} className="link-draw">
                  {lead.name}
                </Link>
              </h3>
              <p className="mt-2 text-muted">
                {lead.role}
                <span className="tabular"> · {lead.yearsExperience} {dict.common.yearsExperience}</span>
              </p>
            </div>
            <ArrowLink href={bookHref(lead.id)}>{format(dict.barbersPage.bookWith, { name: lead.name })}</ArrowLink>
          </div>
          <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed">{lead.bio}</p>
          <p className="mt-4 text-sm text-muted">
            <span className="sr-only">{dict.common.specialties}: </span>
            {lead.specialties.join(" · ")}
          </p>
        </article>
      </Reveal>

      {rest.length > 0 && (
        <ul className="self-start border-t border-line-strong lg:sticky lg:top-28 lg:col-span-5 lg:col-start-8">
          {rest.map((barber, i) => (
            <Reveal as="li" key={barber.id} delay={i * 100} className="border-b border-line py-6">
              <article className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-7">
                <Link href={profileHref(barber.id)} className="group block" tabIndex={-1} aria-hidden>
                  <Photo
                    media={barber.image}
                    ratio="3/4"
                    sizes="(min-width: 640px) 9rem, 6.5rem"
                    imageClassName="transition-transform duration-[1200ms] ease-emphasis group-hover:scale-[1.04] motion-reduce:group-hover:scale-100"
                  />
                </Link>
                <div className="flex min-w-0 flex-col">
                  <h3 className="text-2xl tracking-[-0.025em]">
                    <Link href={profileHref(barber.id)} className="link-draw">
                      {barber.name}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-muted">{barber.role}</p>
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">
                    <span className="sr-only">{dict.common.specialties}: </span>
                    {barber.specialties.join(" · ")}
                  </p>
                  <div className="mt-auto pt-4">
                    <ArrowLink href={bookHref(barber.id)} className="text-sm">
                      {format(dict.barbersPage.bookWith, { name: barber.name })}
                    </ArrowLink>
                  </div>
                </div>
              </article>
            </Reveal>
          ))}
        </ul>
      )}
    </div>
  );
}
