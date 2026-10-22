"use client";

import { disconnectAction } from "@/app/[locale]/admin/actions/social";
import { ActionForm, SubmitButton } from "./form";
import { DialogTrigger } from "./dialog";
import { dangerSmallButton } from "./ui";

/** Disconnect a social account after confirming in a dialog. */
export function DisconnectSocialButton({
  locale,
  provider,
  labels,
}: {
  locale: string;
  provider: string;
  labels: { disconnect: string; close: string; title: string; body: string; revokeHint: string };
}) {
  return (
    <DialogTrigger label={labels.disconnect} title={labels.title} closeLabel={labels.close} triggerClassName={dangerSmallButton}>
      {() => (
        <ActionForm action={disconnectAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="provider" value={provider} />
          <p className="text-sm text-taupe-deep">{labels.body}</p>
          <p className="mt-3 mb-4 text-sm text-taupe-deep">{labels.revokeHint}</p>
          <SubmitButton variant="danger">{labels.disconnect}</SubmitButton>
        </ActionForm>
      )}
    </DialogTrigger>
  );
}
