import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { routes } from "@/lib/navigation";
import { db } from "@/lib/server/db";
import { adminContext } from "@/lib/server/admin-context";
import { getBookingRules } from "@/lib/server/settings";
import { saveRulesAction } from "@/app/[locale]/admin/actions/settings";
import { ActionForm, CheckboxField, SubmitButton, TextField } from "@/components/admin/form";
import { Forbidden, PageHeader, PageSkeleton, Section, textLink } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.admin.nav.settings} · ${dict.meta.admin}`, robots: { index: false, follow: false } };
}

export default async function SettingsPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={<PageSkeleton label={dict.admin.common.loading} />}>
      <Settings locale={locale} dict={dict} />
    </Suspense>
  );
}

async function Settings({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const ctx = await adminContext(locale);
  if (!ctx.can("settings.manage")) return <Forbidden dict={dict} />;
  const t = dict.admin.settings;
  const rules = await getBookingRules(db);

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />
      <Section id={`rules-${locale}`} title={t.rules}>
        <ActionForm action={saveRulesAction} className="max-w-3xl">
          <dl className="mb-6 text-sm">
            <dt className="font-medium">{t.timeZone}</dt>
            <dd className="mt-1">
              <span className="tabular">{rules.timeZone}</span>
              <p className="mt-1 text-xs text-taupe-deep">{t.timeZoneHint}</p>
            </dd>
          </dl>
          <div className="grid gap-6 sm:grid-cols-2">
            <TextField label={t.slotInterval} name="slotIntervalMinutes" type="number" min={5} max={240} step={5} defaultValue={rules.slotIntervalMinutes} hint={t.slotIntervalHint} required />
            <TextField label={t.horizon} name="bookingHorizonDays" type="number" min={1} max={365} defaultValue={rules.bookingHorizonDays} hint={t.horizonHint} required />
            <TextField label={t.minLead} name="minLeadMinutes" type="number" min={0} max={10080} step={5} defaultValue={rules.minLeadMinutes} hint={t.minLeadHint} required />
            <TextField label={t.buffer} name="bufferMinutes" type="number" min={0} max={240} step={5} defaultValue={rules.bufferMinutes} hint={t.bufferHint} required />
            <TextField label={t.maxActive} name="maxActiveBookingsPerPhone" type="number" min={1} max={50} defaultValue={rules.maxActiveBookingsPerPhone} hint={t.maxActiveHint} required />
          </div>
          <CheckboxField label={t.autoConfirm} name="autoConfirm" defaultChecked={rules.autoConfirm} hint={t.autoConfirmHint} className="mt-6" />
          <div className="mt-8">
            <SubmitButton>{dict.admin.common.save}</SubmitButton>
          </div>
        </ActionForm>
        <p className="mt-10 text-sm text-taupe-deep">
          <Link href={localizedPath(locale, routes.adminContent)} className={textLink}>
            {t.contentLink}
          </Link>
        </p>
        {ctx.can("social.manage") && (
          <p className="mt-3 text-sm text-taupe-deep">
            <Link href={localizedPath(locale, routes.adminSocial)} className={textLink}>
              {t.socialLink}
            </Link>
          </p>
        )}
      </Section>
    </>
  );
}
