import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { rangePresets, type RangePreset } from "@/lib/admin/metrics";
import { cn } from "@/lib/cn";
import { inputClass, smallButton } from "./ui";

/*
 * URL-driven filters (plain links and GET forms), so every filtered view can
 * be bookmarked, works without JavaScript and survives a reload.
 */

export type Query = Record<string, string | undefined>;

/** `base` with `params` merged over `current`; empty values are dropped. */
export function hrefWith(base: string, current: Query, params: Query): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...params })) {
    if (value !== undefined && value !== "") query.set(key, value);
  }
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Search params as plain strings (first value of repeated keys). */
export function queryOf(params: Record<string, string | string[] | undefined>): Query {
  return Object.fromEntries(
    Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
}

export function RangeFilter({
  dict,
  base,
  query,
  preset,
  from,
  to,
}: {
  dict: Dictionary;
  base: string;
  query: Query;
  preset: RangePreset;
  from: string;
  to: string;
}) {
  const t = dict.admin.range;
  // Keep other filters (e.g. the demo toggle) when switching ranges.
  const keep = Object.fromEntries(Object.entries(query).filter(([k]) => !["range", "from", "to", "page"].includes(k)));
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <nav aria-label={t.label} className="-mx-1 flex flex-wrap gap-1">
        {rangePresets.map((p) => (
          <Link
            key={p}
            href={hrefWith(base, keep, { range: p === "30d" ? undefined : p })}
            aria-current={preset === p ? "true" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm transition-colors",
              preset === p ? "bg-ink text-paper" : "text-taupe-deep hover:bg-paper-deep hover:text-ink",
            )}
          >
            {t[p]}
          </Link>
        ))}
      </nav>
      <form method="get" action={base} className="flex flex-wrap items-end gap-2">
        {Object.entries(keep).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
        <input type="hidden" name="range" value="custom" />
        <label className="text-xs text-taupe-deep">
          <span className="mb-1 block">{t.from}</span>
          <input type="date" name="from" defaultValue={from} required className={cn(inputClass, "h-9 w-[9.5rem]")} />
        </label>
        <label className="text-xs text-taupe-deep">
          <span className="mb-1 block">{t.to}</span>
          <input type="date" name="to" defaultValue={to} required className={cn(inputClass, "h-9 w-[9.5rem]")} />
        </label>
        <button type="submit" className={cn(smallButton, preset === "custom" && "border-ink")}>
          {t.apply}
        </button>
      </form>
    </div>
  );
}

export function DemoToggle({ dict, base, query, includeDemo }: { dict: Dictionary; base: string; query: Query; includeDemo: boolean }) {
  const t = dict.admin.common;
  return (
    <Link
      href={hrefWith(base, query, { demo: includeDemo ? undefined : "1", page: undefined })}
      className="text-sm text-taupe-deep underline underline-offset-4 hover:text-ink"
    >
      {includeDemo ? t.hideDemo : t.includeDemo}
    </Link>
  );
}
