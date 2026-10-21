import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { mn } from "@/i18n/dictionaries/mn";
import { en } from "@/i18n/dictionaries/en";
import { galleryRecords } from "@/content/demo/gallery";
import { heroClipRecords, mediaRecords } from "@/content/media";
import { routes } from "@/lib/navigation";
import { dictionaryText, editableTexts, weekdayOrder } from "@/lib/admin/content";
import { db } from "@/lib/server/db";
import { adminContext } from "@/lib/server/admin-context";
import { readSiteContent } from "@/lib/server/content";
import { saveGalleryAction, saveProfileAction, saveTextsAction } from "@/app/[locale]/admin/actions/settings";
import { ActionForm, CheckboxField, LocalizedFields, SubmitButton, TextField } from "@/components/admin/form";
import { Forbidden, inputClass, PageHeader, PageSkeleton, Section, Tag, textLink } from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.admin.nav.content} · ${dict.meta.admin}`, robots: { index: false, follow: false } };
}

export default async function ContentPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={<PageSkeleton label={dict.admin.common.loading} />}>
      <Content locale={locale} dict={dict} />
    </Suspense>
  );
}

async function Content({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const ctx = await adminContext(locale);
  if (!ctx.can("settings.manage")) return <Forbidden dict={dict} />;
  const t = dict.admin.content;
  const c = dict.admin.common;
  const { profile, texts, gallery } = await readSiteContent(db);
  const socials = [0, 1, 2, 3].map((i) => profile.socials[i] ?? { label: "", handle: "", href: null });
  const galleryPosition = (id: string, index: number) => {
    const i = gallery.order.indexOf(id);
    return i === -1 ? gallery.order.length + index + 1 : i + 1;
  };

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      <Section id={`profile-${locale}`} title={t.profile}>
        <ActionForm action={saveProfileAction} className="max-w-3xl space-y-8">
          <div className="grid gap-5 sm:grid-cols-3">
            <TextField label={t.studioName} name="name" defaultValue={profile.name} maxLength={60} required />
            <TextField label={`${t.wordmark}: ${t.wordmarkPrimary}`} name="wordmark.primary" defaultValue={profile.wordmark.primary} maxLength={24} required hint={t.wordmarkHint} />
            <TextField label={`${t.wordmark}: ${t.wordmarkSecondary}`} name="wordmark.secondary" defaultValue={profile.wordmark.secondary} maxLength={12} optional />
          </div>
          <CheckboxField label={t.demoFlag} name="isDemo" defaultChecked={profile.isDemo} hint={t.demoFlagHint} />
          <LocalizedFields label={t.address} name="contact.address" defaultValue={profile.contact.address} maxLength={200} required />
          <LocalizedFields label={t.city} name="contact.city" defaultValue={profile.contact.city} maxLength={100} required />
          <LocalizedFields label={t.directions} name="contact.directions" defaultValue={profile.contact.directions} multiline rows={3} maxLength={600} />
          <div className="grid gap-5 sm:grid-cols-3">
            <TextField label={t.phoneDisplay} name="contact.phoneDisplay" type="tel" defaultValue={profile.contact.phoneDisplay} maxLength={40} />
            <TextField label={t.contactEmail} name="contact.email" type="email" defaultValue={profile.contact.email} maxLength={254} />
            <TextField label={t.mapsUrl} name="contact.mapsUrl" type="url" defaultValue={profile.contact.mapsUrl} maxLength={500} />
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">{t.openingHours}</legend>
            <p className="mt-1 text-xs text-taupe-deep">{t.openingHoursHint}</p>
            <div className="mt-3 divide-y divide-line border-y border-line">
              {weekdayOrder.map((day, i) => {
                const hours = profile.hours.find((h) => h.day === day);
                return (
                  <div key={day} className="grid grid-cols-2 items-end gap-3 py-3 sm:grid-cols-[8rem_7rem_7rem_auto]">
                    <span className="col-span-2 pb-2 text-sm font-medium sm:col-span-1">{dict.weekdays[day]}</span>
                    <TextField label={t.open} name={`hours.${i}.open`} type="time" step={300} defaultValue={hours?.open ?? "10:00"} />
                    <TextField label={t.closeTime} name={`hours.${i}.close`} type="time" step={300} defaultValue={hours?.close ?? "20:00"} />
                    <CheckboxField label={t.closed} name={`hours.${i}.closed`} defaultChecked={!hours?.open} className="col-span-2 pb-2.5 sm:col-span-1" />
                  </div>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold">{t.socials}</legend>
            <p className="mt-1 text-xs text-taupe-deep">{t.socialsHint}</p>
            <div className="mt-3 space-y-3">
              {socials.map((s, i) => (
                <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
                  <TextField label={t.socialLabel} name={`socials.${i}.label`} defaultValue={s.label} maxLength={40} />
                  <TextField label={t.socialHandle} name={`socials.${i}.handle`} defaultValue={s.handle} maxLength={80} />
                  <TextField label={t.socialUrl} name={`socials.${i}.href`} type="url" defaultValue={s.href ?? ""} maxLength={500} placeholder="https://" />
                </div>
              ))}
            </div>
          </fieldset>
          <SubmitButton>{c.save}</SubmitButton>
        </ActionForm>
      </Section>

      <Section id={`copy-${locale}`} title={t.copy} lead={t.copyLead}>
        <ActionForm action={saveTextsAction} className="max-w-3xl space-y-8">
          {editableTexts.map(({ key, max, ...rest }) => (
            <div key={key}>
              <LocalizedFields
                label={t.textKeys[key]}
                name={key}
                defaultValue={texts[key] ?? { mn: "", en: "" }}
                multiline={"multiline" in rest}
                rows={"list" in rest ? 5 : 3}
                maxLength={max}
              />
              <details className="mt-2 text-xs text-taupe-deep">
                <summary className="cursor-pointer hover:text-ink">{t.showDefault}</summary>
                <div className="mt-2 grid gap-4 whitespace-pre-line sm:grid-cols-2">
                  <p lang="mn">{dictionaryText(mn, key)}</p>
                  <p lang="en">{dictionaryText(en, key)}</p>
                </div>
              </details>
            </div>
          ))}
          <SubmitButton>{c.save}</SubmitButton>
        </ActionForm>
      </Section>

      <Section id={`gallery-${locale}`} title={t.gallery} lead={t.galleryLead}>
        <ActionForm action={saveGalleryAction}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {galleryRecords.map((g, index) => {
              const media = mediaRecords.find((m) => m.id === g.imageId);
              const position = galleryPosition(g.id, index);
              return (
                <li key={g.id} className="flex gap-3 border border-line p-3">
                  <span className="relative block aspect-square w-16 shrink-0 overflow-hidden bg-paper-deep">
                    {media?.src && <Image src={media.src} alt="" fill sizes="64px" className="object-cover" placeholder="blur" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{g.title[locale]}</p>
                    <div className="mt-2 flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-taupe-deep">
                        {t.galleryOrder}
                        <input type="number" name={`position.${g.id}`} min={1} max={99} defaultValue={position} className={`${inputClass} h-8 w-16 px-2`} />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-taupe-deep">
                        <input type="checkbox" name="hidden" value={g.id} defaultChecked={gallery.hidden.includes(g.id)} className="size-4 accent-ink" />
                        {t.galleryHidden}
                      </label>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-5">
            <SubmitButton>{t.saveGallery}</SubmitButton>
          </div>
        </ActionForm>
      </Section>

      <Section id={`hero-${locale}`} title={t.hero} lead={t.heroLead} actions={<Tag>{t.heroPhase}</Tag>}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {heroClipRecords.map((clip) => (
            <li key={clip.id} className="border border-line p-3">
              <span className="relative block aspect-video overflow-hidden bg-paper-deep">
                {clip.poster && <Image src={clip.poster} alt={clip.alt[locale]} fill sizes="(min-width: 1024px) 220px, 45vw" className="object-cover" />}
              </span>
              <p className="mt-2 text-sm font-medium">{clip.credit?.title ?? clip.id}</p>
              <p className="text-xs text-taupe-deep">
                {clip.credit?.provider} · {clip.playback}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-taupe-deep">
          <Link href={localizedPath(locale, routes.adminBarbers)} className={textLink}>
            {t.barbersLink}
          </Link>
        </p>
      </Section>
    </>
  );
}
