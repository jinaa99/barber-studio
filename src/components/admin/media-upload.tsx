"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, Upload } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { FieldErrorCode } from "@/lib/admin/forms";
import { IMAGE_MAX_BYTES, VIDEO_MAX_BYTES } from "@/lib/media/files";
import { useAdminStrings } from "./form";
import { fileInputClass, inputClass, primarySmallButton, textareaClass } from "./ui";

type Strings = Dictionary["admin"]["media"]["upload"];

const accept = "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm";

/*
 * Upload to the media library (`POST /api/admin/media/upload`). The browser
 * checks size and type first for a quick answer; the server decides. Sent
 * with XMLHttpRequest for upload progress on large videos. A saved upload
 * opens in the library as a draft.
 */
export function MediaUpload({ endpoint, libraryHref, t }: { endpoint: string; libraryHref: string; t: Strings }) {
  const strings = useAdminStrings();
  const router = useRouter();
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [rights, setRights] = useState<"own" | "licensed">("own");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, FieldErrorCode>>({});

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get("file");
    setError(null);
    setFields({});
    if (!(file instanceof File) || file.size === 0) {
      setFields({ file: "required" });
      return;
    }
    const isVideo = file.type.startsWith("video/");
    // Some browsers report no type for newer formats; the server checks the bytes either way.
    if (file.type && !accept.split(",").includes(file.type)) {
      setError(t.errors.invalid_file);
      return;
    }
    if (file.size > (isVideo ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES)) {
      setError(t.errors.too_large);
      return;
    }

    const request = new XMLHttpRequest();
    request.open("POST", endpoint);
    request.responseType = "json";
    request.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    request.onerror = () => {
      setProgress(null);
      setError(t.errors.network);
    };
    request.onload = () => {
      setProgress(null);
      const body = request.response as { ok: boolean; id?: string; error?: keyof Strings["errors"]; fields?: Record<string, FieldErrorCode> } | null;
      if (body?.ok && body.id) {
        router.push(`${libraryHref}?asset=${body.id}`);
        return;
      }
      if (body?.fields) setFields(body.fields);
      setError(t.errors[body?.error ?? "generic"] ?? t.errors.generic);
      formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
    };
    setProgress(0);
    request.send(data);
  }

  const fieldError = (name: string) => (fields[name] ? strings.fieldErrors[fields[name]] : null);
  const input = (name: string, label: string, props: React.ComponentPropsWithoutRef<"input"> = {}, hint?: string) => {
    const id = `${formId}-${name}`;
    const message = fieldError(name);
    return (
      <div className="min-w-0">
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
          {label}
        </label>
        <input
          id={id}
          name={name.replace(/^credit\./, "")}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={inputClass}
          {...props}
        />
        {hint && !message && (
          <p id={`${id}-hint`} className="mt-1.5 text-xs leading-relaxed text-muted">
            {hint}
          </p>
        )}
        {message && (
          <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-danger">
            {message}
          </p>
        )}
      </div>
    );
  };

  const uploading = progress !== null;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate aria-busy={uploading} className="max-w-3xl space-y-7">
      {input("file", t.file, { type: "file", accept, required: true, className: fileInputClass }, t.fileHint)}

      <fieldset>
        <legend className="text-sm font-semibold">{t.rights}</legend>
        <div className="mt-2 space-y-2">
          {(["own", "licensed"] as const).map((value) => (
            <label key={value} className="flex items-start gap-3">
              <input type="radio" name="rights" value={value} checked={rights === value} onChange={() => setRights(value)} className="mt-0.5 size-4.5 shrink-0 accent-ink" />
              <span className="text-sm">
                <span className="font-medium">{t.rightsOptions[value]}</span>
                <span className="block text-xs text-muted">{t.rightsHints[value]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        {rights === "licensed" && input("credit.licenseName", t.licenseName, { maxLength: 120, required: true }, t.licenseNameHint)}
        {rights === "licensed" && input("credit.licenseUrl", t.licenseUrl, { type: "url", maxLength: 500, placeholder: "https://" })}
        {input("credit.creatorName", t.creatorName, { maxLength: 120 })}
        {input("credit.sourceUrl", t.sourceUrl, { type: "url", maxLength: 500, placeholder: "https://" })}
      </div>

      <fieldset className="min-w-0">
        <legend className="mb-2 text-sm font-semibold">{t.alt}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {input("alt.mn", strings.common.mn, { maxLength: 300, lang: "mn" })}
          {input("alt.en", strings.common.en, { maxLength: 300, lang: "en" })}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">{t.altHint}</p>
      </fieldset>

      <div>
        <label htmlFor={`${formId}-notes`} className="mb-1.5 block text-sm font-medium">
          {t.notes} <span className="font-normal text-muted">({strings.common.optional})</span>
        </label>
        <textarea id={`${formId}-notes`} name="notes" rows={2} maxLength={1000} className={textareaClass} />
      </div>

      <div>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="confirmRights" aria-invalid={fields.confirmRights ? true : undefined} className="mt-0.5 size-4.5 shrink-0 accent-ink" />
          <span className="text-sm font-medium">{t.confirmRights}</span>
        </label>
        {fieldError("confirmRights") && <p className="mt-1.5 text-xs font-medium text-danger">{fieldError("confirmRights")}</p>}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-wash px-3 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={uploading} className={primarySmallButton}>
          {uploading ? <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" strokeWidth={1.75} /> : <Upload aria-hidden className="size-4" strokeWidth={1.75} />}
          {uploading ? t.uploading : t.submit}
        </button>
        {uploading && (
          <div role="status" className="flex min-w-40 flex-1 items-center gap-3 text-xs text-muted">
            <span className="h-1 flex-1 overflow-hidden bg-stone">
              <span className="block h-full bg-ink transition-[width]" style={{ width: `${progress}%` }} />
            </span>
            <span className="tabular">{progress}%</span>
          </div>
        )}
      </div>
    </form>
  );
}
