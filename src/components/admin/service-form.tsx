import type { Locale, LocalizedText } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { saveServiceAction } from "@/app/[locale]/admin/actions/catalog";
import { ActionForm, CheckboxField, LocalizedFields, SelectField, SubmitButton, TextField } from "./form";

export interface ServiceFormValues {
  id: string;
  categoryId: string;
  name: LocalizedText;
  summary: LocalizedText;
  includes: LocalizedText[];
  durationMinutes: number;
  priceMnt: number;
  featured: boolean;
  active: boolean;
  sortOrder: number;
  barberIds: string[];
}

/** Create or edit a service, its price and duration, and the barbers who offer it. */
export function ServiceForm({
  locale,
  dict,
  mode,
  values,
  categories,
  barbers,
}: {
  locale: Locale;
  dict: Dictionary;
  mode: "create" | "update";
  values?: ServiceFormValues;
  categories: { id: string; name: unknown }[];
  barbers: { id: string; name: unknown; active: boolean }[];
}) {
  const t = dict.admin.services;
  const c = dict.admin.common;
  const lines = (list: LocalizedText[] | undefined, lang: "mn" | "en") => (list ?? []).map((s) => s[lang]).join("\n");
  return (
    <ActionForm action={saveServiceAction.bind(null, mode)} className="space-y-8">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-5 sm:grid-cols-2">
        {mode === "update" ? (
          <input type="hidden" name="id" value={values?.id} />
        ) : (
          <TextField label={c.slug} name="id" hint={c.slugHint} maxLength={48} pattern="[a-z0-9]+(-[a-z0-9]+)*" required />
        )}
        <SelectField
          label={t.category}
          name="categoryId"
          defaultValue={values?.categoryId}
          options={categories.map((cat) => ({ value: cat.id, label: (cat.name as LocalizedText)[locale] }))}
        />
      </div>
      <LocalizedFields label={t.name} name="name" defaultValue={values?.name} maxLength={80} required />
      <LocalizedFields label={t.summary} name="summary" defaultValue={values?.summary} multiline rows={3} maxLength={400} required />
      <LocalizedFields
        label={t.includes}
        name="includes"
        defaultValue={{ mn: lines(values?.includes, "mn"), en: lines(values?.includes, "en") }}
        multiline
        rows={4}
        hint={t.includesHint}
      />
      <div className="grid gap-5 sm:grid-cols-3">
        <TextField label={t.durationLabel} name="durationMinutes" type="number" min={5} max={480} step={5} defaultValue={values?.durationMinutes ?? 60} required />
        <TextField label={t.priceLabel} name="priceMnt" type="number" min={0} max={10_000_000} step={500} defaultValue={values?.priceMnt ?? 0} required />
        <TextField label={c.sortOrder} name="sortOrder" type="number" min={0} max={999} defaultValue={values?.sortOrder ?? 0} hint={c.sortOrderHint} />
      </div>

      <fieldset>
        <legend className="text-sm font-semibold">{t.eligibleBarbers}</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {barbers.map((b) => (
            <CheckboxField
              key={b.id}
              name="barberIds"
              value={b.id}
              label={
                <>
                  {(b.name as LocalizedText)[locale]}
                  {!b.active && <span className="ml-1.5 font-normal text-taupe">({c.inactive})</span>}
                </>
              }
              defaultChecked={values ? values.barberIds.includes(b.id) : b.active}
            />
          ))}
        </div>
      </fieldset>

      <div className="space-y-3">
        <CheckboxField label={c.active} name="active" defaultChecked={values?.active ?? true} hint={t.activeHint} />
        <CheckboxField label={t.featured} name="featured" defaultChecked={values?.featured ?? false} hint={t.featuredHint} />
      </div>
      <SubmitButton>{mode === "create" ? c.create : c.save}</SubmitButton>
    </ActionForm>
  );
}
