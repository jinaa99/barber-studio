"use client";

import {
  createContext,
  startTransition,
  use,
  useActionState,
  useEffect,
  useId,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { idleState, type FieldErrorCode, type FormState } from "@/lib/admin/forms";
import { format } from "@/lib/format";
import { cn } from "@/lib/cn";
import { inputClass, primarySmallButton, smallButton, textareaClass } from "./ui";

/*
 * Forms for Server Actions. `ActionForm` submits through `useActionState`
 * without React's automatic form reset, so a validation error never wipes
 * what was typed. Fields read their error from context and wire up
 * `aria-invalid` / `aria-describedby`. Without JavaScript the form still posts
 * to the action natively.
 */

type Strings = Pick<Dictionary["admin"], "messages" | "fieldErrors" | "common">;

const StringsContext = createContext<Strings | null>(null);

/** Provided once by the dashboard layout. */
export function AdminStrings({ value, children }: { value: Strings; children: ReactNode }) {
  return <StringsContext value={value}>{children}</StringsContext>;
}

export function useAdminStrings(): Strings {
  const value = use(StringsContext);
  if (!value) throw new Error("AdminStrings provider missing");
  return value;
}

const FormContext = createContext<{ state: FormState; pending: boolean; formId: string }>({
  state: idleState,
  pending: false,
  formId: "",
});

export type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

export function ActionForm({
  action,
  children,
  className,
  /** Show the success message (off for forms that redirect or close). */
  showSuccess = true,
  onSuccess,
  "aria-label": ariaLabel,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  showSuccess?: boolean;
  onSuccess?: () => void;
  "aria-label"?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const formId = useId();
  const ref = useRef<HTMLFormElement>(null);
  const lastHandled = useRef(0);

  useEffect(() => {
    if (state.status === "idle" || state.at === lastHandled.current) return;
    lastHandled.current = state.at;
    if (state.status === "success") onSuccess?.();
    if (state.status === "error" && state.fields) {
      // Move focus to the first invalid field.
      const first = ref.current?.querySelector<HTMLElement>("[aria-invalid='true']");
      first?.focus();
    }
  }, [state, onSuccess]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(data));
  }

  return (
    <FormContext value={{ state, pending, formId }}>
      <form ref={ref} action={formAction} onSubmit={onSubmit} aria-label={ariaLabel} aria-busy={pending} noValidate className={className}>
        {children}
        <FormStatus show={showSuccess} />
      </form>
    </FormContext>
  );
}

function FormStatus({ show }: { show: boolean }) {
  const { state } = use(FormContext);
  const t = useAdminStrings();
  if (state.status === "idle" || (state.status === "success" && !show)) return <p role="status" className="sr-only" />;
  const message = format(t.messages[state.message], state.detail ?? {});
  return (
    <p
      key={state.at}
      role={state.status === "error" ? "alert" : "status"}
      className={cn(
        "mt-4 border-l-2 pl-3 text-sm leading-relaxed",
        state.status === "error" ? "border-danger text-danger" : "border-ink text-ink",
      )}
    >
      {message}
    </p>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  name,
  value,
  className,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  name?: string;
  value?: string;
  className?: string;
}) {
  const { pending } = use(FormContext);
  const t = useAdminStrings();
  const style =
    variant === "primary"
      ? primarySmallButton
      : variant === "danger"
        ? "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-danger px-4 text-sm font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
        : smallButton;
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={cn(style, className)}>
      {pending ? (pendingLabel ?? t.common.saving) : children}
    </button>
  );
}

/** Error code for `name` from the last submit, or null. */
export function useFieldErrorCode(name: string): FieldErrorCode | null {
  const { state } = use(FormContext);
  if (state.status !== "error" || !state.fields) return null;
  return state.fields[name] ?? null;
}

/** Error code for `name` from the last submit, resolved to text. */
function useFieldError(name: string): string | null {
  const { state } = use(FormContext);
  const t = useAdminStrings();
  if (state.status !== "error" || !state.fields) return null;
  // Errors on a list item ("includes.mn.2") belong to the list's field ("includes.mn").
  const key = Object.keys(state.fields).find((k) => k === name || (k.startsWith(`${name}.`) && /^\d+$/.test(k.slice(name.length + 1))));
  return key ? t.fieldErrors[state.fields[key]] : null;
}

