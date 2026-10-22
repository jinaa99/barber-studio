"use client";

import type { AppointmentStatus } from "@/generated/prisma/enums";
import type { Locale } from "@/i18n/config";
import { changeStatusAction } from "@/app/[locale]/admin/actions/appointments";
import { ActionForm, SubmitButton, TextAreaField } from "./form";
import { DialogTrigger } from "./dialog";
import { dangerSmallButton } from "./ui";

interface Labels {
  actions: Record<AppointmentStatus, string>;
  cancelTitle: string;
  cancelBody: string;
  cancelReasonLabel: string;
  confirmCancel: string;
  keep: string;
  close: string;
  saving: string;
}

/**
 * The status changes the lifecycle allows right now (computed on the server).
 * Cancelling asks for confirmation and an optional internal reason.
 */
export function StatusActions({
  locale,
  appointmentId,
  next,
  labels,
}: {
  locale: Locale;
  appointmentId: string;
  next: AppointmentStatus[];
  labels: Labels;
}) {
  const direct = next.filter((s) => s !== "CANCELLED");
  return (
    <div className="flex flex-wrap items-start gap-2">
      {direct.map((status) => (
        <ActionForm key={status} action={changeStatusAction} showSuccess={false}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <input type="hidden" name="status" value={status} />
          <SubmitButton variant={status === "CONFIRMED" || status === "COMPLETED" ? "primary" : "secondary"} pendingLabel={labels.saving}>
            {labels.actions[status]}
          </SubmitButton>
        </ActionForm>
      ))}
      {next.includes("CANCELLED") && (
        <DialogTrigger label={labels.actions.CANCELLED} title={labels.cancelTitle} closeLabel={labels.close} triggerClassName={dangerSmallButton}>
          {(close) => (
            <ActionForm action={changeStatusAction} onSuccess={close} showSuccess={false}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="appointmentId" value={appointmentId} />
              <input type="hidden" name="status" value="CANCELLED" />
              <p className="text-sm leading-relaxed text-muted">{labels.cancelBody}</p>
              <TextAreaField label={labels.cancelReasonLabel} name="reason" rows={3} maxLength={300} className="mt-5" />
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={close} className="h-9 rounded-full px-4 text-sm font-medium hover:bg-stone">
                  {labels.keep}
                </button>
                <SubmitButton variant="danger" pendingLabel={labels.saving}>
                  {labels.confirmCancel}
                </SubmitButton>
              </div>
            </ActionForm>
          )}
        </DialogTrigger>
      )}
    </div>
  );
}
