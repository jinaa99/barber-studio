import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { getStudioProfile } from "@/lib/data";
import { routes } from "@/lib/navigation";
import { can, type Permission } from "@/lib/admin/permissions";
import { getCurrentUser } from "@/lib/server/auth";
import { AdminStrings } from "@/components/admin/form";
import { AdminNav, type AdminNavItem, type AdminNavKey } from "@/components/admin/admin-nav";

const sections: { key: AdminNavKey; path: string; permission?: Permission }[] = [
  { key: "overview", path: routes.admin },
  { key: "appointments", path: routes.adminAppointments },
  { key: "customers", path: routes.adminCustomers, permission: "customers.view" },
  { key: "barbers", path: routes.adminBarbers, permission: "catalog.manage" },
  { key: "services", path: routes.adminServices, permission: "catalog.manage" },
  { key: "analytics", path: routes.adminAnalytics, permission: "finance.view" },
  { key: "content", path: routes.adminContent, permission: "settings.manage" },
  { key: "settings", path: routes.adminSettings, permission: "settings.manage" },
  { key: "activity", path: routes.adminActivity, permission: "audit.view" },
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
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-paper"
      >
        {t.shell.skipToContent}
      </a>
      <div className="flex min-h-dvh flex-col lg:flex-row">
        <Suspense fallback={<div className="h-14 border-b border-line lg:h-dvh lg:w-64 lg:border-r lg:border-b-0" />}>
          <Navigation locale={locale} dict={dict} />
        </Suspense>
        <main id={`admin-main-${locale}`} tabIndex={-1} className="min-w-0 flex-1 overflow-x-clip px-4 py-8 outline-none sm:px-6 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </AdminStrings>
  );
}

async function Navigation({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [user, studio] = await Promise.all([getCurrentUser(), getStudioProfile()]);
  const t = dict.admin;
  const items: AdminNavItem[] = user
    ? sections
        .filter((s) => !s.permission || can(user, s.permission))
        .map((s) => ({ key: s.key, href: localizedPath(locale, s.path), label: t.nav[s.key] }))
    : [];
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