interface FieldProps {
  label: ReactNode;
  name: string;
  /** Path in the server's field errors, when it differs from `name`. */
  errorKey?: string;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
}

function FieldShell({
  label,
  hint,
  optional,
  error,
  id,
  className,
  children,
}: Omit<FieldProps, "name" | "errorKey"> & { error: string | null; id: string; children: ReactNode }) {
  const t = useAdminStrings();
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
        {optional && <span className="ml-1.5 font-normal text-taupe-deep">({t.common.optional})</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs leading-relaxed text-taupe-deep">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, hint: unknown, error: string | null) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

export function TextField({
  label,
  name,
  errorKey,
  hint,
  optional,
  className,
  ...input
}: FieldProps & Omit<React.ComponentPropsWithoutRef<"input">, "name">) {
  const { formId } = use(FormContext);
  const id = `${formId}-${name}`;
  const error = useFieldError(errorKey ?? name);
  return (
    <FieldShell label={label} hint={hint} optional={optional} error={error} id={id} className={className}>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={inputClass}
        {...input}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  name,
  errorKey,
  hint,
  optional,
  className,
  ...input
}: FieldProps & Omit<React.ComponentPropsWithoutRef<"textarea">, "name">) {
  const { formId } = use(FormContext);
  const id = `${formId}-${name}`;
  const error = useFieldError(errorKey ?? name);
  return (
    <FieldShell label={label} hint={hint} optional={optional} error={error} id={id} className={className}>
      <textarea
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={textareaClass}
        {...input}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  name,
  errorKey,
  hint,
  optional,
  className,
  options,
  ...select
}: FieldProps & Omit<React.ComponentPropsWithoutRef<"select">, "name"> & { options: { value: string; label: string; disabled?: boolean }[] }) {
  const { formId } = use(FormContext);
  const id = `${formId}-${name}`;
  const error = useFieldError(errorKey ?? name);
  return (
    <FieldShell label={label} hint={hint} optional={optional} error={error} id={id} className={className}>
      <select
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={inputClass}
        {...select}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  label,
  name,
  hint,
  defaultChecked,
  value,
  className,
}: {
  label: ReactNode;
  name: string;
  hint?: ReactNode;
  defaultChecked?: boolean;
  value?: string;
  className?: string;
}) {
  const { formId } = use(FormContext);
  const id = `${formId}-${name}-${value ?? "on"}`;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="mt-0.5 size-4.5 shrink-0 accent-ink"
      />
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="mt-0.5 text-xs leading-relaxed text-taupe-deep">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

/** Mongolian and English side by side (stacked on small screens). */
export function LocalizedFields({
  label,
  name,
  defaultValue,
  multiline,
  hint,
  rows,
  maxLength,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: { mn: string; en: string };
  multiline?: boolean;
  hint?: ReactNode;
  rows?: number;
  maxLength?: number;
  required?: boolean;
}) {
  const t = useAdminStrings();
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["mn", "en"] as const).map((lang) =>
          multiline ? (
            <TextAreaField
              key={lang}
              label={<span className="font-normal text-taupe-deep">{t.common[lang]}</span>}
              name={`${name}.${lang}`}
              defaultValue={defaultValue?.[lang]}
              rows={rows ?? 4}
              maxLength={maxLength}
              required={required}
              lang={lang}
            />
          ) : (
            <TextField
              key={lang}
              label={<span className="font-normal text-taupe-deep">{t.common[lang]}</span>}
              name={`${name}.${lang}`}
              defaultValue={defaultValue?.[lang]}
              maxLength={maxLength}
              required={required}
              lang={lang}
            />
          ),
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-taupe-deep">{hint}</p>}
    </fieldset>
  );
}

/** Error text for a whole group (e.g. a checkbox list) keyed by `name`. */
export function GroupError({ name }: { name: string }) {
  const error = useFieldError(name);
  return error ? <p className="mt-1.5 text-xs font-medium text-danger">{error}</p> : null;
}
