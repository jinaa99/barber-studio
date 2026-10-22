import type { Locale, LocalizedText } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { saveBarberAction } from "@/app/[locale]/admin/actions/catalog";
import { ActionForm, CheckboxField, GroupError, LocalizedFields, SubmitButton, TextField } from "./form";
import { MediaPicker, type MediaChoice } from "./media-picker";

export interface BarberFormValues {
  id: string;
  name: LocalizedText;
  role: LocalizedText;
  bio: LocalizedText;
  specialties: LocalizedText[];
  yearsExperience: number;
  imageId: string;
  active: boolean;
  sortOrder: number;
  serviceIds: string[];
}

/** Create or edit a barber profile and the services they offer. */
export function BarberForm({
  locale,
  dict,
  mode,
  values,
  services,
  images,
}: {
  locale: Locale;
  dict: Dictionary;
  mode: "create" | "update";
  values?: BarberFormValues;
  services: { id: string; name: unknown; active: boolean }[];
  /** Published library images and bundled photos (`mediaChoices`). */
  images: MediaChoice[];
}) {
  const t = dict.admin.barbers;
  const c = dict.admin.common;
  const lines = (list: LocalizedText[] | undefined, lang: "mn" | "en") => (list ?? []).map((s) => s[lang]).join("\n");

  return (
    <ActionForm action={saveBarberAction.bind(null, mode)} className="space-y-8">
      <input type="hidden" name="locale" value={locale} />
      {mode === "update" ? (
        <input type="hidden" name="id" value={values?.id} />
      ) : (
        <TextField label={c.slug} name="id" hint={c.slugHint} maxLength={48} pattern="[a-z0-9]+(-[a-z0-9]+)*" required className="max-w-sm" />
      )}
      <LocalizedFields label={t.name} name="name" defaultValue={values?.name} maxLength={80} required />
      <LocalizedFields label={t.role} name="role" defaultValue={values?.role} maxLength={80} required />
      <LocalizedFields label={t.bio} name="bio" defaultValue={values?.bio} multiline rows={5} maxLength={1200} required />
      <LocalizedFields
        label={t.specialties}
        name="specialties"
        defaultValue={{ mn: lines(values?.specialties, "mn"), en: lines(values?.specialties, "en") }}
        multiline
        rows={4}
        hint={t.specialtiesHint}
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <TextField label={t.years} name="yearsExperience" type="number" min={0} max={80} defaultValue={values?.yearsExperience ?? 0} />
        <TextField label={c.sortOrder} name="sortOrder" type="number" min={0} max={999} defaultValue={values?.sortOrder ?? 0} hint={c.sortOrderHint} />
      </div>

      <MediaPicker
        name="imageId"
        legend={t.photo}
        hint={t.photoHint}
        choices={images}
        defaultValue={values ? values.imageId : images.find((m) => !m.library)?.ref}
        libraryLabel={dict.admin.media.libraryBadge}
      >
        <GroupError name="imageId" />
      </MediaPicker>

      <fieldset>
        <legend className="text-sm font-semibold">{t.servicesOffered}</legend>
        <p className="mt-1 text-xs text-muted">{t.servicesHint}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {services.map((s) => (
            <CheckboxField
              key={s.id}
              name="serviceIds"
              value={s.id}
              label={
                <>
                  {(s.name as LocalizedText)[locale]}
                  {!s.active && <span className="ml-1.5 font-normal text-muted">({c.inactive})</span>}
                </>
              }
              defaultChecked={values?.serviceIds.includes(s.id)}
            />
          ))}
        </div>
      </fieldset>

      <CheckboxField label={c.active} name="active" defaultChecked={values?.active ?? true} hint={t.activeHint} />

      <SubmitButton>{mode === "create" ? c.create : c.save}</SubmitButton>
    </ActionForm>
  );
}
