"use client";

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { minutesToTime } from "@/lib/booking/dates";
import { cn } from "@/lib/cn";
import { useFieldErrorCode } from "./form";
import { compactInputClass } from "./ui";

interface Row {
  key: number;
  weekday: number;
  start: string;
  end: string;
}

interface Labels {
  weekdays: string[];
  addBlock: string;
  removeBlock: string;
  start: string;
  end: string;
  dayOff: string;
  blockError: { time: string; order: string; overlap: string };
}

/** Monday first, matching the rest of the dashboard. */
const order = [1, 2, 3, 4, 5, 6, 0];

/**
 * Weekly working blocks, edited per weekday. Submits aligned `weekday`,
 * `start` and `end` lists; the server validates them (validateBlocks) and
 * reports errors by row position, which matches the DOM order here.
 */
export function ScheduleEditor({
  initial,
  labels,
}: {
  initial: { weekday: number; startMinute: number; endMinute: number }[];
  labels: Labels;
}) {
  const id = useId();
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((b, i) => ({ key: i, weekday: b.weekday, start: minutesToTime(b.startMinute), end: minutesToTime(Math.min(b.endMinute, 1435)) })),
  );
  const [nextKey, setNextKey] = useState(initial.length);

  function add(weekday: number) {
    const last = rows.filter((r) => r.weekday === weekday).at(-1);
    setRows([...rows, { key: nextKey, weekday, start: last ? last.end : "10:00", end: last ? "20:00" : "18:00" }]);
    setNextKey(nextKey + 1);
  }

  function update(key: number, patch: Partial<Row>) {
    setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  // Submitted order: grouped by weekday in display order.
  const ordered = order.flatMap((d) => rows.filter((r) => r.weekday === d));

  return (
    <div className="divide-y divide-line border-y border-line">
      {order.map((weekday) => {
        const dayRows = ordered.filter((r) => r.weekday === weekday);
        return (
          <fieldset key={weekday} className="grid gap-3 py-4 sm:grid-cols-[8rem_1fr]">
            <legend className="float-left pt-2 text-sm font-semibold sm:w-32">{labels.weekdays[weekday]}</legend>
            <div className="clear-left space-y-2 sm:clear-none">
              {dayRows.length === 0 && <p className="pt-2 text-sm text-muted">{labels.dayOff}</p>}
              {dayRows.map((row) => (
                <BlockRow
                  key={row.key}
                  id={`${id}-${row.key}`}
                  index={ordered.indexOf(row)}
                  row={row}
                  labels={labels}
                  onChange={(patch) => update(row.key, patch)}
                  onRemove={() => setRows(rows.filter((r) => r.key !== row.key))}
                />
              ))}
              <button type="button" onClick={() => add(weekday)} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
                <Plus aria-hidden className="size-3.5" strokeWidth={1.75} />
                {labels.addBlock}
              </button>
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

function BlockRow({
  id,
  index,
  row,
  labels,
  onChange,
  onRemove,
}: {
  id: string;
  index: number;
  row: Row;
  labels: Labels;
  onChange: (patch: Partial<Row>) => void;
  onRemove: () => void;
}) {
  const code = useFieldErrorCode(`block.${index}`);
  const message = code === "time" ? labels.blockError.time : code === "range" ? labels.blockError.order : code === "overlap" ? labels.blockError.overlap : null;
  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="weekday" value={row.weekday} />
        <label className="text-xs text-muted">
          <span className="mb-1 block">{labels.start}</span>
          <input
            type="time"
            name="start"
            step={300}
            value={row.start}
            onChange={(e) => onChange({ start: e.target.value })}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? `${id}-error` : undefined}
            className={cn(compactInputClass, "w-32")}
          />
        </label>
        <span aria-hidden className="pb-2 text-faint">–</span>
        <label className="text-xs text-muted">
          <span className="mb-1 block">{labels.end}</span>
          <input
            type="time"
            step={300}
            name="end"
            value={row.end}
            onChange={(e) => onChange({ end: e.target.value })}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? `${id}-error` : undefined}
            className={cn(compactInputClass, "w-32")}
          />
        </label>
        <button type="button" onClick={onRemove} aria-label={labels.removeBlock} className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-stone hover:text-ink">
          <Trash2 aria-hidden className="size-4" strokeWidth={1.5} />
        </button>
      </div>
      {message && (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-danger">
          {message}
        </p>
      )}
    </div>
  );
}
