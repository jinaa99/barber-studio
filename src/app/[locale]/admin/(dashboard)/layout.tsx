import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { getStudioProfile } from "@/lib/data";
import { routes } from "@/lib/navigation";
import { can, type Permission } from "@/lib/admin/permissions";
import { getCurrentUser } from "@/lib/server/auth";
import { AdminStrings } from "@/components/admin/form";
import { AdminNav, AdminTopBar, type AdminNavGroup, type AdminNavItem, type AdminNavKey } from "@/components/admin/admin-nav";

const sections: { key: AdminNavKey; group: AdminNavGroup; path: string; permission?: Permission }[] = [
  { key: "overview", group: "operations", path: routes.admin },
  { key: "appointments", group: "operations", path: routes.adminAppointments },
  { key: "customers", group: "operations", path: routes.adminCustomers, permission: "customers.view" },
  { key: "barbers", group: "catalog", path: routes.adminBarbers, permission: "catalog.manage" },
  { key: "services", group: "catalog", path: routes.adminServices, permission: "catalog.manage" },
  { key: "analytics", group: "insights", path: routes.adminAnalytics, permission: "finance.view" },
  { key: "content", group: "website", path: routes.adminContent, permission: "settings.manage" },
  { key: "media", group: "website", path: routes.adminMedia, permission: "media.manage" },
  { key: "social", group: "website", path: routes.adminSocial, permission: "social.manage" },
  { key: "settings", group: "system", path: routes.adminSettings, permission: "settings.manage" },
  { key: "activity", group: "system", path: routes.adminActivity, permission: "audit.view" },
];

/**
 * Staff dashboard shell. The navigation depends on the signed-in role, so it
 * streams in behind its own boundary; each page authorizes itself as well
 * (this layout is not a security boundary).
 */
export default async function DashboardLayout({ children }: LayoutProps<"/[locale]/admin">) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const t = dict.admin;

  return (
    <AdminStrings value={{ messages: t.messages, fieldErrors: t.fieldErrors, common: t.common }}>
      <a
        href={`#admin-main-${locale}`}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-canvas"
      >
        {t.shell.skipToContent}
      </a>
      <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
        <Suspense fallback={<div className="h-14 border-b border-line lg:h-dvh lg:w-60 lg:border-r lg:border-b-0" />}>
          <Navigation locale={locale} dict={dict} />
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col">
          <Suspense fallback={<div className="hidden h-14 border-b border-line lg:block" />}>
            <TopBar locale={locale} dict={dict} />
          </Suspense>
          <main id={`admin-main-${locale}`} tabIndex={-1} className="min-w-0 flex-1 overflow-x-clip px-4 pb-16 pt-6 outline-none sm:px-6 lg:px-10 lg:pt-8">
            <div className="mx-auto max-w-[78rem]">{children}</div>
          </main>
        </div>
      </div>
    </AdminStrings>
  );
}

async function navItems(locale: Locale, dict: Dictionary): Promise<{ user: Awaited<ReturnType<typeof getCurrentUser>>; items: AdminNavItem[] }> {
  const user = await getCurrentUser();
  const items: AdminNavItem[] = user
    ? sections
        .filter((s) => !s.permission || can(user, s.permission))
        .map((s) => ({ key: s.key, group: s.group, href: localizedPath(locale, s.path), label: dict.admin.nav[s.key] }))
    : [];
  return { user, items };
}

async function Navigation({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [{ user, items }, studio] = await Promise.all([navItems(locale, dict), getStudioProfile()]);
  const t = dict.admin;
  return (
    <AdminNav
      locale={locale}
      items={items}
      user={{ name: user?.name ?? "", role: user ? t.shell.roles[user.role] : "" }}
      wordmark={studio.wordmark}
      labels={{ ...t.shell, admin: t.eyebrow }}
    />
  );
}

async function TopBar({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const { items } = await navItems(locale, dict);
  const t = dict.admin;
  return <AdminTopBar locale={locale} items={items} labels={{ viewSite: t.shell.viewSite, language: t.shell.language, admin: t.eyebrow, groups: t.shell.groups }} />;
}
