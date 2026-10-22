import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Lock, SearchX } from "lucide-react";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { format } from "@/lib/format";
import { cn } from "@/lib/cn";

/*
 * Server-safe building blocks for the staff dashboard. A product UI rather
 * than the editorial site: white panels on the neutral canvas, compact type,
 * hairline rules, and colour only where it carries meaning (status, errors,
 * the demo banner, the active item).
 */

/** Border, surface, focus ring and invalid state shared by every field; callers add height and size. */
export const field =
  "w-full min-w-0 rounded-lg border border-line-strong bg-surface text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-faint hover:border-ink/40 focus:border-ink focus:shadow-[0_0_0_3px_rgb(86_96_47/0.18)] focus:outline-none aria-invalid:border-danger aria-invalid:focus:shadow-[0_0_0_3px_rgb(161_54_31/0.15)] disabled:opacity-50";

export const inputClass = `${field} h-10 px-3 text-[0.9375rem]`;

/** For filter bars: the same field, one step shorter. */
export const compactInputClass = `${field} h-9 px-3 text-sm`;

/** File inputs size to their content. */
export const fileInputClass = `${field} px-2 py-2 text-sm file:mr-3 file:h-7 file:rounded-md file:border-0 file:bg-ink file:px-3 file:text-sm file:text-canvas`;

export const textareaClass = `${field} min-h-24 px-3 py-2.5 text-[0.9375rem] leading-relaxed`;

const buttonBase =
  "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3.5 text-sm font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 motion-reduce:active:scale-100";

export const smallButton = `${buttonBase} border border-line-strong bg-surface text-ink hover:border-ink/40 hover:bg-canvas`;

export const primarySmallButton = `${buttonBase} bg-ink text-canvas hover:bg-accent-deep`;

export const dangerSmallButton = `${buttonBase} border border-danger/35 bg-surface text-danger hover:border-danger hover:bg-danger-wash`;

/** A segmented control (view switch, range presets, list filters): the group, then each option. */
export const segmentGroup = "flex w-fit max-w-full flex-wrap gap-0.5 rounded-lg bg-stone/80 p-0.5";
export function segment(active: boolean) {
  return cn(
    "inline-flex h-8 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium transition-[background-color,color,box-shadow] duration-150",
    active ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line),0_1px_2px_rgb(18_18_17/0.08)]" : "text-muted hover:text-ink",
  );
}

