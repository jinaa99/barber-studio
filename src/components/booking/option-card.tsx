"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A native radio input presented as a selectable row. Keeping the real input
 * gives arrow-key navigation and screen-reader semantics for free. The
 * selected row lifts onto a white surface with an ink border and a filled
 * indicator, so the state never relies on colour alone.
 */
export function OptionCard({
  name,
  value,
  checked,
  disabled,
  onSelect,
  children,
  className,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  onSelect: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer items-start gap-4 rounded-xl border px-5 py-4.5 transition-[border-color,background-color,box-shadow] duration-200 ease-standard",
        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent",
        checked
          ? "border-ink bg-surface shadow-[0_1px_0_rgb(18_18_17/0.04),0_8px_24px_-16px_rgb(18_18_17/0.35)]"
          : "border-line-strong bg-transparent hover:border-ink/40 hover:bg-surface/60",
        disabled && "cursor-not-allowed opacity-50 hover:border-line-strong hover:bg-transparent",
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-[background-color,border-color] duration-200",
          checked ? "border-ink bg-ink text-canvas" : "border-line-strong bg-surface",
        )}
      >
        <Check className={cn("size-3 transition-transform duration-200 ease-emphasis", checked ? "scale-100" : "scale-0")} strokeWidth={2.5} />
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}
