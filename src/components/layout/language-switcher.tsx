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

  return (
    <nav aria-label={label} className={cn("flex items-center text-xs font-semibold tracking-[0.14em]", className)}>
      {locales.map((l, i) => {
        const active = l === locale;
        return (
          <span key={l} className="flex items-center">
            {i > 0 && (
              <span aria-hidden className={cn("mx-1.5", tone === "inverse" ? "text-paper/35" : "text-ink/25")}>
                /
              </span>
            )}
            <Link
              href={switchLocalePath(pathname, l)}
              hrefLang={l}
              lang={l}
              aria-current={active ? "true" : undefined}
              title={localeNames[l].native}
              onClick={(e) => handleClick(e, l)}
              scroll={false}
              className={cn(
                "inline-flex min-h-11 min-w-8 items-center justify-center transition-opacity duration-300",
                active ? "opacity-100" : "opacity-45 hover:opacity-80",
              )}
            >
              <span className="sr-only">{localeNames[l].native}</span>
              <span aria-hidden>{localeNames[l].short}</span>
            </Link>
          </span>
        );
      })}
    </nav>
  );
}
