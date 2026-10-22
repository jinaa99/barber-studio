import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { dateTime } from "@/lib/admin/format";
import { addTimeOffAction, deleteTimeOffAction } from "@/app/[locale]/admin/actions/catalog";
import { ActionForm, CheckboxField, SubmitButton, TextField } from "./form";

/** Upcoming time off for one barber (or studio closures) with add and remove. */
export function TimeOffManager({
  locale,
  dict,
  barberId,
  entries,
  timeZone,
  today,
  emptyLabel,
  addLabel,
}: {
  locale: Locale;
  dict: Dictionary;
  /** A barber id, or "studio" for closures. */
  barberId: string;
  entries: { id: string; startsAt: Date; endsAt: Date; reason: string | null }[];
  timeZone: string;
  today: string;
  emptyLabel: string;
  addLabel: string;
}) {
  const t = dict.admin.barbers;
  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div>
        {entries.length === 0 ? (
          <p className="text-sm text-muted">{emptyLabel}</p>
        ) : (
          <ul className="border-t border-line">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 text-sm">
                <span className="min-w-0">
                  <span className="tabular block font-medium">
                    {dateTime(e.startsAt, timeZone, locale, dict)} – {dateTime(e.endsAt, timeZone, locale, dict)}
                  </span>
                  {e.reason && <span className="block text-muted">{e.reason}</span>}
                </span>
                <ActionForm action={deleteTimeOffAction} showSuccess={false}>
                  <input type="hidden" name="id" value={e.id} />
                  <SubmitButton variant="secondary">{dict.admin.common.remove}</SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ActionForm action={addTimeOffAction} className="border border-line p-4 sm:p-5">
        <input type="hidden" name="barberId" value={barberId} />
        <h3 className="text-sm font-semibold">{addLabel}</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField label={t.startDate} name="startDate" type="date" defaultValue={today} min={today} required />
          <TextField label={t.endDate} name="endDate" type="date" defaultValue={today} min={today} required />
          <CheckboxField label={t.allDay} name="allDay" defaultChecked className="sm:col-span-2" />
          <TextField label={t.startTime} name="startTime" type="time" step={300} optional />
          <TextField label={t.endTime} name="endTime" type="time" step={300} optional />
          <TextField label={t.reason} name="reason" maxLength={200} optional className="sm:col-span-2" />
        </div>
        <div className="mt-5">
          <SubmitButton>{addLabel}</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
