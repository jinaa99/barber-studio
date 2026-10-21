"use client";

import { Check } from "lucide-react";
import type { BookingStep } from "@/lib/booking/storage";
import { cn } from "@/lib/cn";
import { format } from "@/lib/format";
import type { BookingDict } from "./types";

export const bookingSteps: BookingStep[] = ["service", "barber", "time", "details", "review"];

/** Step indicator. Completed steps are buttons so visitors can jump back. */
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
  return (
    <nav aria-label={format(dict.booking.stepOf, { current: currentIndex + 1, total: bookingSteps.length })}>
      <p className="eyebrow text-taupe-deep sm:hidden">
        {format(dict.booking.stepOf, { current: currentIndex + 1, total: bookingSteps.length })} ·{" "}
        <span className="text-ink">{dict.booking.steps[current]}</span>
      </p>
      <div aria-hidden className="mt-3 flex gap-1.5 sm:hidden">
        {bookingSteps.map((step, i) => (
          <span key={step} className={cn("h-0.5 flex-1 transition-colors duration-500", i <= currentIndex ? "bg-ink" : "bg-line-strong")} />
        ))}
      </div>

      <ol className="hidden border-b border-line sm:flex">
        {bookingSteps.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          const content = (
            <>
              <span
                className={cn(
                  "tabular flex size-6 items-center justify-center rounded-full border text-[0.6875rem] font-semibold transition-colors duration-300",
                  active && "border-ink bg-ink text-paper",
                  done && "border-ink text-ink",
                  !active && !done && "border-line-strong text-taupe",
                )}
              >
                {done ? <Check className="size-3" strokeWidth={2.5} /> : i + 1}
              </span>
              <span className={cn("text-sm", active ? "font-semibold text-ink" : done ? "text-ink" : "text-taupe")}>
                {dict.booking.steps[step]}
              </span>
            </>
          );
          return (
            <li
              key={step}
              aria-current={active ? "step" : undefined}
              className={cn("relative flex-1 pb-5", active && "after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-ink")}
            >
              {done ? (
                <button type="button" onClick={() => onSelect(step)} className="flex items-center gap-3 hover:opacity-70">
                  {content}
                </button>
              ) : (
                <span className="flex items-center gap-3">{content}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
