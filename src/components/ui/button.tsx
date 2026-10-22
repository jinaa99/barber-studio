import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "inverse" | "inverse-outline";
type Size = "sm" | "md" | "lg";

// Hover deepens toward the olive accent: the one place the accent answers an action.
const base =
  "group inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-full font-medium tracking-[-0.01em] transition-[background-color,color,border-color,transform] duration-200 ease-standard active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 motion-reduce:active:scale-100";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-canvas hover:bg-accent-deep",
  secondary: "border border-line-strong bg-transparent text-ink hover:border-ink hover:bg-surface",
  inverse: "bg-canvas text-ink hover:bg-accent-soft",
  "inverse-outline": "border border-canvas/30 text-canvas hover:border-canvas/80 hover:bg-canvas/10",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-13 px-6 text-base",
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
      className="-mr-0.5 size-4 transition-transform duration-300 ease-emphasis group-hover:translate-x-1"
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

/** Understated text link with an arrow, for "view all" style actions. The underline draws in on hover. */
export function ArrowLink({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link className={cn("group inline-flex items-center gap-2 font-medium", className)} {...props}>
      <span className="link-draw pb-0.5">{children}</span>
      <Arrow />
    </Link>
  );
}
