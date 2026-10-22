"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
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
export type AdminNavGroup = "operations" | "catalog" | "insights" | "website" | "system";

export interface AdminNavItem {
  key: AdminNavKey;
  group: AdminNavGroup;
  href: string;
  label: string;
}

interface ShellLabels {
  navLabel: string;
  openMenu: string;
  closeMenu: string;
  viewSite: string;
  signOut: string;
  language: string;
  admin: string;
  groups: Record<AdminNavGroup, string>;
}

function useActive(locale: Locale) {
  const pathname = usePathname();
  const overview = localizedPath(locale, "/admin");
  return (href: string) => (href === overview ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/**
 * Dashboard navigation: a grouped rail from `lg` up, a top bar with a
 * full-height menu below it. Items are already filtered by role on the server.
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
  labels: ShellLabels;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const isActive = useActive(locale);
  const overview = localizedPath(locale, "/admin");
  const current = items.find((i) => isActive(i.href));

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // A preserved (hidden) route must not come back with its menu open.
  useLayoutEffect(() => () => setOpen(false), []);

  const groups = [...new Set(items.map((i) => i.group))];

  const nav = (mobile: boolean) => (
    <nav aria-label={labels.navLabel} className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-6">
        {groups.map((group, g) => (
          <div key={group} className={cn(mobile && "animate-rise motion-reduce:animate-none")} style={mobile ? { animationDelay: `${g * 50}ms` } : undefined}>
            <p className="mb-1.5 px-3 text-xs font-medium text-muted">{labels.groups[group]}</p>
            <ul className="space-y-0.5">
              {items
                .filter((i) => i.group === group)
                .map((item) => {
                  const Icon = icons[item.key];
                  const active = isActive(item.href);
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-150",
                          mobile ? "h-11" : "h-9",
                          active
                            ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line),0_1px_2px_rgb(18_18_17/0.06)]"
                            : "text-ink-muted hover:bg-stone/70 hover:text-ink",
                        )}
                      >
                        <Icon
                          aria-hidden
                          className={cn("size-4 shrink-0 transition-colors", active ? "text-accent" : "text-faint group-hover:text-ink-muted")}
                          strokeWidth={1.75}
                        />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-auto pt-6">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-stone text-xs font-semibold">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.role}</p>
          </div>
          <form action={logoutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              title={labels.signOut}
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-stone hover:text-ink"
            >
              <LogOut aria-hidden className="size-4" strokeWidth={1.75} />
              <span className="sr-only">{labels.signOut}</span>
            </button>
          </form>
        </div>
        {mobile && (
          <div className="mt-4 flex items-center justify-between gap-4">
            <Link href={localizedPath(locale)} className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
              <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
              {labels.viewSite}
            </Link>
            <LanguageSwitcher locale={locale} label={labels.language} />
          </div>
        )}
      </div>
    </nav>
  );

  return (
    <>
      {/* Small screens: top bar + full-height menu. */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-line bg-canvas/95 px-4 backdrop-blur-sm sm:px-6 lg:hidden">
        <Link href={overview} className="flex min-w-0 items-center gap-2.5">
          <Wordmark wordmark={wordmark} className="text-sm" />
          {current && (
            <>
              <span aria-hidden className="text-faint">/</span>
              <span className="truncate text-sm text-muted">{current.label}</span>
            </>
          )}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? labels.closeMenu : labels.openMenu}
          className="-mr-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-stone"
        >
          {open ? <X aria-hidden className="size-5" strokeWidth={1.5} /> : <Menu aria-hidden className="size-5" strokeWidth={1.5} />}
        </button>
      </div>
      <div
        id={menuId}
        hidden={!open}
        className="fixed inset-x-0 bottom-0 top-14 z-40 flex flex-col overflow-y-auto bg-canvas px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:hidden"
      >
        {nav(true)}
      </div>

      {/* Large screens: fixed rail. */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r border-line bg-canvas px-3 pb-4 pt-5 lg:flex">
        <Link href={overview} className="mb-7 flex flex-col gap-1 rounded-lg px-3 py-1">
          <Wordmark wordmark={wordmark} className="text-[0.9375rem]" />
          <span className="text-xs text-muted">{labels.admin}</span>
        </Link>
        {nav(false)}
      </aside>
    </>
  );
}

/** Desktop context bar above every dashboard page: where you are, the public site and the language. */
export function AdminTopBar({
  locale,
  items,
  labels,
}: {
  locale: Locale;
  items: AdminNavItem[];
  labels: Pick<ShellLabels, "viewSite" | "language" | "admin" | "groups">;
}) {
  const isActive = useActive(locale);
  const current = items.find((i) => isActive(i.href));
  return (
    <div className="sticky top-0 z-30 hidden h-14 items-center justify-between gap-6 border-b border-line bg-canvas/90 px-10 backdrop-blur-sm lg:flex">
      <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
        <span>{labels.admin}</span>
        {current && (
          <>
            <ChevronRight aria-hidden className="size-3.5 text-faint" strokeWidth={1.75} />
            <span>{labels.groups[current.group]}</span>
            <ChevronRight aria-hidden className="size-3.5 text-faint" strokeWidth={1.75} />
            <span className="truncate font-medium text-ink">{current.label}</span>
          </>
        )}
      </p>
      <div className="flex items-center gap-3">
        <Link
          href={localizedPath(locale)}
          className="inline-flex h-8 items-center gap-2 rounded-full px-3 text-sm text-muted transition-colors hover:bg-stone hover:text-ink"
        >
          <ExternalLink aria-hidden className="size-3.5" strokeWidth={1.75} />
          {labels.viewSite}
        </Link>
        <LanguageSwitcher locale={locale} label={labels.language} />
      </div>
    </div>
  );
}
