import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { Service } from "@/content/types";
import { formatDuration, formatPrice } from "@/lib/format";
import { routes } from "@/lib/navigation";
import { cn } from "@/lib/cn";

/**
 * Editorial price list: one row per service rather than a grid of cards.
 * Name and price carry the row; duration and description sit quieter. Every
 * row links into the booking flow with the service preselected. `detailed`
 * adds the "includes" line used on the services page.
 */
export function ServiceList({
  locale,
  dict,
  services,
  detailed = false,
  startIndex = 0,
  tone = "default",
}: {
  locale: Locale;
  dict: Dictionary;
  services: Service[];
  detailed?: boolean;
  startIndex?: number;
  tone?: "default" | "inverse";
}) {
  const inverse = tone === "inverse";
  const muted = inverse ? "text-canvas/65" : "text-muted";
  return (
    <ul className={cn("border-t", inverse ? "border-line-inverse" : "border-line-strong")}>
      {services.map((service, i) => (
        <li key={service.id} className={cn("border-b", inverse ? "border-line-inverse" : "border-line")}>
          <Link
            href={`${localizedPath(locale, routes.booking)}?service=${service.id}`}
            className={cn(
              "group relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-2 py-6 transition-[padding,background-color] duration-300 ease-emphasis sm:grid-cols-[2.5rem_minmax(0,1fr)_6rem_8.5rem_2.5rem] sm:items-baseline sm:py-7",
              "sm:hover:px-3",
              inverse ? "sm:hover:bg-canvas/5" : "sm:hover:bg-surface",
            )}
          >
            <span className={cn("tabular hidden text-sm sm:block", muted)}>{String(startIndex + i + 1).padStart(2, "0")}</span>
            <span className="min-w-0">
              <span className="block text-[1.375rem] font-medium leading-tight tracking-[-0.025em] sm:text-[1.625rem]">{service.name}</span>
              <span className={cn("mt-2 block max-w-xl text-[0.9375rem] leading-relaxed", muted)}>{service.summary}</span>
              {detailed && service.includes.length > 0 && (
                <span className={cn("mt-3 block text-[0.8125rem] leading-relaxed", muted)}>
                  <span className="sr-only">{dict.servicesPage.includes}: </span>
                  {/* The separator ends each item, so a wrapped line never starts with one. */}
                  {service.includes.map((item, n) => (
                    <span key={item} className="whitespace-nowrap">
                      {item}
                      {n < service.includes.length - 1 && <span aria-hidden> · </span>}{" "}
                    </span>
                  ))}
                </span>
              )}
            </span>
            <span className={cn("tabular col-start-1 row-start-2 text-sm sm:col-start-auto sm:row-start-auto sm:text-right", muted)}>
              {formatDuration(service.durationMinutes, dict.common.minutes)}
            </span>
            <span className="numeric col-start-2 row-start-1 text-right text-lg font-medium sm:col-start-auto sm:row-start-auto sm:text-xl">
              {formatPrice(service.price, locale)}
            </span>
            <span
              aria-hidden
              className={cn(
                "hidden size-9 items-center justify-center justify-self-end self-center rounded-full border transition-[background-color,border-color,color,transform] duration-300 ease-emphasis sm:flex",
                inverse
                  ? "border-line-inverse group-hover:border-canvas group-hover:bg-canvas group-hover:text-ink"
                  : "border-line-strong group-hover:border-ink group-hover:bg-ink group-hover:text-canvas",
                "group-hover:rotate-45 motion-reduce:group-hover:rotate-0",
              )}
            >
              <ArrowUpRight className="size-4" strokeWidth={1.5} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
