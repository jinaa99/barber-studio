"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ExternalLink,
  History,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelsTopLeft,
  Scissors,
  Settings2,
  Share2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { localizedPath, type Locale } from "@/i18n/config";
import { logoutAction } from "@/app/[locale]/admin/actions";
import { cn } from "@/lib/cn";
import { Wordmark } from "@/components/layout/wordmark";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

const icons = {
  overview: LayoutDashboard,
  appointments: CalendarDays,
  barbers: Users,
  services: Scissors,
  customers: UserRound,
  analytics: BarChart3,
  content: PanelsTopLeft,
  media: Images,
  social: Share2,
  settings: Settings2,
  activity: History,
};

export type AdminNavKey = keyof typeof icons;

export interface AdminNavItem {
  key: AdminNavKey;
  href: string;
  label: string;
}

/**
 * Dashboard navigation: a fixed rail from `lg` up, a top bar with a menu
 * below it. Items are already filtered by role on the server.
 */
export function AdminNav({
  locale,
  items,
  user,
  wordmark,
  labels,
}: {
  locale: Locale;
  items: AdminNavItem[];
  user: { name: string; role: string };
  wordmark: { primary: string; secondary: string };
  labels: { navLabel: string; openMenu: string; closeMenu: string; viewSite: string; signOut: string; language: string; admin: string };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const overview = localizedPath(locale, "/admin");

  const isActive = (href: string) => (href === overview ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // A preserved (hidden) route must not come back with its menu open.
  useLayoutEffect(() => () => setOpen(false), []);

  const nav = (
    <nav aria-label={labels.navLabel} className="flex min-h-0 flex-1 flex-col">
      <ul className="space-y-0.5">
        {items.map((item) => {
          const Icon = icons[item.key];
          const active = isActive(item.href);
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-ink text-paper" : "text-ink-muted hover:bg-paper-deep",
                )}
              >
                <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.5} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto space-y-4 border-t border-line pt-5 text-sm">
        <div>
          <p className="truncate font-semibold">{user.name}</p>
          <p className="text-xs text-taupe-deep">{user.role}</p>
        </div>
        <LanguageSwitcher locale={locale} label={labels.language} />
        <div className="flex flex-col items-start gap-2.5">
          <Link href={localizedPath(locale)} className="inline-flex items-center gap-2 text-taupe-deep hover:text-ink">
            <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
            {labels.viewSite}
          </Link>
          <form action={logoutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="inline-flex items-center gap-2 text-taupe-deep hover:text-ink">
              <LogOut aria-hidden className="size-3.5" strokeWidth={1.75} />
              {labels.signOut}
            </button>
          </form>
        </div>
      </div>
    </nav>
  );

  return (
    <>
      {/* Small screens: top bar + full-height menu. */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-paper px-4 lg:hidden">
        <Link href={overview} className="flex items-baseline gap-3">
          <Wordmark wordmark={wordmark} className="text-sm" />
          <span className="eyebrow text-taupe-deep">{labels.admin}</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? labels.closeMenu : labels.openMenu}
          className="-mr-2 inline-flex size-11 items-center justify-center"
        >
          {open ? <X aria-hidden className="size-5" strokeWidth={1.5} /> : <Menu aria-hidden className="size-5" strokeWidth={1.5} />}
        </button>
      </div>
      <div id={menuId} hidden={!open} className="fixed inset-x-0 bottom-0 top-14 z-40 flex flex-col overflow-y-auto bg-paper px-4 py-5 lg:hidden">
        {nav}
      </div>

      {/* Large screens: fixed rail. */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-paper px-4 py-6 lg:flex">
        <Link href={overview} className="mb-8 flex flex-col gap-1 px-3">
          <Wordmark wordmark={wordmark} className="text-sm" />
          <span className="eyebrow text-taupe-deep">{labels.admin}</span>
        </Link>
        {nav}
      </aside>
    </>
  );
}
