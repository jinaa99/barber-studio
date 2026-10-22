import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath, type Locale, type LocalizedText } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { mn } from "@/i18n/dictionaries/mn";
import { en } from "@/i18n/dictionaries/en";
import { galleryRecords } from "@/content/demo/gallery";
import { heroClipRecords, mediaRecords } from "@/content/media";
import { routes } from "@/lib/navigation";
import { format } from "@/lib/format";
import { dictionaryText, editableTexts, weekdayOrder } from "@/lib/admin/content";
import { parseMediaRef } from "@/lib/media/refs";
import { GALLERY_SLOT, heroSlot, pageSlotIds, pageSlots, resolveHeroOptions } from "@/lib/media/slots";
import { db } from "@/lib/server/db";
import { adminContext } from "@/lib/server/admin-context";
import { readSiteContent } from "@/lib/server/content";
import { listPlacements } from "@/lib/server/media-library";
import { saveGalleryAction, saveProfileAction, saveTextsAction } from "@/app/[locale]/admin/actions/settings";
import { saveHeroSceneAction, savePageImagesAction } from "@/app/[locale]/admin/actions/media";
import { ActionForm, CheckboxField, LocalizedFields, SubmitButton, TextField } from "@/components/admin/form";
import { mediaChoices, MediaPicker, MediaThumb } from "@/components/admin/media-picker";
import { slotLabel } from "@/components/admin/media-detail";
import { Forbidden, inputClass, Notice, PageHeader, PageSkeleton, Section, textLink } from "@/components/admin/ui";

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
  const m = dict.admin.media;
  const canMedia = ctx.can("media.manage");
  const [{ profile, texts, gallery }, placements, images, videos] = await Promise.all([
    readSiteContent(db),
    listPlacements(db),
    mediaChoices(locale, "IMAGE"),
    mediaChoices(locale, "VIDEO"),
  ]);
  const placed = (slot: string) => placements.find((p) => p.slot === slot);
  const mediaHref = localizedPath(locale, routes.adminMedia);
  // Bundled items first, then photos added from the media library, as the site lists them.
  const galleryItems = [
    ...galleryRecords.map((g) => ({ id: g.id, title: g.title[locale], ref: g.imageId, libraryId: null as string | null })),
    ...placements
      .filter((p) => p.slot === GALLERY_SLOT)
      .map((p) => {
        const ref = parseMediaRef(p.ref);
        return { id: p.id, title: (p.caption as LocalizedText | null)?.[locale] ?? "", ref: p.ref, libraryId: ref?.type === "asset" ? ref.id : null };
      }),
  ];
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
            {galleryItems.map((g, index) => {
              const choice = images.find((c) => c.ref === g.ref);
              const position = galleryPosition(g.id, index);
              return (
                <li key={g.id} className="flex gap-3 border border-line p-3">
                  <span className="relative block aspect-square w-16 shrink-0 overflow-hidden bg-paper-deep">
                    {choice && <MediaThumb src={choice.src} alt="" sizes="64px" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{g.title}</p>
                    {g.libraryId && (
                      <p className="mt-0.5 text-xs text-taupe-deep">
                        {choice ? m.libraryBadge : m.galleryUnpublished} ·{" "}
                        <Link href={`${mediaHref}?asset=${g.libraryId}`} className={textLink}>
                          {m.manage}
                        </Link>
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-taupe-deep">
                        {t.galleryOrder}
                        <input type="number" name={`position.${g.id}`} min={1} max={999} defaultValue={position} className={`${inputClass} h-8 w-16 px-2`} />
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
          <p className="mt-4 text-xs text-taupe-deep">
            {m.galleryAddHint}{" "}
            <Link href={mediaHref} className={textLink}>
              {m.title}
            </Link>
          </p>
          <div className="mt-5">
            <SubmitButton>{t.saveGallery}</SubmitButton>
          </div>
        </ActionForm>
      </Section>

      {canMedia && (
        <Section id={`hero-${locale}`} title={t.hero} lead={t.heroLead}>
          {images.every((c) => !c.library) && videos.length === 0 && (
            <Notice className="mb-6">
              {m.noPublished}{" "}
              <Link href={mediaHref} className={textLink}>
                {m.title}
              </Link>
            </Notice>
          )}
          <div className="space-y-6">
            {heroClipRecords.map((clip) => {
              const still = placed(heroSlot(clip.id, "still"));
              const video = placed(heroSlot(clip.id, "video"));
              const focus = resolveHeroOptions(still?.options) ?? { focusX: 50, focusY: 50 };
              const custom = Boolean(still || video);
              const current = still ? images.find((c) => c.ref === still.ref) : video ? videos.find((c) => c.ref === video.ref) : null;
              return (
                <details key={clip.id} className="group border border-line" open={custom}>
                  <summary className="flex cursor-pointer list-none items-center gap-4 p-3 [&::-webkit-details-marker]:hidden">
                    <span className="relative block aspect-video w-28 shrink-0 overflow-hidden bg-paper-deep">
                      {current ? (
                        <MediaThumb src={current.src} alt="" sizes="112px" />
                      ) : (
                        clip.poster && <Image src={clip.poster} alt="" fill sizes="112px" className="object-cover" placeholder="blur" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{m.heroScenes[clip.id]}</span>
                      <span className="block text-xs text-taupe-deep">
                        {custom ? m.heroCustom : format(m.heroBundled, { title: clip.credit?.title ?? clip.id, provider: clip.credit?.provider ?? "" })}
                      </span>
                    </span>
                    <span className="text-xs text-taupe-deep group-open:hidden">{dict.admin.common.edit}</span>
                  </summary>
                  <ActionForm action={saveHeroSceneAction} className="space-y-6 border-t border-line p-4">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="scene" value={clip.id} />
                    <MediaPicker
                      name="still"
                      legend={slotLabel(heroSlot(clip.id, "still"), m)}
                      hint={m.heroStillHint}
                      choices={images}
                      defaultValue={still?.ref}
                      none={m.noStill}
                      libraryLabel={m.libraryBadge}
                      ratio="landscape"
                    />
                    <MediaPicker
                      name="video"
                      legend={slotLabel(heroSlot(clip.id, "video"), m)}
                      hint={m.heroVideoHint}
                      choices={videos}
                      defaultValue={video?.ref}
                      none={m.noVideo}
                      libraryLabel={m.libraryBadge}
                      ratio="landscape"
                    />
                    <div className="grid max-w-md grid-cols-2 gap-4">
                      <TextField label={m.focusX} name="focusX" type="number" min={0} max={100} defaultValue={focus.focusX} />
                      <TextField label={m.focusY} name="focusY" type="number" min={0} max={100} defaultValue={focus.focusY} />
                    </div>
                    <p className="-mt-3 text-xs text-taupe-deep">{m.focusHint}</p>
                    <div className="flex flex-wrap gap-2">
                      <SubmitButton>{c.save}</SubmitButton>
                      {custom && (
                        <SubmitButton variant="secondary" name="intent" value="reset">
                          {m.restoreScene}
                        </SubmitButton>
                      )}
                    </div>
                  </ActionForm>
                </details>
              );
            })}
          </div>
        </Section>
      )}

      {canMedia && (
        <Section id={`page-media-${locale}`} title={m.pagePhotos} lead={m.pagePhotosLead}>
          <ActionForm action={savePageImagesAction} className="space-y-8">
            <input type="hidden" name="locale" value={locale} />
            {pageSlotIds.map((slot) => {
              const fallback = mediaRecords.find((r) => r.id === pageSlots[slot].fallback);
              return (
                <MediaPicker
                  key={slot}
                  name={slot}
                  legend={slotLabel(slot, m)}
                  hint={format(m.pagePhotoDefault, { title: fallback?.alt[locale] ?? pageSlots[slot].fallback })}
                  choices={images}
                  defaultValue={placed(slot)?.ref}
                  none={m.useDefault}
                  libraryLabel={m.libraryBadge}
                />
              );
            })}
            <SubmitButton>{c.save}</SubmitButton>
          </ActionForm>
          <p className="mt-6 text-sm text-taupe-deep">
            <Link href={localizedPath(locale, routes.adminBarbers)} className={textLink}>
              {t.barbersLink}
            </Link>
          </p>
        </Section>
      )}
    </>
  );
}
