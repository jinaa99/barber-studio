import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Server-rendered charts built from plain HTML, so they need no script and
 * scale with their container. One series per chart, one ink colour, hairline
 * gridlines; each chart has a text summary for screen readers and a table view
 * with every value.
 */

/** A round axis maximum: 1, 2, 2.5 or 5 × 10ⁿ at or above `value`. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * magnitude >= value) return step * magnitude;
  }
  return 10 * magnitude;
}

/** 1 234 → "1.2K", 2 500 000 → "2.5M" (axis ticks only). */
export function compact(value: number): string {
  const abs = Math.abs(value);
  const fmt = (n: number, unit: string) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(/\.0$/, "")}${unit}`;
  if (abs >= 1_000_000) return fmt(value / 1_000_000, "M");
  if (abs >= 1_000) return fmt(value / 1_000, "K");
  return String(value);
}

export interface ColumnDatum {
  key: string;
  /** Short axis label (e.g. "21 Oct"). */
  label: string;
  value: number;
  /** Formatted value for the tooltip and table. */
  display: string;
}

export function ColumnChart({
  title,
  summary,
  data,
  tableLabel,
  periodLabel,
  valueLabel,
  className,
}: {
  title: string;
  summary: string;
  data: ColumnDatum[];
  tableLabel: string;
  periodLabel: string;
  valueLabel: string;
  className?: string;
}) {
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = [max, max / 2, 0];
  // Label at most ~6 columns so labels never collide.
  const every = Math.max(1, Math.ceil(data.length / 6));
  return (
    <figure className={cn("min-w-0", className)}>
      <figcaption className="sr-only">{title}</figcaption>
      <div role="img" aria-label={summary} className="relative">
        <div className="grid grid-cols-[2.75rem_1fr] gap-2">
          <div aria-hidden className="tabular relative h-48 text-right text-[0.6875rem] text-taupe-deep">
            {ticks.map((tick, i) => (
              <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}>
                {compact(tick)}
              </span>
            ))}
          </div>
          <div className="relative h-48">
            {ticks.map((tick, i) => (
              <span
                key={tick}
                aria-hidden
                className={cn("absolute inset-x-0 h-px", i === ticks.length - 1 ? "bg-line-strong" : "bg-line")}
                style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
              />
            ))}
            <div className="absolute inset-0 flex items-end gap-[2px]">
              {data.map((d, i) => (
                <div key={d.key} className="group relative flex h-full min-w-0 flex-1 items-end justify-center">
                  <div
                    className="w-full max-w-6 rounded-t-[4px] bg-ink transition-opacity group-hover:opacity-80"
                    style={{ height: d.value > 0 ? `max(2px, ${(d.value / max) * 100}%)` : 0 }}
                  />
                  <span
                    aria-hidden
                    // Anchored towards the middle so it never spills past the chart's edge.
                    className={cn(
                      "pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap bg-ink px-2 py-1 text-xs text-paper group-hover:block",
                      i < data.length / 2 ? "left-0" : "right-0",
                    )}
                  >
                    {d.label}: {d.display}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div aria-hidden className="ml-[3.25rem] mt-2 flex gap-[2px] overflow-hidden text-[0.6875rem] text-taupe-deep">
          {data.map((d, i) => (
            <span key={d.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap">
              {i % every === 0 ? d.label : ""}
            </span>
          ))}
        </div>
      </div>
      <DataTable label={tableLabel} head={[periodLabel, valueLabel]} rows={data.map((d) => [d.label, d.display])} />
    </figure>
  );
}

export interface BarDatum {
  key: string;
  label: ReactNode;
  value: number;
  display: ReactNode;
  /** Optional second line under the label. */
  detail?: ReactNode;
}

/** Ranked horizontal bars: label, bar, value. `max` fixes the scale (e.g. 1 for rates). */
export function BarList({ data, max, label }: { data: BarDatum[]; max?: number; label: string }) {
  const scale = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <ul aria-label={label} className="space-y-3">
      {data.map((d) => (
        <li key={d.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5">
          <span className="min-w-0 truncate text-sm font-medium">{d.label}</span>
          <span className="tabular text-sm">{d.display}</span>
          <span aria-hidden className="col-span-2 block h-2 bg-paper-deep">
            <span className="block h-full rounded-r-[4px] bg-ink" style={{ width: `${Math.min(100, (d.value / scale) * 100)}%` }} />
          </span>
          {d.detail && <span className="col-span-2 text-xs text-taupe-deep">{d.detail}</span>}
        </li>
      ))}
    </ul>
  );
}

export function DataTable({ label, head, rows }: { label: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-taupe-deep underline-offset-4 hover:underline">{label}</summary>
      <div className="mt-3 max-h-80 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={h} scope="col" className={cn("border-b border-line-strong py-2 pr-4 text-xs font-semibold text-taupe-deep", i > 0 && "text-right")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, i) =>
                  i === 0 ? (
                    <th key={i} scope="row" className="border-b border-line py-1.5 pr-4 font-normal">
                      {cell}
                    </th>
                  ) : (
                    <td key={i} className="tabular border-b border-line py-1.5 pr-4 text-right">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
