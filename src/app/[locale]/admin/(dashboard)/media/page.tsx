import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Film } from "lucide-react";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { localizedPath, type Locale, type LocalizedText } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { routes } from "@/lib/navigation";
import { format } from "@/lib/format";
import { cn } from "@/lib/cn";
import { formatClipLength } from "@/lib/admin/media";
import { assetRef, mediaFileUrl } from "@/lib/media/refs";
import { db } from "@/lib/server/db";
import { adminContext } from "@/lib/server/admin-context";
import { storageWritable } from "@/lib/server/media-storage";
import { configuredProviders } from "@/lib/server/stock-media";
import {
  getMediaAsset,
  listMediaAssets,
  mediaKinds,
  mediaSources,
  mediaStatuses,
  mediaUsages,
  type MediaFilters,
} from "@/lib/server/media-library";
import { hrefWith, queryOf } from "@/components/admin/filters";
import { RouteDialog } from "@/components/admin/dialog";
import { MediaDetail, replacementChoices } from "@/components/admin/media-detail";
import { mediaChoices, MediaThumb } from "@/components/admin/media-picker";
import { MediaUpload } from "@/components/admin/media-upload";
import { StockSearch } from "@/components/admin/stock-search";
import {
  compactInputClass,
  EmptyState,
  Forbidden,
  Notice,
  PageHeader,
  PageSkeleton,
  Pagination,
  smallButton,
  Tag,
} from "@/components/admin/ui";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.admin.nav.media} · ${dict.meta.admin}`, robots: { index: false, follow: false } };
}

type Props = PageProps<"/[locale]/admin/media">;
const views = ["library", "search", "upload"] as const;
type View = (typeof views)[number];

export default async function MediaPage({ searchParams }: Props) {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return (
    <Suspense fallback={<PageSkeleton label={dict.admin.common.loading} />}>
      <Media locale={locale} dict={dict} searchParams={searchParams} />
    </Suspense>
  );
}

async function Media({ locale, dict, searchParams }: { locale: Locale; dict: Dictionary; searchParams: Props["searchParams"] }) {
  const ctx = await adminContext(locale);
  if (!ctx.can("media.manage")) return <Forbidden dict={dict} />;
  const t = dict.admin.media;
  const query = queryOf(await searchParams);
  const base = localizedPath(locale, routes.adminMedia);
  const view: View = views.includes(query.view as View) ? (query.view as View) : "library";
  const writable = await storageWritable();

  return (
    <>
      <PageHeader title={t.title} lead={t.lead} />

      <nav aria-label={t.viewsLabel} className="mt-6 flex flex-wrap gap-1 border-b border-line">
        {views.map((v) => (
          <Link
            key={v}
            href={hrefWith(base, {}, { view: v === "library" ? undefined : v })}
            aria-current={view === v ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-3 py-2.5 text-sm font-medium", view === v ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}
          >
            {t.views[v]}
          </Link>
        ))}
      </nav>

      {!writable && view !== "library" && (
        <Notice tone="error" className="mt-6">
          {t.storageUnavailable}
        </Notice>
      )}

      <div className="mt-8">
        {view === "search" && <StockSearch configured={configuredProviders()} libraryHref={base} t={t.search} />}
        {view === "upload" && <MediaUpload endpoint="/api/admin/media/upload" libraryHref={base} t={t.upload} />}
        {view === "library" && <Library locale={locale} dict={dict} base={base} query={query} />}
      </div>

      {query.asset && <AssetDialog locale={locale} dict={dict} id={query.asset} closeHref={hrefWith(base, { ...query, asset: undefined }, {})} timeZone={ctx.timeZone} />}
    </>
  );
}

async function Library({ locale, dict, base, query }: { locale: Locale; dict: Dictionary; base: string; query: Record<string, string | undefined> }) {
  const t = dict.admin.media;
  const pick = <T extends string>(value: string | undefined, allowed: readonly T[]) => (allowed.includes(value as T) ? (value as T) : undefined);
  const filters: MediaFilters = {
    q: query.q?.slice(0, 80),
    kind: pick(query.kind, mediaKinds),
    status: pick(query.status, mediaStatuses),
    source: pick(query.source, mediaSources),
    page: Math.max(1, Number(query.page) || 1),
  };
  const result = await listMediaAssets(db, filters);
  const keep = { q: filters.q, kind: filters.kind, status: filters.status, source: filters.source };
  const filtered = Object.values(keep).some(Boolean);
  const select = (name: string, label: string, value: string | undefined, options: { value: string; label: string }[]) => (
    <label className="text-xs text-muted">
      <span className="mb-1 block">{label}</span>
      <select name={name} defaultValue={value ?? ""} className={cn(compactInputClass, "w-36")}>
        <option value="">{t.filters.any}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <form method="get" action={base} role="search" className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted">
          <span className="mb-1 block">{t.filters.searchLabel}</span>
          <input type="search" name="q" defaultValue={filters.q} placeholder={t.filters.searchPlaceholder} maxLength={80} className={cn(compactInputClass, "w-64 max-w-full")} />
        </label>
        {select("kind", t.filters.kind, filters.kind, mediaKinds.map((k) => ({ value: k, label: t.kinds[k] })))}
        {select("status", t.filters.status, filters.status, mediaStatuses.map((s) => ({ value: s, label: t.statuses[s] })))}
        {select("source", t.filters.source, filters.source, mediaSources.map((s) => ({ value: s, label: t.sources[s] })))}
        <button type="submit" className={smallButton}>
          {dict.admin.common.apply}
        </button>
        {filtered && (
          <Link href={base} className="px-2 py-2 text-sm text-muted underline underline-offset-4 hover:text-ink">
            {dict.admin.common.clear}
          </Link>
        )}
      </form>

      <div className="mt-6">
        {result.rows.length === 0 ? (
          <EmptyState>
            {filtered ? (
              t.emptyFiltered
            ) : (
              <>
                <p>{t.empty}</p>
                <p className="mt-4 flex flex-wrap justify-center gap-2">
                  <Link href={hrefWith(base, {}, { view: "search" })} className={smallButton}>
                    {t.views.search}
                  </Link>
                  <Link href={hrefWith(base, {}, { view: "upload" })} className={smallButton}>
                    {t.views.upload}
                  </Link>
                </p>
              </>
            )}
          </EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {result.rows.map((a) => {
              const alt = a.alt as Partial<LocalizedText> | null;
              const file = a.kind === "IMAGE" ? a.fileName : a.posterFileName;
              return (
                <li key={a.id}>
                  <Link href={hrefWith(base, { ...keep, page: query.page }, { asset: a.id })} scroll={false} className="group block">
                    <span className="relative block aspect-[4/3] overflow-hidden bg-stone">
                      <MediaThumb src={file ? mediaFileUrl(file) : null} alt={alt?.[locale] ?? ""} sizes="(min-width: 1024px) 25vw, 50vw" />
                      {a.kind === "VIDEO" && (
                        <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-ink/80 px-2 py-0.5 text-[0.6875rem] font-semibold text-canvas tabular">
                          <Film aria-hidden className="size-3" strokeWidth={1.75} />
                          {formatClipLength(a.durationSeconds) || t.kinds.VIDEO}
                        </span>
                      )}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Tag tone={a.status === "PUBLISHED" ? "solid" : "default"}>{t.statuses[a.status]}</Tag>
                      <span className="text-xs text-muted">{t.sources[a.source]}</span>
                    </span>
                    <span className="mt-1 block truncate text-sm font-medium group-hover:underline">
                      {alt?.[locale] || a.providerDescription || a.creatorName || t.untitled}
                    </span>
                    <span className="block text-xs text-muted">{a.uses > 0 ? format(t.uses, { count: a.uses }) : t.unused}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination
          dict={dict}
          page={result.page}
          pageSize={result.pageSize}
          total={result.total}
          href={(page) => hrefWith(base, keep, { page: page > 1 ? String(page) : undefined })}
        />
      </div>
    </>
  );
}

async function AssetDialog({
  locale,
  dict,
  id,
  closeHref,
  timeZone,
}: {
  locale: Locale;
  dict: Dictionary;
  id: string;
  closeHref: string;
  timeZone: string;
}) {
  const t = dict.admin.media;
  const asset = /^[a-z0-9]{8,40}$/.test(id) ? await getMediaAsset(db, id) : null;
  if (!asset) {
    return (
      <RouteDialog title={dict.admin.common.notFoundTitle} closeHref={closeHref} closeLabel={dict.admin.common.close}>
        <p className="text-sm text-muted">{dict.admin.common.notFoundBody}</p>
      </RouteDialog>
    );
  }
  const [usages, choices, barbers] = await Promise.all([
    mediaUsages(db, assetRef(asset.id)),
    mediaChoices(locale, asset.kind),
    db.barber.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, name: true } }),
  ]);
  const alt = asset.alt as Partial<LocalizedText> | null;
  return (
    <RouteDialog title={alt?.[locale] || asset.providerDescription || t.untitled} closeHref={closeHref} closeLabel={dict.admin.common.close} wide>
      <MediaDetail
        locale={locale}
        dict={dict}
        asset={asset}
        usages={usages}
        replacements={replacementChoices(asset, choices)}
        barbers={barbers}
        timeZone={timeZone}
      />
    </RouteDialog>
  );
}
