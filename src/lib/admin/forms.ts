import { z } from "zod";

/*
 * Shared plumbing for the staff dashboard's forms: the state a Server Action
 * returns to `useActionState`, and how zod issues become per-field error
 * codes. Codes (not sentences) cross the wire; the client resolves them from
 * the dictionary, so every message exists in Mongolian and English.
 */

export type FieldErrorCode =
  | "required"
  | "invalid"
  | "tooShort"
  | "tooLong"
  | "range"
  | "slug"
  | "taken"
  | "time"
  | "overlap"
  | "mismatch"
  | "url"
  | "email"
  | "phone";

/** Result keys shown above or beside a form. Every key has a dictionary entry. */
export type FormMessage =
  | "saved"
  | "created"
  | "deleted"
  | "invalid"
  | "forbidden"
  | "notFound"
  | "slotTaken"
  | "outsideHours"
  | "timeOff"
  | "inPast"
  | "barberUnavailable"
  | "invalidTransition"
  | "notActive"
  | "inUse"
  | "lastAdmin"
  | "selfChange"
  | "conflict"
  | "hoursOutside"
  | "timeOffAffected"
  | "generic";

export type FormState =
  | { status: "idle" }
  | {
      status: "success" | "error";
      message: FormMessage;
      /** Optional extra numbers for the message, e.g. affected appointments. */
      detail?: Record<string, number>;
      fields?: Record<string, FieldErrorCode>;
      /** Changes on every submit so identical consecutive results still announce. */
      at: number;
    };

export const idleState: FormState = { status: "idle" };

export function success(message: FormMessage = "saved", detail?: Record<string, number>): FormState {
  return { status: "success", message, detail, at: Date.now() };
}

export function failure(message: FormMessage, fields?: Record<string, FieldErrorCode>): FormState {
  return { status: "error", message, fields, at: Date.now() };
}

const knownCodes = new Set<string>([
  "required",
  "invalid",
  "tooShort",
  "tooLong",
  "range",
  "slug",
  "taken",
  "time",
  "overlap",
  "mismatch",
  "url",
  "email",
  "phone",
]);

/** zod issues → `{ "field.path": code }`, first issue per field wins. */
export function fieldErrors(error: z.ZodError): Record<string, FieldErrorCode> {
  const fields: Record<string, FieldErrorCode> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    if (fields[key]) continue;
    if (knownCodes.has(issue.message)) {
      fields[key] = issue.message as FieldErrorCode;
    } else if (issue.code === "too_small") {
      fields[key] = issue.origin === "string" && issue.minimum === 1 ? "required" : issue.origin === "string" ? "tooShort" : "range";
    } else if (issue.code === "too_big") {
      fields[key] = issue.origin === "string" ? "tooLong" : "range";
    } else {
      fields[key] = "invalid";
    }
  }
  return fields;
}

/** Validate with `schema`; on failure, the form state to return. */
export function parseForm<T extends z.ZodType>(
  schema: T,
  input: unknown,
): { ok: true; data: z.output<T> } | { ok: false; state: FormState } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  return { ok: false, state: failure("invalid", fieldErrors(parsed.error)) };
}

/* ------------------------------------------------------------------ FormData */

export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function texts(formData: FormData, name: string): string[] {
  return formData.getAll(name).filter((v): v is string => typeof v === "string");
}

export function checkbox(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === "on" || value === "true" || value === "1";
}

/** One entry per non-empty line, trimmed. */
export function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}
