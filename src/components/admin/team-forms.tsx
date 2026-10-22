"use client";

import { createAccountAction, resetPasswordAction } from "@/app/[locale]/admin/actions/settings";
import { ActionForm, SelectField, SubmitButton, TextField } from "./form";
import { DialogTrigger } from "./dialog";
import { primarySmallButton } from "./ui";

interface Option {
  value: string;
  label: string;
}

interface Labels {
  add: string;
  name: string;
  email: string;
  role: string;
  password: string;
  passwordHint: string;
  linkedBarber: string;
  linkedBarberHint: string;
  resetPassword: string;
  resetHint: string;
  create: string;
  save: string;
  close: string;
}

export function CreateAccountButton({ labels, roles, barbers }: { labels: Labels; roles: Option[]; barbers: Option[] }) {
  return (
    <DialogTrigger label={labels.add} title={labels.add} closeLabel={labels.close} triggerClassName={primarySmallButton}>
      {(close) => (
        <ActionForm action={createAccountAction} onSuccess={close} className="space-y-4">
          <TextField label={labels.name} name="name" autoComplete="off" maxLength={80} required />
          <TextField label={labels.email} name="email" type="email" autoComplete="off" maxLength={254} required />
          <SelectField label={labels.role} name="role" options={roles} defaultValue="STAFF" />
          <SelectField label={labels.linkedBarber} name="barberId" options={barbers} hint={labels.linkedBarberHint} />
          <TextField label={labels.password} name="password" type="password" autoComplete="new-password" minLength={12} maxLength={200} hint={labels.passwordHint} required />
          <div className="flex justify-end pt-2">
            <SubmitButton>{labels.create}</SubmitButton>
          </div>
        </ActionForm>
      )}
    </DialogTrigger>
  );
}

export function ResetPasswordButton({ userId, name, labels }: { userId: string; name: string; labels: Labels }) {
  return (
    <DialogTrigger label={labels.resetPassword} title={`${labels.resetPassword}: ${name}`} closeLabel={labels.close}>
      {(close) => (
        <ActionForm action={resetPasswordAction} onSuccess={close} className="space-y-4">
          <input type="hidden" name="userId" value={userId} />
          <p className="text-sm text-muted">{labels.resetHint}</p>
          <TextField label={labels.password} name="password" type="password" autoComplete="new-password" minLength={12} maxLength={200} hint={labels.passwordHint} required />
          <div className="flex justify-end pt-2">
            <SubmitButton>{labels.save}</SubmitButton>
          </div>
        </ActionForm>
      )}
    </DialogTrigger>
  );
}
