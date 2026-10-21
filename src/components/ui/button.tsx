import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "inverse" | "inverse-outline";
type Size = "md" | "lg";

const base =
  "group inline-flex items-center justify-center gap-3 whitespace-nowrap rounded-full font-semibold tracking-[0.01em] transition-[background-color,color,border-color,opacity] duration-300 ease-soft disabled:pointer-events-none disabled:opacity-40";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-ink-muted",
  secondary: "border border-line-strong text-ink hover:border-ink hover:bg-ink hover:text-paper",
  inverse: "bg-paper text-ink hover:bg-sand",
  "inverse-outline": "border border-paper/35 text-paper hover:border-paper hover:bg-paper hover:text-ink",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-[0.9375rem]",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

interface StyleProps {
  variant?: Variant;
  size?: Size;
  /** Show a trailing arrow that nudges on hover. */
  arrow?: boolean;
}

function Arrow() {
  return (
    <ArrowRight
      aria-hidden
      className="size-4 transition-transform duration-300 ease-soft group-hover:translate-x-0.5"
      strokeWidth={1.75}
    />
  );
}

export function ButtonLink({
  variant,
  size,
  arrow,
  className,
  children,
  ...props
}: StyleProps & ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link className={buttonStyles({ variant, size, className })} {...props}>
      {children}
      {arrow && <Arrow />}
    </Link>
  );
}

export function Button({
  variant,
  size,
  arrow,
  className,
  children,
  type = "button",
  ...props
}: StyleProps & ComponentPropsWithoutRef<"button">) {
  return (
    <button type={type} className={buttonStyles({ variant, size, className })} {...props}>
      {children}
      {arrow && <Arrow />}
    </button>
  );
}

/** Understated text link with an arrow, for "view all" style actions. */
export function ArrowLink({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      className={cn(
        "group inline-flex items-center gap-2 border-b border-current pb-1 text-sm font-semibold transition-opacity duration-300 hover:opacity-70",
        className,
      )}
      {...props}
    >
      {children}
      <Arrow />
    </Link>
  );
}
