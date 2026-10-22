"use client";

import { useActionState, useId } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { loginAction, type LoginState } from "@/app/[locale]/admin/actions";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { field } from "./ui";

// One step taller than dashboard fields: this is the only form on the page.
const inputClass = `${field} h-11 px-3.5 text-base`;

export function LoginForm({ locale, dict }: { locale: Locale; dict: Dictionary["admin"]["login"] }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { error: null });
  const id = useId();

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label htmlFor={`${id}-email`} className="mb-1.5 block text-sm font-medium">
          {dict.email}
        </label>
        <input id={`${id}-email`} name="email" type="email" autoComplete="username" required className={inputClass} />
      </div>
      <div>
        <label htmlFor={`${id}-password`} className="mb-1.5 block text-sm font-medium">
          {dict.password}
        </label>
        <input
          id={`${id}-password`}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>
      {state.error && (
        <p role="alert" className="flex animate-shake items-start gap-2 rounded-lg bg-danger-wash px-3 py-2.5 text-sm text-danger motion-reduce:animate-none">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          {dict[state.error]}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? dict.submitting : dict.submit}
      </Button>
    </form>
  );
}