export const textLink =
  "font-medium underline decoration-line-strong underline-offset-4 transition-[text-decoration-color] hover:decoration-current";

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
    <header className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-sm text-muted">{eyebrow}</div>}
        <h1 className="text-[1.75rem] font-medium leading-tight tracking-[-0.03em] text-balance sm:text-[2rem]">{title}</h1>
        {lead && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A titled white panel. Most dashboard content sits in one of these. */
export function Section({
  title,
  lead,
  actions,
  children,
  className,
  id,
  flush,
}: {
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id: string;
  /** Let a table or list run to the panel's edges. */
  flush?: boolean;
}) {
  return (
    <section aria-labelledby={id} className={cn("mt-6 min-w-0 rounded-2xl border border-line bg-surface", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <h2 id={id} className="text-base font-medium tracking-[-0.01em]">
            {title}
          </h2>
          {lead && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{lead}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className={cn("mt-4", flush ? "pb-1" : "px-5 pb-5 sm:px-6 sm:pb-6")}>{children}</div>
    </section>
  );
}

/**
 * Several figures sharing one surface, split by hairlines, so a row of
 * metrics reads as one instrument rather than a row of identical cards.
 */
export function StatGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-px overflow-hidden rounded-2xl border border-line bg-line", className)}>{children}</div>
  );
}

/** One figure. `value` is the point of the tile. */
export function StatTile({
  label,
  value,
  hint,
  action,
  tone = "default",
  size = "md",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  tone?: "default" | "muted" | "attention";
  size?: "md" | "lg";
}) {
  return (
    <div className="flex min-w-0 flex-col bg-surface p-5">
      <p className="flex items-center gap-2 text-sm text-muted">
        {tone === "attention" && <span aria-hidden className="size-1.5 rounded-full bg-warning" />}
        {label}
      </p>
      <p
        className={cn(
          "numeric mt-2 font-medium tracking-[-0.03em]",
          size === "lg" ? "text-[2.25rem] leading-none" : "text-[1.75rem] leading-tight",
          tone === "muted" && "text-muted",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p>}
      {action && <div className="mt-auto pt-3 text-sm">{action}</div>}
    </div>
  );
}

const statusTone: Record<AppointmentStatus, { chip: string; dot: string }> = {
  PENDING: { chip: "bg-warning-wash text-warning", dot: "bg-warning" },
  CONFIRMED: { chip: "bg-success-wash text-success", dot: "bg-success" },
  COMPLETED: { chip: "bg-stone text-ink-muted", dot: "bg-ink-muted" },
  CANCELLED: { chip: "bg-canvas text-muted line-through decoration-muted/60", dot: "bg-faint" },
  NO_SHOW: { chip: "bg-danger-wash text-danger", dot: "bg-danger" },
};

/** Status chip: always text plus tone, never colour alone. */
export function StatusBadge({ status, label, className }: { status: AppointmentStatus; label: string; className?: string }) {
  const tone = statusTone[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium",
        tone.chip,
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", tone.dot)} />
      {label}
    </span>
  );
}

const tagTone = {
  default: "border-line-strong text-muted",
  solid: "border-ink bg-ink text-canvas",
  danger: "border-danger/40 text-danger",
  /** Something absent, e.g. a permission not granted. */
  missing: "border-dashed border-line-strong text-muted line-through",
};

/** Small label chip. Pick a `tone` rather than overriding its colours with `className`. */
export function Tag({ children, tone = "default", className }: { children: ReactNode; tone?: keyof typeof tagTone; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full border px-2 text-[0.6875rem] font-medium",
        tagTone[tone],
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
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong bg-surface/50 px-6 py-12 text-center text-sm text-muted">
      <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-stone">
        <Icon className="size-4.5 text-muted" strokeWidth={1.75} />
      </span>
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
  const Icon = tone === "error" || tone === "demo" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-3 rounded-xl px-4 py-3 text-sm leading-relaxed",
        tone === "demo" && "bg-warning-wash text-ink",
        tone === "info" && "bg-stone/70 text-ink-muted",
        tone === "error" && "bg-danger-wash text-danger",
        tone === "success" && "bg-success-wash text-success",
        className,
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "demo" ? "text-warning" : tone === "info" ? "text-muted" : "text-current",
        )}
        strokeWidth={1.75}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Forbidden({ dict }: { dict: Dictionary }) {
  const t = dict.admin.common;
  return (
    <div className="py-10">
      <EmptyState icon="lock">
        <p className="font-medium text-ink">{t.forbiddenTitle}</p>
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
        <p className="font-medium text-ink">{t.notFoundTitle}</p>
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
  const disabled = cn(smallButton, "pointer-events-none opacity-40");
  return (
    <nav aria-label={t.pagination} className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="tabular text-muted">{format(t.showing, { from, to, total })}</p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={smallButton} rel="prev">
            <ChevronLeft aria-hidden className="size-4" strokeWidth={1.75} />
            {t.previous}
          </Link>
        ) : (
          <span aria-disabled className={disabled}>
            <ChevronLeft aria-hidden className="size-4" strokeWidth={1.75} />
            {t.previous}
          </span>
        )}
        <span className="tabular px-2 text-muted">{format(t.pageOf, { page, pages })}</span>
        {page < pages ? (
          <Link href={href(page + 1)} className={smallButton} rel="next">
            {t.next}
            <ChevronRight aria-hidden className="size-4" strokeWidth={1.75} />
          </Link>
        ) : (
          <span aria-disabled className={disabled}>
            {t.next}
            <ChevronRight aria-hidden className="size-4" strokeWidth={1.75} />
          </span>
        )}
      </div>
    </nav>
  );
}

/**
 * A table on a white surface that scrolls inside its own frame on narrow
 * screens, never the page. `flush` drops the frame for tables already inside
 * a panel.
 */
export function TableFrame({ children, label, flush }: { children: ReactNode; label: string; flush?: boolean }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn("overflow-x-auto", flush ? "" : "rounded-2xl border border-line bg-surface")}
    >
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm [&_tbody_tr:last-child>*]:border-b-0 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-canvas/70">
        {children}
      </table>
    </div>
  );
}

export const th =
  "whitespace-nowrap border-b border-line bg-canvas/60 px-4 py-2.5 text-xs font-medium text-muted first:pl-5 last:pr-5";
export const td = "border-b border-line px-4 py-3 align-top first:pl-5 last:pr-5";

/** Loading placeholder for a page body (shown while the session and data stream in). */
export function PageSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none">
      <span className="sr-only">{label}</span>
      <div className="h-9 w-56 rounded-lg bg-stone" />
      <div className="mt-3 h-4 w-80 max-w-full rounded bg-stone" />
      <div className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-stone sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 bg-stone/60" />
        ))}
      </div>
      <div className="mt-6 h-72 rounded-2xl bg-stone/70" />
    </div>
  );
}
