import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Info, Lock, SearchX } from "lucide-react";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { format } from "@/lib/format";
import { cn } from "@/lib/cn";

/*
 * Server-safe building blocks for the staff dashboard. Quieter than the public
 * site: compact type, hairline rules, and colour only where it carries meaning
 * (status, errors, the demo banner).
 */

export const inputClass =
  "h-11 w-full min-w-0 border border-line-strong bg-paper px-3 text-[0.9375rem] text-ink transition-colors duration-200 hover:border-ink/50 focus:border-ink focus:outline-none aria-invalid:border-danger disabled:opacity-50";

export const textareaClass =
  "min-h-24 w-full min-w-0 border border-line-strong bg-paper px-3 py-2.5 text-[0.9375rem] leading-relaxed text-ink transition-colors duration-200 hover:border-ink/50 focus:border-ink focus:outline-none aria-invalid:border-danger";

export const smallButton =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-line-strong px-4 text-sm font-medium transition-colors duration-200 hover:border-ink hover:bg-ink hover:text-paper disabled:pointer-events-none disabled:opacity-40";

export const primarySmallButton =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-ink px-4 text-sm font-semibold text-paper transition-colors duration-200 hover:bg-ink-muted disabled:pointer-events-none disabled:opacity-40";

export const dangerSmallButton =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-danger px-4 text-sm font-medium text-danger transition-colors duration-200 hover:bg-danger hover:text-paper disabled:pointer-events-none disabled:opacity-40";

export const textLink = "underline underline-offset-4 transition-opacity hover:opacity-70";

export function PageHeader({
  title,
  lead,
  actions,
  eyebrow,
}: {
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-3 text-sm text-taupe-deep">{eyebrow}</div>}
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
        {lead && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-taupe-deep">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  lead,
  actions,
  children,
  className,
  id,
}: {
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("mt-12", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {lead && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-taupe-deep">{lead}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** One figure. `value` uses proportional numerals; it is the point of the tile. */
export function StatTile({
  label,
  value,
  hint,
  action,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  tone?: "default" | "muted";
}) {
  return (
    <div className="flex min-w-0 flex-col border-t border-line-strong pt-4">
      <p className="text-sm text-taupe-deep">{label}</p>
      <p className={cn("mt-2 text-3xl font-semibold tracking-tight", tone === "muted" && "text-taupe-deep")}>{value}</p>
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-taupe-deep">{hint}</p>}
      {action && <div className="mt-3 text-sm">{action}</div>}
    </div>
  );
}

const statusTone: Record<AppointmentStatus, string> = {
  PENDING: "border-brass text-ink",
  CONFIRMED: "border-ink bg-ink text-paper",
  COMPLETED: "border-line-strong text-taupe-deep",
  CANCELLED: "border-line text-taupe-deep line-through",
  NO_SHOW: "border-danger text-danger",
};

/** Status chip: always text plus tone, never colour alone. */
export function StatusBadge({ status, label, className }: { status: AppointmentStatus; label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide whitespace-nowrap uppercase",
        statusTone[status],
        className,
      )}
    >
      {label}
    </span>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-line-strong px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide whitespace-nowrap text-taupe-deep uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ children, icon = "empty" }: { children: ReactNode; icon?: "empty" | "lock" }) {
  const Icon = icon === "lock" ? Lock : SearchX;
  return (
    <div className="flex flex-col items-center gap-3 border border-dashed border-line-strong px-6 py-12 text-center text-sm text-taupe-deep">
      <Icon aria-hidden className="size-5 text-taupe" strokeWidth={1.5} />
      <div className="max-w-md leading-relaxed">{children}</div>
    </div>
  );
}

export function Notice({
  children,
  tone = "info",
  className,
}: {
  children: ReactNode;
  tone?: "info" | "demo" | "error" | "success";
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-3 border-l-2 px-4 py-3 text-sm leading-relaxed",
        tone === "demo" && "border-brass bg-brass/10",
        tone === "info" && "border-line-strong bg-paper-deep/60 text-taupe-deep",
        tone === "error" && "border-danger bg-danger/5 text-danger",
        tone === "success" && "border-ink bg-paper-deep/60",
        className,
      )}
    >
      <Info aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone === "error" ? "text-danger" : "text-brass")} strokeWidth={1.75} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Forbidden({ dict }: { dict: Dictionary }) {
  const t = dict.admin.common;
  return (
    <div className="py-10">
      <EmptyState icon="lock">
        <p className="font-semibold text-ink">{t.forbiddenTitle}</p>
        <p className="mt-1">{t.forbiddenBody}</p>
      </EmptyState>
    </div>
  );
}

export function NotFoundState({ dict, backHref }: { dict: Dictionary; backHref: string }) {
  const t = dict.admin.common;
  return (
    <div className="py-10">
      <EmptyState>
        <p className="font-semibold text-ink">{t.notFoundTitle}</p>
        <p className="mt-1">{t.notFoundBody}</p>
        <Link href={backHref} className={cn(smallButton, "mt-4")}>
          {t.back}
        </Link>
      </EmptyState>
    </div>
  );
}

/** Previous/next pagination for list views. `href(page)` builds the link. */
export function Pagination({
  dict,
  page,
  pageSize,
  total,
  href,
}: {
  dict: Dictionary;
  page: number;
  pageSize: number;
  total: number;
  href: (page: number) => string;
}) {
  const t = dict.admin.common;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label={t.pagination} className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="tabular text-taupe-deep">{format(t.showing, { from, to, total })}</p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={smallButton} rel="prev">
            <ChevronLeft aria-hidden className="size-4" strokeWidth={1.75} />
            {t.previous}
          </Link>
        ) : (
          <span aria-disabled className={cn(smallButton, "pointer-events-none opacity-40")}>
            <ChevronLeft aria-hidden className="size-4" strokeWidth={1.75} />
            {t.previous}
          </span>
        )}
        <span className="tabular px-2 text-taupe-deep">{format(t.pageOf, { page, pages })}</span>
        {page < pages ? (
          <Link href={href(page + 1)} className={smallButton} rel="next">
            {t.next}
            <ChevronRight aria-hidden className="size-4" strokeWidth={1.75} />
          </Link>
        ) : (
          <span aria-disabled className={cn(smallButton, "pointer-events-none opacity-40")}>
            {t.next}
            <ChevronRight aria-hidden className="size-4" strokeWidth={1.75} />
          </span>
        )}
      </div>
    </nav>
  );
}

/** A table that scrolls inside its own frame on narrow screens, never the page. */
export function TableFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export const th = "border-b border-line-strong py-2.5 pr-4 text-xs font-semibold tracking-wide text-taupe-deep uppercase";
export const td = "border-b border-line py-3 pr-4 align-top";

/** Loading placeholder for a page body (shown while the session and data stream in). */
export function PageSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none">
      <span className="sr-only">{label}</span>
      <div className="h-9 w-56 bg-paper-deep" />
      <div className="mt-3 h-4 w-80 max-w-full bg-paper-deep" />
      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 bg-paper-deep" />
        ))}
      </div>
      <div className="mt-10 h-64 bg-paper-deep" />
    </div>
  );
}
