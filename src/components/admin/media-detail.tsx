import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { Locale, LocalizedText } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { localizedPath } from "@/i18n/config";
import { routes } from "@/lib/navigation";
import { format } from "@/lib/format";
import { dateTime } from "@/lib/admin/format";
import { formatBytes, formatClipLength, OWN_MEDIA_LICENSE } from "@/lib/admin/media";
import { assetRef, mediaFileUrl } from "@/lib/media/refs";
import { GALLERY_SLOT, heroSceneIds, heroSlot, pageSlotIds, type MediaSlot } from "@/lib/media/slots";
import type { HeroClipId } from "@/content/types";
import type { MediaAssetRow } from "@/lib/server/media-library";
import {
  addGalleryItemAction,
  placeMediaAction,
  removePlacementAction,
  replaceMediaAction,
  setMediaStatusAction,
  updateMediaAction,
} from "@/app/[locale]/admin/actions/media";
import { ActionForm, LocalizedFields, SelectField, SubmitButton, TextAreaField, TextField } from "./form";
import { DeleteMediaButton } from "./media-delete";
import { MediaPicker, MediaThumb, type MediaChoice } from "./media-picker";
import { Notice, Tag, textLink } from "./ui";

type Strings = Dictionary["admin"]["media"];

/** Human label for a website slot, e.g. "Hero · Arrival: video". */
export function slotLabel(slot: string, t: Strings): string {
  const hero = /^hero\.([a-z]+)\.(still|video)$/.exec(slot);
  if (hero) return format(hero[2] === "video" ? t.heroVideo : t.heroStill, { scene: t.heroScenes[hero[1] as HeroClipId] });
  return t.slots[slot as keyof Strings["slots"]] ?? slot;
}

const providerLabel = { PEXELS: "Pexels", PIXABAY: "Pixabay" } as const;

