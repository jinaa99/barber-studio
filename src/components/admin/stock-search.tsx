"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Check, ExternalLink, Film, LoaderCircle, Search, X } from "lucide-react";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { saveStockAction, searchStockAction, type StockSaveResponse, type StockSearchResponse } from "@/app/[locale]/admin/actions/media";
import { formatClipLength } from "@/lib/admin/media";
import { providerLicense, stockOrientations, stockProviders, type StockItem, type StockKind, type StockOrientation, type StockProvider } from "@/lib/media/stock";
import { format } from "@/lib/format";
import { cn } from "@/lib/cn";
import { EmptyState, inputClass, Notice, primarySmallButton, smallButton, textLink } from "./ui";

type Strings = Dictionary["admin"]["media"]["search"];
type Search = { query: string; provider: StockProvider; kind: StockKind; orientation: StockOrientation };

/*
 * Stock search in the dashboard. Results come from a Server Action, which
 * holds the API keys; previews load from the providers' own media hosts while
 * searching (allowed by both for showing results). Saving sends only provider,
 * type and id, and the server fetches everything else from the provider.
 */
export function StockSearch({
  configured,
  libraryHref,
  t,
}: {
  configured: Record<StockProvider, boolean>;
  /** Library URL; `?asset=<id>` is appended to open a saved item. */
  libraryHref: string;
  t: Strings;
}) {
  const available = stockProviders.filter((p) => configured[p]);
  const [search, setSearch] = useState<Search>({ query: "", provider: available[0] ?? "pexels", kind: "photo", orientation: "any" });
  const [result, setResult] = useState<{ search: Search; response: StockSearchResponse; items: StockItem[]; page: number } | null>(null);
  const [selected, setSelected] = useState<StockItem | null>(null);
  const [pending, startTransition] = useTransition();
  const statusId = useId();

  if (available.length === 0) {
    return <Notice>{t.notConfigured}</Notice>;
  }

  function run(next: Search, page: number) {
    startTransition(async () => {
      const response = await searchStockAction({ ...next, page });
      setResult((previous) => ({
        search: next,
        response,
        page,
        items: response.ok ? (page > 1 && previous ? [...previous.items, ...response.items] : response.items) : (previous?.items ?? []),
      }));
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!search.query.trim()) return;
    setResult(null);
    run({ ...search, query: search.query.trim() }, 1);
  }

  const provider = result?.search.provider ?? search.provider;
  const response = result?.response;

  return (
    <div>
      <form role="search" onSubmit={onSubmit} className="grid gap-4 border border-line p-4 sm:p-5 lg:grid-cols-[minmax(0,2fr)_auto_auto_auto_auto] lg:items-end">
        <label className="block min-w-0">
          <span className="mb-1.5 block text-sm font-medium">{t.query}</span>
          <input
            type="search"
            required
            maxLength={100}
            value={search.query}
            onChange={(e) => setSearch({ ...search, query: e.target.value })}
            placeholder={t.queryPlaceholder}
            aria-describedby={`${statusId}-hint`}
            className={inputClass}
          />
          <span id={`${statusId}-hint`} className="mt-1.5 block text-xs text-muted">
            {t.queryHint}
          </span>
        </label>
        <Segmented
          legend={t.provider}
          name="provider"
          value={search.provider}
          options={stockProviders.map((p) => ({ value: p, label: providerLicense[p].label, disabled: !configured[p] }))}
          onChange={(provider) => setSearch({ ...search, provider })}
        />
        <Segmented
          legend={t.kind}
          name="kind"
          value={search.kind}
          options={[
            { value: "photo", label: t.photos },
            { value: "video", label: t.videos },
          ]}
          onChange={(kind) => setSearch({ ...search, kind })}
        />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{t.orientation}</span>
          <select
            value={search.orientation}
            onChange={(e) => setSearch({ ...search, orientation: e.target.value as StockOrientation })}
            className={cn(inputClass, "lg:w-36")}
          >
            {stockOrientations.map((o) => (
              <option key={o} value={o}>
                {t.orientations[o]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={pending} className={cn(primarySmallButton, "h-11 px-5")}>
          {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" strokeWidth={1.75} /> : <Search aria-hidden className="size-4" strokeWidth={1.75} />}
          {pending ? t.searching : t.submit}
        </button>
        {stockProviders.some((p) => !configured[p]) && (
          <p className="text-xs text-muted lg:col-span-5">
            {stockProviders
              .filter((p) => !configured[p])
              .map((p) => format(t.providerMissing, { provider: providerLicense[p].label }))
              .join(" · ")}
          </p>
        )}
      </form>

      <div className="mt-6" aria-busy={pending}>
        <p id={statusId} role="status" className="sr-only">
          {pending ? t.searching : response?.ok ? format(t.resultsCount, { count: response.total }) : ""}
        </p>

        {result && (
          <p className="mb-4 flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted">
            <a href={providerLicense[provider].homepage} target="_blank" rel="noopener noreferrer" className={cn(textLink, "font-medium text-ink")}>
              {format(t.attribution, { provider: providerLicense[provider].label })}
            </a>
            {response?.ok && <span className="tabular">{format(t.resultsCount, { count: response.total })}</span>}
          </p>
        )}

        {response && !response.ok && (
          <Notice tone="error" className="mb-4">
            {format(t.errors[response.error], { seconds: response.retryAfterSeconds ?? 60 })}
          </Notice>
        )}

        {pending && !result?.items.length ? (
          <ResultsSkeleton />
        ) : result && response?.ok && result.items.length === 0 ? (
          <EmptyState>{format(t.empty, { query: result.search.query })}</EmptyState>
        ) : result && result.items.length > 0 ? (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {result.items.map((item) => (
                <li key={`${item.provider}-${item.kind}-${item.id}`}>
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    aria-haspopup="dialog"
                    className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span className="relative block aspect-[4/3] overflow-hidden bg-stone">
                      <Image
                        src={item.thumbnailUrl}
                        alt={item.description ?? ""}
                        fill
                        unoptimized
                        sizes="(min-width: 1024px) 25vw, 50vw"
                        className="object-cover transition-transform duration-500 ease-standard group-hover:scale-[1.03] motion-reduce:transition-none"
                      />
                      {item.kind === "video" && (
                        <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-ink/80 px-2 py-0.5 text-[0.6875rem] font-semibold text-canvas tabular">
                          <Film aria-hidden className="size-3" strokeWidth={1.75} />
                          {formatClipLength(item.durationSeconds)}
                        </span>
                      )}
                    </span>
                    <span className="mt-1.5 block truncate text-xs text-muted">
                      {item.creatorName ?? t.unknownCreator} · {item.width}×{item.height}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {response?.ok && response.hasMore && (
              <div className="mt-6 flex justify-center">
                <button type="button" disabled={pending} onClick={() => run(result.search, result.page + 1)} className={smallButton}>
                  {pending ? t.searching : t.loadMore}
                </button>
              </div>
            )}
          </>
        ) : null}
      </div>

      {selected && <StockDetail key={`${selected.provider}-${selected.id}`} item={selected} libraryHref={libraryHref} t={t} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Segmented<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="flex h-11 border border-line-strong p-0.5">
        {options.map((o) => (
          <label key={o.value} className={cn("relative flex", o.disabled && "opacity-40")}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span className="flex cursor-pointer items-center px-3 text-sm text-muted peer-checked:bg-ink peer-checked:text-canvas peer-focus-visible:outline-2 peer-focus-visible:outline-accent peer-disabled:cursor-not-allowed">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ResultsSkeleton() {
  return (
    <ul aria-hidden className="grid animate-pulse grid-cols-2 gap-3 motion-reduce:animate-none sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i}>
          <span className="block aspect-[4/3] bg-stone" />
          <span className="mt-1.5 block h-3 w-2/3 bg-stone" />
        </li>
      ))}
    </ul>
  );
}

/** Larger preview, credits and licence, and the save confirmation. */
function StockDetail({ item, libraryHref, t, onClose }: { item: StockItem; libraryHref: string; t: Strings; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [checked, setChecked] = useState(false);
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState<StockSaveResponse | null>(null);
  const license = providerLicense[item.provider];

  useEffect(() => {
    ref.current?.showModal();
  }, []);
  // Never come back open from a hidden <Activity>.
  useLayoutEffect(() => () => ref.current?.close(), []);

  function save() {
    startSaving(async () => {
      setSaved(await saveStockAction({ provider: item.provider, kind: item.kind, id: item.id }));
    });
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[min(100dvh-2rem,60rem)] w-[min(100%-2rem,56rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-[0_32px_80px_-24px_rgb(18_18_17/0.45)]"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface/95 px-5 py-4 backdrop-blur-sm sm:px-6">
        <h2 id={titleId} className="min-w-0 text-lg font-semibold tracking-tight">
          {item.kind === "video" ? t.videoTitle : t.photoTitle} · {license.label} #{item.id}
        </h2>
        <button type="button" onClick={() => ref.current?.close()} aria-label={t.close} className="-mr-2 inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-stone">
          <X aria-hidden className="size-4.5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="grid gap-6 px-5 py-5 sm:px-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <div className="relative aspect-[4/3] overflow-hidden bg-ink">
            {item.kind === "video" && item.previewVideoUrl ? (
              <video src={item.previewVideoUrl} poster={item.previewUrl} controls muted playsInline preload="none" className="size-full object-contain" />
            ) : (
              <Image src={item.previewUrl} alt={item.description ?? ""} fill unoptimized sizes="(min-width: 768px) 520px, 100vw" className="object-contain" />
            )}
          </div>
          <p className="mt-2 text-xs text-muted">{t.previewNote}</p>
        </div>

        <div className="min-w-0 text-sm">
          <dl className="space-y-3">
            <Row label={t.creator}>
              {item.creatorName ? (
                item.creatorUrl ? (
                  <a href={item.creatorUrl} target="_blank" rel="noopener noreferrer" className={textLink}>
                    {item.creatorName}
                  </a>
                ) : (
                  item.creatorName
                )
              ) : (
                <span className="text-muted">{t.unknownCreator}</span>
              )}
            </Row>
            <Row label={t.source}>
              <a href={item.pageUrl} target="_blank" rel="noopener noreferrer" className={cn(textLink, "inline-flex items-center gap-1")}>
                {format(t.viewOnProvider, { provider: license.label })}
                <ExternalLink aria-hidden className="size-3" strokeWidth={1.75} />
              </a>
            </Row>
            <Row label={t.license}>
              <a href={license.url} target="_blank" rel="noopener noreferrer" className={textLink}>
                {license.name}
              </a>
            </Row>
            <Row label={t.dimensions}>
              <span className="tabular">
                {item.width} × {item.height}
                {item.kind === "video" && ` · ${formatClipLength(item.durationSeconds)}`}
              </span>
            </Row>
            {item.description && <Row label={t.description}>{item.description}</Row>}
          </dl>
          {item.provider === "pixabay" && item.kind === "photo" && <p className="mt-4 text-xs leading-relaxed text-muted">{t.pixabayNote}</p>}

          {saved?.ok ? (
            <div role="status" className="mt-6 rounded-lg bg-success-wash px-3 py-2.5 text-success">
              <p className="flex items-center gap-2 font-medium">
                <Check aria-hidden className="size-4" strokeWidth={1.75} />
                {saved.existing ? t.alreadySaved : t.saved}
              </p>
              <Link href={`${libraryHref}?asset=${saved.id}`} className={cn(smallButton, "mt-3")}>
                {t.openSaved}
              </Link>
            </div>
          ) : (
            <div className="mt-6 border-t border-line pt-5">
              <p className="font-semibold">{t.checklistTitle}</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
                {t.checklist.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <label className="mt-4 flex items-start gap-3">
                <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 size-4.5 shrink-0 accent-ink" />
                <span className="text-sm font-medium">{t.confirm}</span>
              </label>
              {saved && !saved.ok && (
                <p role="alert" className="mt-4 rounded-lg bg-danger-wash px-3 py-2.5 text-sm text-danger">
                  {format(t.errors[saved.error], { seconds: saved.retryAfterSeconds ?? 60 })}
                </p>
              )}
              <button type="button" onClick={save} disabled={!checked || saving} className={cn(primarySmallButton, "mt-4")}>
                {saving && <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" strokeWidth={1.75} />}
                {saving ? t.saving : t.save}
              </button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
