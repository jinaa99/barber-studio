"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { cn } from "@/lib/cn";
import { heroToneEvent } from "@/lib/events";
import { buttonStyles } from "@/components/ui/button";
import { LanguageSwitcher } from "./language-switcher";
import { Wordmark } from "./wordmark";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Fixed header: wordmark, centred primary navigation, language and booking.
 * On the home page it stays transparent while the dark hero is behind it and
 * settles onto the canvas once the hero has scrolled past (or has turned light
 * itself); elsewhere it is always solid.
 */
export function SiteHeader({
  locale,
  labels,
  items,
  studio,
}: {
  locale: Locale;
  labels: Dictionary["nav"];
  items: NavItem[];
  studio: { name: string; wordmark: { primary: string; secondary: string }; phoneDisplay: string; phoneHref: string };
}) {
  const pathname = usePathname();
  const isHome = pathname === localizedPath(locale);
  const [overHero, setOverHero] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Unique per instance: Next keeps the other locale's tree mounted (hidden) after a switch.
  const menuId = useId();

  useEffect(() => {
    let frame = 0;
    // Hidden (preserved) routes keep their hero in the DOM with a zero-size box, so they never match.
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const edge = headerRef.current?.offsetHeight ?? 0;
        const heroes = document.querySelectorAll<HTMLElement>("[data-home-hero]");
        setOverHero(
          Array.from(heroes).some((el) => el.dataset.tone !== "light" && el.getBoundingClientRect().bottom > edge),
        );
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener(heroToneEvent, update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener(heroToneEvent, update);
    };
  }, [pathname]);

  // Lock page scroll and allow Escape while the mobile menu is open.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // A preserved (hidden) route must not come back with its menu open.
  useLayoutEffect(() => () => setMenuOpen(false), []);

  const overlay = isHome && overHero && !menuOpen;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const close = () => setMenuOpen(false);

  return (
    <header
      ref={headerRef}
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,color,border-color] duration-500 ease-standard",
        overlay
          ? "border-b border-transparent bg-transparent text-canvas"
          : "border-b border-line bg-canvas text-ink",
      )}
    >
      <a
        href={`#main-${locale}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-10 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-canvas"
      >
        {labels.skipToContent}
      </a>
      <div className="mx-auto grid h-header w-full max-w-page grid-cols-[1fr_auto] items-center gap-6 px-4 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:px-10 xl:px-12">
        <Link href={localizedPath(locale)} onClick={close} aria-label={studio.name} className="-my-2 justify-self-start py-2">
          <Wordmark wordmark={studio.wordmark} />
        </Link>

        <nav aria-label={labels.primary} className="hidden lg:block">
          <ul className="flex items-center gap-8 text-[0.9375rem] font-medium tracking-[-0.01em]">
            {items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-2 py-2 transition-opacity duration-200",
                      active ? "opacity-100" : "opacity-70 hover:opacity-100",
                    )}
                  >
                    {/* Active route: a small accent dot, not a heavier weight that would shift the layout. */}
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 rounded-full transition-[transform,background-color] duration-300 ease-emphasis",
                        active ? (overlay ? "scale-100 bg-accent-soft" : "scale-100 bg-accent") : "scale-0 bg-current",
                      )}
                    />
                    <span className="link-draw pb-px">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center justify-self-end gap-2 sm:gap-3">
          <LanguageSwitcher locale={locale} label={labels.language} tone={overlay ? "inverse" : "default"} />
          <div className="hidden sm:block">
            <Link
              href={localizedPath(locale, "/booking")}
              className={buttonStyles({ variant: overlay ? "inverse" : "primary", size: "sm" })}
            >
              {labels.book}
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? labels.closeMenu : labels.openMenu}
            className="-mr-2 inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-current/5 lg:hidden"
          >
            {menuOpen ? <X aria-hidden className="size-5" strokeWidth={1.5} /> : <Menu aria-hidden className="size-5" strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      <div
        id={menuId}
        hidden={!menuOpen}
        className="fixed inset-x-0 bottom-0 top-header overflow-y-auto bg-canvas text-ink lg:hidden"
      >
        <nav aria-label={labels.primary} className="flex min-h-full flex-col px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6 sm:px-6">
          <ul className="flex flex-col">
            {items.map((item, i) => {
              const active = isActive(item.href);
              return (
                <li
                  key={item.href}
                  className="animate-rise border-b border-line motion-reduce:animate-none"
                  style={{ animationDelay: `${60 + i * 45}ms` }}
                >
                  <Link
                    href={item.href}
                    onClick={close}
                    aria-current={active ? "page" : undefined}
                    className="flex items-center justify-between gap-4 py-4.5 text-[2rem] font-medium leading-tight tracking-[-0.035em]"
                  >
                    <span className="flex items-baseline gap-4">
                      <span className="tabular w-6 text-sm font-medium tracking-normal text-muted">{String(i + 1).padStart(2, "0")}</span>
                      {item.label}
                    </span>
                    {active && <span aria-hidden className="size-2 rounded-full bg-accent" />}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-auto animate-rise pt-10 motion-reduce:animate-none" style={{ animationDelay: "320ms" }}>
            <Link
              href={localizedPath(locale, "/booking")}
              onClick={close}
              className={buttonStyles({ size: "lg", className: "w-full" })}
            >
              {labels.book}
            </Link>
            {studio.phoneHref && (
              <p className="mt-5 text-center text-sm text-muted">
                <a href={studio.phoneHref} className="tabular link-draw">{studio.phoneDisplay}</a>
              </p>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
