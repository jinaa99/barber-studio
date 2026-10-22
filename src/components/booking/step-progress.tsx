"use client";

import { Check } from "lucide-react";
import type { BookingStep } from "@/lib/booking/storage";
import { cn } from "@/lib/cn";
import { format } from "@/lib/format";
import type { BookingDict } from "./types";

export const bookingSteps: BookingStep[] = ["service", "barber", "time", "details", "review"];

/**
 * Step indicator with a continuous progress rule underneath. Completed steps
 * are buttons so visitors can jump back; later steps are plain text.
 */
export function StepProgress({
  dict,
  current,
  onSelect,
}: {
  dict: BookingDict;
  current: BookingStep;
  onSelect: (step: BookingStep) => void;
}) {
  const currentIndex = bookingSteps.indexOf(current);
  const progress = (currentIndex + 1) / bookingSteps.length;
  const label = format(dict.booking.stepOf, { current: currentIndex + 1, total: bookingSteps.length });
  return (
    <nav aria-label={label}>
      <p className="flex items-baseline justify-between gap-4 text-sm sm:hidden">
        <span className="font-medium">{dict.booking.steps[current]}</span>
        <span className="tabular text-muted">{label}</span>
      </p>

      <ol className="hidden sm:flex">
        {bookingSteps.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          const content = (
            <>
              <span
                className={cn(
                  "tabular flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-[background-color,color,border-color] duration-300",
                  active && "bg-ink text-canvas",
                  done && "bg-accent-wash text-accent-deep",
                  !active && !done && "border border-line-strong text-muted",
                )}
              >
                {done ? <Check aria-hidden className="size-3.5" strokeWidth={2.25} /> : i + 1}
              </span>
              <span className={cn("truncate text-sm", active ? "font-medium text-ink" : done ? "text-ink" : "text-muted")}>
                {dict.booking.steps[step]}
              </span>
            </>
          );
          return (
            <li key={step} aria-current={active ? "step" : undefined} className="min-w-0 flex-1 pb-4">
              {done ? (
                <button
                  type="button"
                  onClick={() => onSelect(step)}
                  className="-m-1 flex max-w-full items-center gap-2.5 rounded-full p-1 transition-colors hover:bg-surface"
                >
                  {content}
                </button>
              ) : (
                <span className="flex items-center gap-2.5">{content}</span>
              )}
            </li>
          );
        })}
      </ol>

      {/* One continuous rule that fills as the visitor advances. */}
      <div aria-hidden className="mt-3 h-0.5 overflow-hidden rounded-full bg-line sm:mt-0">
        <div
          className="h-full origin-left rounded-full bg-ink transition-transform duration-500 ease-emphasis"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </nav>
  );
}