/** One library item: preview, credits, publication, where it's used, and what can be done with it. */
export function MediaDetail({
  locale,
  dict,
  asset,
  usages,
  replacements,
  barbers,
  timeZone,
}: {
  locale: Locale;
  dict: Dictionary;
  asset: MediaAssetRow;
  usages: { placements: { id: string; slot: string; caption: unknown }[]; barbers: { id: string; name: unknown }[] };
  /** Other published assets of the same kind, for "replace everywhere". */
  replacements: MediaChoice[];
  barbers: { id: string; name: unknown }[];
  timeZone: string;
}) {
  const t = dict.admin.media;
  const d = t.detail;
  const c = dict.admin.common;
  const alt = (asset.alt as Partial<LocalizedText> | null) ?? {};
  const uses = usages.placements.length + usages.barbers.length;
  const published = asset.status === "PUBLISHED";
  const isUpload = asset.source === "UPLOAD";
  const own = isUpload && asset.licenseName === OWN_MEDIA_LICENSE;
  const file = mediaFileUrl(asset.fileName);
  const poster = asset.posterFileName ? mediaFileUrl(asset.posterFileName) : undefined;
  const slots: MediaSlot[] =
    asset.kind === "IMAGE" ? [...pageSlotIds, ...heroSceneIds.map((s) => heroSlot(s, "still"))] : heroSceneIds.map((s) => heroSlot(s, "video"));
  const name = (value: unknown) => (value as LocalizedText)[locale];

  return (
    <div className="space-y-8 text-sm">
      <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <div className="relative aspect-[4/3] overflow-hidden bg-ink">
            {asset.kind === "VIDEO" ? (
              <video src={file} poster={poster} controls muted playsInline preload="metadata" className="size-full object-contain" />
            ) : (
              <MediaThumb src={file} alt={alt[locale] ?? ""} sizes="(min-width: 768px) 520px, 100vw" fit="contain" />
            )}
          </div>
          <a href={file} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
            {d.openFile}
            <ExternalLink aria-hidden className="size-3" strokeWidth={1.75} />
          </a>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone={published ? "solid" : "default"}>{t.statuses[asset.status]}</Tag>
            <Tag>{t.kinds[asset.kind]}</Tag>
            <Tag>{t.sources[asset.source]}</Tag>
          </div>
          <ActionForm action={setMediaStatusAction} className="mt-4">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={asset.id} />
            <input type="hidden" name="status" value={published ? "DRAFT" : "PUBLISHED"} />
            <p className="mb-3 text-xs leading-relaxed text-muted">{published ? (uses > 0 ? format(d.unpublishHint, { count: uses }) : d.publishedHint) : d.publishHint}</p>
            <SubmitButton variant={published ? "secondary" : "primary"}>{published ? d.unpublish : d.publish}</SubmitButton>
          </ActionForm>

          <dl className="mt-6 space-y-2.5">
            <Row label={d.source}>
              {asset.sourceUrl ? (
                <a href={asset.sourceUrl} target="_blank" rel="noopener noreferrer" className={textLink}>
                  {isUpload ? asset.sourceUrl : format(d.viewOn, { provider: providerLabel[asset.source as keyof typeof providerLabel] })}
                </a>
              ) : (
                t.sources[asset.source]
              )}
            </Row>
            <Row label={d.creator}>
              {asset.creatorName ? (
                asset.creatorUrl ? (
                  <a href={asset.creatorUrl} target="_blank" rel="noopener noreferrer" className={textLink}>
                    {asset.creatorName}
                  </a>
                ) : (
                  asset.creatorName
                )
              ) : (
                <span className="text-muted">{d.unknownCreator}</span>
              )}
            </Row>
            <Row label={d.license}>
              {own ? (
                d.ownMedia
              ) : asset.licenseUrl ? (
                <a href={asset.licenseUrl} target="_blank" rel="noopener noreferrer" className={textLink}>
                  {asset.licenseName}
                </a>
              ) : (
                asset.licenseName
              )}
            </Row>
            {asset.providerAssetId && <Row label={d.providerId}>{asset.providerAssetId}</Row>}
            <Row label={d.dimensions}>
              <span className="tabular">
                {asset.width && asset.height ? `${asset.width} × ${asset.height}` : c.notSet}
                {asset.durationSeconds != null && ` · ${formatClipLength(asset.durationSeconds)}`}
              </span>
            </Row>
            <Row label={d.file}>
              <span className="tabular">
                {asset.mimeType} · {formatBytes(asset.bytes)}
              </span>
            </Row>
            <Row label={d.saved}>
              {dateTime(asset.createdAt, timeZone, locale, dict)}
              {asset.createdBy && ` · ${asset.createdBy.name}`}
            </Row>
            {asset.providerDescription && <Row label={d.providerDescription}>{asset.providerDescription}</Row>}
          </dl>
        </div>
      </div>

      <section aria-labelledby={`usage-${asset.id}`}>
        <h3 id={`usage-${asset.id}`} className="font-semibold">
          {d.usage}
        </h3>
        {uses === 0 ? (
          <p className="mt-2 text-muted">{d.unused}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {usages.placements.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span>
                  {p.slot === GALLERY_SLOT ? format(d.galleryItem, { caption: (p.caption as LocalizedText | null)?.[locale] ?? "" }) : slotLabel(p.slot, t)}
                </span>
                <ActionForm action={removePlacementAction} showSuccess={false}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="placementId" value={p.id} />
                  <SubmitButton variant="secondary">{c.remove}</SubmitButton>
                </ActionForm>
              </li>
            ))}
            {usages.barbers.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span>{format(d.barberPhoto, { name: name(b.name) })}</span>
                <Link href={localizedPath(locale, `${routes.adminBarbers}/${b.id}`)} className={textLink}>
                  {c.edit}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!published && uses > 0 && <Notice className="mt-3">{format(d.draftInUse, { count: uses })}</Notice>}
      </section>

      {published ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <ActionForm action={placeMediaAction} className="space-y-4">
            <h3 className="font-semibold">{d.place}</h3>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={asset.id} />
            <SelectField
              label={d.slot}
              name="slot"
              hint={d.placeHint}
              options={[{ value: "", label: d.chooseSlot }, ...slots.map((s) => ({ value: s, label: slotLabel(s, t) }))]}
              defaultValue=""
            />
            <SubmitButton>{d.placeSubmit}</SubmitButton>
          </ActionForm>

          {asset.kind === "IMAGE" && (
            <ActionForm action={addGalleryItemAction} className="space-y-4">
              <h3 className="font-semibold">{d.gallery}</h3>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={asset.id} />
              <LocalizedFields label={d.caption} name="caption" maxLength={80} required />
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label={d.layout}
                  name="layout"
                  options={(["portrait", "landscape"] as const).map((l) => ({ value: l, label: d.layouts[l] }))}
                  defaultValue={asset.width && asset.height && asset.width > asset.height ? "landscape" : "portrait"}
                />
                <SelectField
                  label={d.galleryBarber}
                  name="barberId"
                  optional
                  options={[{ value: "", label: d.noBarber }, ...barbers.map((b) => ({ value: b.id, label: name(b.name) }))]}
                  defaultValue=""
                />
              </div>
              <SubmitButton>{d.gallerySubmit}</SubmitButton>
            </ActionForm>
          )}
        </div>
      ) : (
        <Notice>{d.publishFirst}</Notice>
      )}

      <ActionForm action={updateMediaAction} className="space-y-5 border-t border-line pt-6">
        <h3 className="font-semibold">{d.details}</h3>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={asset.id} />
        <LocalizedFields label={d.alt} name="alt" defaultValue={{ mn: alt.mn ?? "", en: alt.en ?? "" }} maxLength={300} hint={d.altHint} />
        {isUpload ? (
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">{d.credit}</legend>
            <SelectField
              label={t.upload.rights}
              name="rights"
              options={(["own", "licensed"] as const).map((r) => ({ value: r, label: t.upload.rightsOptions[r] }))}
              defaultValue={own ? "own" : "licensed"}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={t.upload.licenseName} name="licenseName" errorKey="licenseName" defaultValue={own ? "" : asset.licenseName} maxLength={120} hint={t.upload.licenseNameHint} />
              <TextField label={t.upload.licenseUrl} name="licenseUrl" type="url" defaultValue={asset.licenseUrl ?? ""} maxLength={500} />
              <TextField label={t.upload.creatorName} name="creatorName" defaultValue={asset.creatorName ?? ""} maxLength={120} optional />
              <TextField label={t.upload.sourceUrl} name="sourceUrl" type="url" defaultValue={asset.sourceUrl ?? ""} maxLength={500} optional />
            </div>
          </fieldset>
        ) : (
          <p className="text-xs leading-relaxed text-muted">{format(d.creditFixed, { provider: t.sources[asset.source] })}</p>
        )}
        <TextAreaField label={d.notes} name="notes" defaultValue={asset.notes ?? ""} rows={2} maxLength={1000} optional hint={d.notesHint} />
        <SubmitButton>{c.save}</SubmitButton>
      </ActionForm>

      {uses > 0 && (
        <ActionForm action={replaceMediaAction} className="space-y-4 border-t border-line pt-6">
          <h3 className="font-semibold">{d.replace}</h3>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={asset.id} />
          {replacements.length === 0 ? (
            <p className="text-muted">{d.noReplacement}</p>
          ) : (
            <>
              <MediaPicker
                name="replacement"
                legend={d.replaceWith}
                hint={d.replaceHint}
                choices={replacements}
                libraryLabel={t.libraryBadge}
                ratio={asset.kind === "VIDEO" ? "landscape" : "portrait"}
              />
              <SubmitButton>{d.replaceSubmit}</SubmitButton>
            </>
          )}
        </ActionForm>
      )}

      <div className="border-t border-line pt-6">
        <h3 className="font-semibold">{d.delete}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">{uses > 0 ? d.deleteInUse : d.deleteHint}</p>
        {uses === 0 && (
          <div className="mt-3">
            <DeleteMediaButton locale={locale} id={asset.id} labels={{ delete: c.delete, close: c.close, title: d.deleteConfirm, body: d.deleteHint }} />
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** Choices for replacing `asset`: other published assets of its kind. */
export function replacementChoices(asset: MediaAssetRow, choices: MediaChoice[]): MediaChoice[] {
  return choices.filter((c) => c.library && c.ref !== assetRef(asset.id));
}
