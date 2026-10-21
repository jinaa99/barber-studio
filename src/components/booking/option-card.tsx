"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A native radio input presented as a selectable row. Keeping the real input
 * gives arrow-key navigation and screen-reader semantics for free.
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
        "relative flex cursor-pointer items-start gap-4 border px-5 py-5 transition-[border-color,background-color] duration-300 ease-soft",
        "has-focus-visible:outline has-focus-visible:outline-[1.5px] has-focus-visible:outline-offset-2 has-focus-visible:outline-brass",
        checked ? "border-ink bg-paper" : "border-line bg-paper/40 hover:border-line-strong",
        disabled && "cursor-not-allowed opacity-45 hover:border-line",
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
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
          checked ? "border-ink bg-ink text-paper" : "border-line-strong",
        )}
      >
        {checked && <Check className="size-3" strokeWidth={2.5} />}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </label>
  );
}
