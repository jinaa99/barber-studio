"use client";

import { useActionState, useId } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { loginAction, type LoginState } from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-12 w-full border border-line-strong bg-paper px-4 text-base text-ink transition-colors duration-300 hover:border-ink/50 focus:border-ink focus:outline-none";

export function LoginForm({ locale, dict }: { locale: Locale; dict: Dictionary["admin"]["login"] }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { error: null });
  const id = useId();

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      <div>
        <label htmlFor={`${id}-email`} className="mb-2 block text-sm font-medium">
          {dict.email}
        </label>
        <input id={`${id}-email`} name="email" type="email" autoComplete="username" required className={inputClass} />
      </div>
      <div>
        <label htmlFor={`${id}-password`} className="mb-2 block text-sm font-medium">
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
        <p role="alert" className="border-l-2 border-danger pl-4 text-sm text-danger">
          {dict[state.error]}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? dict.submitting : dict.submit}
      </Button>
    </form>
  );
}
