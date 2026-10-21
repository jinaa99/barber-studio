"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { site } from "@/content/site";
import { cn } from "@/lib/cn";
import { buttonStyles } from "@/components/ui/button";
import { LanguageSwitcher } from "./language-switcher";
import { Wordmark } from "./wordmark";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Fixed header. On the home page it starts transparent over the hero and
 * settles onto paper once the visitor scrolls; elsewhere it is always solid.
 */
export function SiteHeader({
  locale,
  labels,
  items,
}: {
  locale: Locale;
  labels: Dictionary["nav"];
  items: NavItem[];
}) {
  const pathname = usePathname();
  const isHome = pathname === localizedPath(locale);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Unique per instance: Next keeps the other locale's tree mounted (hidden) after a switch.
  const menuId = useId();

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrolled(window.scrollY > 24));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
    };
  }, []);

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

  const overlay = isHome && !scrolled && !menuOpen;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const close = () => setMenuOpen(false);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,color,border-color] duration-500 ease-soft",
        overlay
          ? "border-b border-transparent bg-transparent text-paper"
          : "border-b border-line bg-paper text-ink",
      )}
    >
      <a
        href={`#main-${locale}`}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-10 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-paper"
      >
        {labels.skipToContent}
      </a>
      <div className="mx-auto flex h-header w-full max-w-page items-center justify-between gap-6 px-4 sm:px-6 lg:px-10">
        <Link href={localizedPath(locale)} onClick={close} aria-label={site.brand.name} className="-my-2 py-2">
          <Wordmark />
        </Link>

        <nav aria-label={labels.primary} className="hidden lg:block">
          <ul className="flex items-center gap-9 text-sm font-medium">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "relative py-2 transition-opacity duration-300 hover:opacity-100",
                    isActive(item.href) ? "opacity-100" : "opacity-65",
                    "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-current after:transition-transform after:duration-500",
                    isActive(item.href) ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <LanguageSwitcher locale={locale} label={labels.language} tone={overlay ? "inverse" : "default"} />
          <div className="hidden sm:block">
            <Link href={localizedPath(locale, "/booking")} className={buttonStyles({ variant: overlay ? "inverse" : "primary" })}>
              {labels.book}
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? labels.closeMenu : labels.openMenu}
            className="-mr-2 inline-flex size-11 items-center justify-center lg:hidden"
          >
            {menuOpen ? <X className="size-5" strokeWidth={1.5} /> : <Menu className="size-5" strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      <div
        id={menuId}
        hidden={!menuOpen}
        className="fixed inset-x-0 bottom-0 top-header overflow-y-auto bg-paper text-ink lg:hidden"
      >
        <nav aria-label={labels.primary} className="flex min-h-full flex-col px-4 pb-10 pt-8 sm:px-6">
          <ul className="flex flex-col">
            {items.map((item, i) => (
              <li key={item.href} className="border-b border-line">
                <Link
                  href={item.href}
                  onClick={close}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className="flex items-baseline gap-4 py-5 text-3xl font-medium tracking-tight"
                >
                  <span className="tabular w-6 text-xs font-semibold text-brass">{String(i + 1).padStart(2, "0")}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-10">
            <Link
              href={localizedPath(locale, "/booking")}
              onClick={close}
              className={buttonStyles({ size: "lg", className: "w-full" })}
            >
              {labels.book}
            </Link>
            <p className="mt-6 text-sm text-taupe-deep">
              <a href={site.contact.phoneHref} className="tabular">{site.contact.phoneDisplay}</a>
            </p>
          </div>
        </nav>
      </div>
    </header>
  );
}
