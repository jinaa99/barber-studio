import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath, type Locale, type LocalizedText } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { routes } from "@/lib/navigation";
import { format } from "@/lib/format";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/admin/format";
import { db } from "@/lib/server/db";
import { adminContext } from "@/lib/server/admin-context";
import { listBarbersForAdmin, listStudioClosures } from "@/lib/server/catalog";
import { listStaff } from "@/lib/server/staff";
import { updateAccountAction } from "@/app/[locale]/admin/actions/settings";
import { ActionForm, CheckboxField, SelectField, SubmitButton } from "@/components/admin/form";
import { CreateAccountButton, ResetPasswordButton } from "@/components/admin/team-forms";
import { mediaChoices, MediaThumb } from "@/components/admin/media-picker";
import { TimeOffManager } from "@/components/admin/time-off";
import { EmptyState, Forbidden, PageHeader, PageSkeleton, primarySmallButton, Section, Tag } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.admin.nav.barbers} · ${dict.meta.admin}`, robots: { index: false, follow: false } };
}

export default async function BarbersPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={<PageSkeleton label={dict.admin.common.loading} />}>
      <Barbers locale={locale} dict={dict} />
    </Suspense>
  );
}

async function Barbers({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const ctx = await adminContext(locale);
  if (!ctx.can("catalog.manage")) return <Forbidden dict={dict} />;
  const t = dict.admin;
  const [barbers, closures, staff, images] = await Promise.all([
    listBarbersForAdmin(db, ctx.now),
    listStudioClosures(db, ctx.now),
    ctx.can("staff.manage") ? listStaff(db) : Promise.resolve(null),
    mediaChoices(locale, "IMAGE"),
  ]);
  const name = (value: unknown) => (value as LocalizedText)[locale];
  const base = localizedPath(locale, routes.adminBarbers);

  return (
    <>
      <PageHeader
        title={t.barbers.title}
        lead={t.barbers.lead}
        actions={
          <Link href={`${base}/new`} className={primarySmallButton}>
            <Plus aria-hidden className="size-4" strokeWidth={1.75} />
            {t.barbers.addBarber}
          </Link>
        }
      />

      <Section id={`barbers-${locale}`} title={t.barbers.list}>
        {barbers.length === 0 ? (
          <EmptyState>{t.barbers.empty}</EmptyState>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {barbers.map((b) => {
              const image = images.find((m) => m.ref === b.imageId);
              return (
                <li key={b.id} className="min-w-0">
                  <Link
                    href={`${base}/${b.id}`}
                    className={cn(
                      "flex gap-4 rounded-xl border border-line bg-canvas/40 p-3 transition-colors hover:border-ink/40 hover:bg-canvas",
                      !b.active && "opacity-70",
                    )}
                  >
                    <span className="relative block aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-lg bg-stone">
                      {image && <MediaThumb src={image.src} alt="" sizes="80px" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{name(b.name)}</span>
                        {!b.active && <Tag>{t.common.inactive}</Tag>}
                      </span>
                      <span className="block truncate text-sm text-muted">{name(b.role)}</span>
                      <span className="mt-2 block text-xs text-muted">
                        {format(t.barbers.services, { count: b._count.services })} ·{" "}
                        {b._count.workingHours ? format(t.barbers.upcoming, { count: b.upcoming }) : t.barbers.noHours}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted">
                        {t.barbers.login}: {b.user ? b.user.email : t.barbers.noLogin}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section id={`closures-${locale}`} title={t.barbers.closures} lead={t.barbers.closuresLead}>
        <TimeOffManager
          locale={locale}
          dict={dict}
          barberId="studio"
          entries={closures}
          timeZone={ctx.timeZone}
          today={ctx.today}
          emptyLabel={t.barbers.closuresEmpty}
          addLabel={t.barbers.addClosure}
        />
      </Section>

      {staff && (
        <Section
          id={`team-${locale}`}
          title={t.team.title}
          lead={t.team.lead}
          actions={
            <CreateAccountButton
              labels={{ ...t.team, create: t.common.create, save: t.common.save, close: t.common.close }}
              roles={(["STAFF", "BARBER", "ADMIN"] as const).map((r) => ({ value: r, label: `${t.shell.roles[r]} — ${t.team.roleHelp[r]}` }))}
              barbers={[{ value: "", label: t.team.noBarber }, ...barbers.filter((b) => !b.user).map((b) => ({ value: b.id, label: name(b.name) }))]}
            />
          }
        >
          <dl className="mb-6 grid gap-3 text-sm sm:grid-cols-3">
            {(["ADMIN", "STAFF", "BARBER"] as const).map((r) => (
              <div key={r} className="border-l-2 border-line-strong pl-3">
                <dt className="font-semibold">{t.shell.roles[r]}</dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-muted">{t.team.roleHelp[r]}</dd>
              </div>
            ))}
          </dl>
          {staff.length === 0 ? (
            <EmptyState>{t.team.empty}</EmptyState>
          ) : (
            <ul className="border-t border-line">
              {staff.map((u) => (
                <li key={u.id} className="grid gap-4 border-b border-line py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                  <div className="min-w-0 text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {u.name}
                      {u.id === ctx.user.id && <Tag>{t.team.you}</Tag>}
                      {!u.active && <Tag>{t.common.inactive}</Tag>}
                    </p>
                    <p className="break-all text-muted">{u.email}</p>
                    <p className="mt-1 text-xs text-muted">
                      {t.team.lastLogin}: {u.lastLoginAt ? dateTime(u.lastLoginAt, ctx.timeZone, locale, dict) : t.team.never}
                    </p>
                    {u.lockedUntil && u.lockedUntil > ctx.now && <p className="mt-1 text-xs text-danger">{t.team.locked}</p>}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <ActionForm action={updateAccountAction} className="grid flex-1 gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="userId" value={u.id} />
                      <SelectField
                        label={t.team.role}
                        name="role"
                        defaultValue={u.role}
                        disabled={u.id === ctx.user.id}
                        options={(["ADMIN", "STAFF", "BARBER"] as const).map((r) => ({ value: r, label: t.shell.roles[r] }))}
                      />
                      {u.id === ctx.user.id && <input type="hidden" name="role" value={u.role} />}
                      <SelectField
                        label={t.team.linkedBarber}
                        name="barberId"
                        defaultValue={u.barber?.id ?? ""}
                        options={[
                          { value: "", label: t.team.noBarber },
                          ...barbers.filter((b) => !b.user || b.user.id === u.id).map((b) => ({ value: b.id, label: name(b.name) })),
                        ]}
                      />
                      {u.id === ctx.user.id ? (
                        <input type="hidden" name="active" value="on" />
                      ) : (
                        <CheckboxField label={t.team.active} name="active" defaultChecked={u.active} className="pb-2.5" />
                      )}
                      <SubmitButton variant="secondary">{t.common.save}</SubmitButton>
                    </ActionForm>
                    <ResetPasswordButton userId={u.id} name={u.name} labels={{ ...t.team, create: t.common.create, save: t.common.save, close: t.common.close }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </>
  );
}
