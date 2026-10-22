"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { localeCookie, localeNames, locales, switchLocalePath, type Locale } from "@/i18n/config";
import { cn } from "@/lib/cn";

/** Remember the choice so unprefixed URLs (e.g. "/") redirect to it. */
function rememberLocale(locale: Locale) {
  document.cookie = `${localeCookie}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Switches language while staying on the same page: the locale segment is
 * swapped, query string and hash are kept, and scroll position is preserved.
 * Presented as a two-option segmented control.
 */
export function LanguageSwitcher({
  locale,
  label,
  tone = "default",
  className,
}: {
  locale: Locale;
  label: string;
  tone?: "default" | "inverse";
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>, next: Locale) {
    if (next === locale) {
      event.preventDefault();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    rememberLocale(next);
    const { search, hash } = window.location;
    router.push(`${switchLocalePath(pathname, next)}${search}${hash}`, { scroll: false });
  }

  const inverse = tone === "inverse";
  return (
    <nav
      aria-label={label}
      className={cn(
        "inline-flex items-center rounded-full border p-0.5 text-xs font-semibold tracking-[0.04em] transition-colors duration-300",
        inverse ? "border-canvas/25" : "border-line-strong",
        className,
      )}
    >
      {locales.map((l) => {
        const active = l === locale;
        return (
          <Link
            key={l}
            href={switchLocalePath(pathname, l)}
            hrefLang={l}
            lang={l}
            aria-current={active ? "true" : undefined}
            title={localeNames[l].native}
            onClick={(e) => handleClick(e, l)}
            scroll={false}
            className={cn(
              "inline-flex h-8 min-w-9 items-center justify-center rounded-full px-2 transition-colors duration-200",
              active
                ? inverse
                  ? "bg-canvas text-ink"
                  : "bg-ink text-canvas"
                : inverse
                  ? "text-canvas/70 hover:text-canvas"
                  : "text-muted hover:text-ink",
            )}
          >
            <span className="sr-only">{localeNames[l].native}</span>
            <span aria-hidden>{localeNames[l].short}</span>
          </Link>
        );
      })}
    </nav>
  );
}
