import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { OpeningHours } from "@/content/site";
import { cn } from "@/lib/cn";

interface HoursGroup {
  from: OpeningHours["day"];
  to: OpeningHours["day"];
  open: string | null;
  close: string | null;
}

/** Collapse consecutive days with identical hours: Tue–Fri 10:00–20:00. */
function groupHours(hours: OpeningHours[]): HoursGroup[] {
  const groups: HoursGroup[] = [];
  for (const h of hours) {
    const last = groups.at(-1);
    if (last && last.open === h.open && last.close === h.close) {
      last.to = h.day;
    } else {
      groups.push({ from: h.day, to: h.day, open: h.open, close: h.close });
    }
  }
  return groups;
}

export function OpeningHoursList({
  dict,
  hours,
  tone = "default",
  compact = false,
  className,
}: {
  dict: Dictionary;
  hours: OpeningHours[];
  tone?: "default" | "inverse";
  /** Group days into ranges with short names, for tight spaces. */
  compact?: boolean;
  className?: string;
}) {
  const names = compact ? dict.calendar.weekdaysShort : dict.weekdays;
  const rows = compact
    ? groupHours(hours)
    : hours.map((h) => ({ from: h.day, to: h.day, open: h.open, close: h.close }));

  return (
    <dl className={cn("text-sm", compact ? "space-y-1.5" : "divide-y", tone === "inverse" ? "divide-line-inverse" : "divide-line", className)}>
      {rows.map((row) => (
        <div key={row.from} className={cn("flex items-baseline justify-between gap-6", !compact && "py-3")}>
          <dt className={tone === "inverse" ? "text-paper/60" : "text-taupe-deep"}>
            {names[row.from]}
            {row.to !== row.from && `–${names[row.to]}`}
          </dt>
          <dd className={cn("tabular", !row.open && (tone === "inverse" ? "text-paper/45" : "text-taupe"))}>
            {row.open && row.close ? `${row.open}–${row.close}` : dict.common.closed}
          </dd>
        </div>
      ))}
    </dl>
  );
}
