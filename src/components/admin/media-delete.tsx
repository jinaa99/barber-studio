"use client";

import { deleteMediaAction } from "@/app/[locale]/admin/actions/media";
import { ActionForm, SubmitButton } from "./form";
import { DialogTrigger } from "./dialog";
import { dangerSmallButton } from "./ui";

/** Delete a library item after confirming in a dialog. */
export function DeleteMediaButton({
  locale,
  id,
  labels,
}: {
  locale: string;
  id: string;
  labels: { delete: string; close: string; title: string; body: string };
}) {
  return (
    <DialogTrigger label={labels.delete} title={labels.title} closeLabel={labels.close} triggerClassName={dangerSmallButton}>
      {() => (
        <ActionForm action={deleteMediaAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={id} />
          <p className="mb-4 text-sm text-taupe-deep">{labels.body}</p>
          <SubmitButton variant="danger">{labels.delete}</SubmitButton>
        </ActionForm>
      )}
    </DialogTrigger>
  );
}
