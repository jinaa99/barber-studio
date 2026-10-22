import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { rangePresets, type RangePreset } from "@/lib/admin/metrics";
import { cn } from "@/lib/cn";
import { compactInputClass, primarySmallButton, segment, segmentGroup, smallButton } from "./ui";

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
      <nav aria-label={t.label} className={segmentGroup}>
        {rangePresets.map((p) => (
          <Link
            key={p}
            href={hrefWith(base, keep, { range: p === "30d" ? undefined : p })}
            aria-current={preset === p ? "true" : undefined}
            className={segment(preset === p)}
          >
            {t[p]}
          </Link>
        ))}
      </nav>
      <form method="get" action={base} className="flex flex-wrap items-end gap-2">
        {Object.entries(keep).map(([k, v]) => v && <input key={k} type="hidden" name={k} value={v} />)}
        <input type="hidden" name="range" value="custom" />
        <label className="text-xs text-muted">
          <span className="mb-1 block">{t.from}</span>
          <input type="date" name="from" defaultValue={from} required className={cn(compactInputClass, "w-[9.5rem]")} />
        </label>
        <label className="text-xs text-muted">
          <span className="mb-1 block">{t.to}</span>
          <input type="date" name="to" defaultValue={to} required className={cn(compactInputClass, "w-[9.5rem]")} />
        </label>
        <button type="submit" className={preset === "custom" ? primarySmallButton : smallButton}>
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
      className="inline-flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm text-muted transition-colors hover:bg-stone hover:text-ink"
    >
      <DemoSwitch on={includeDemo} />
      {includeDemo ? t.hideDemo : t.includeDemo}
    </Link>
  );
}

/** A small switch drawn next to the demo-data link; the link text states the action. */
export function DemoSwitch({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={cn("relative h-4 w-7 shrink-0 rounded-full transition-colors duration-200", on ? "bg-accent" : "bg-line-strong")}>
      <span
        className={cn(
          "absolute left-0.5 top-0.5 size-3 rounded-full bg-surface shadow-sm transition-transform duration-200 ease-emphasis",
          on && "translate-x-3",
        )}
      />
    </span>
  );
}
