import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { Service } from "@/content/types";
import { formatDuration, formatPrice } from "@/lib/format";
import { routes } from "@/lib/navigation";
import { cn } from "@/lib/cn";

/**
 * Editorial price list: one row per service rather than a grid of cards.
 * `detailed` adds the "includes" line used on the services page.
 */
export function ServiceList({
  locale,
  dict,
  services,
  detailed = false,
  startIndex = 0,
}: {
  locale: Locale;
  dict: Dictionary;
  services: Service[];
  detailed?: boolean;
  startIndex?: number;
}) {
  return (
    <ul className="border-t border-line-strong">
      {services.map((service, i) => (
        <li key={service.id} className="border-b border-line">
          <Link
            href={`${localizedPath(locale, routes.booking)}?service=${service.id}`}
            className="group grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 py-7 transition-colors duration-300 sm:grid-cols-[3rem_1fr_7rem_8rem_2rem] sm:items-baseline sm:py-8"
          >
            <span className="tabular hidden text-xs font-semibold text-brass sm:block">
              {String(startIndex + i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0">
              <span className="block text-xl font-semibold tracking-tight sm:text-2xl">{service.name}</span>
              <span className="mt-2 block max-w-xl text-[0.9375rem] leading-relaxed text-taupe-deep">
                {service.summary}
              </span>
              {detailed && (
                <span className="mt-3 block text-xs text-taupe-deep">
                  <span className="sr-only">{dict.servicesPage.includes}: </span>
                  {service.includes.join(" · ")}
                </span>
              )}
            </span>
            <span className="tabular col-start-1 row-start-2 text-sm text-taupe-deep sm:col-start-auto sm:row-start-auto sm:text-right">
              {formatDuration(service.durationMinutes, dict.common.minutes)}
            </span>
            <span className="tabular col-start-2 row-start-1 text-right text-lg font-semibold sm:col-start-auto sm:row-start-auto">
              {formatPrice(service.price, locale)}
            </span>
            <span
              aria-hidden
              className={cn(
                "hidden justify-end text-ink opacity-0 transition-[opacity,transform] duration-300 ease-soft sm:flex",
                "-translate-x-2 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:opacity-100",
              )}
            >
              <ArrowRight className="size-4" strokeWidth={1.75} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
