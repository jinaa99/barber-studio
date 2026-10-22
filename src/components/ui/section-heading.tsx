import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SectionHeadingProps {
  eyebrow: string;
  /** Optional running index, e.g. "02". */
  index?: string;
  title: ReactNode;
  lead?: ReactNode;
  /** Slot for an action aligned to the heading on wide screens. */
  action?: ReactNode;
  tone?: "default" | "inverse";
  /**
   * `stack`: label above the title. `split`: label in its own narrow column
   * beside the title on wide screens, for sections that want an editorial edge.
   */
  layout?: "stack" | "split";
  as?: "h1" | "h2";
  className?: string;
}

/** The label line: running index, a short rule and the section name. */
export function SectionLabel({
  index,
  children,
  tone = "default",
  className,
}: {
  index?: string;
  children: ReactNode;
  tone?: "default" | "inverse";
  className?: string;
}) {
  return (
    <p className={cn("eyebrow flex items-center gap-3", tone === "inverse" ? "text-canvas/65" : "text-muted", className)}>
      {index && <span className="tabular">{index}</span>}
      {index && <span aria-hidden className="h-px w-6 bg-current opacity-50" />}
      <span>{children}</span>
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  index,
  title,
  lead,
  action,
  tone = "default",
  layout = "stack",
  as: Heading = "h2",
  className,
}: SectionHeadingProps) {
  const muted = tone === "inverse" ? "text-canvas/65" : "text-muted";
  if (layout === "split") {
    return (
      <div className={cn("grid gap-6 lg:grid-cols-12 lg:gap-8", className)}>
        <SectionLabel index={index} tone={tone} className="self-start lg:col-span-3 lg:pt-3">
          {eyebrow}
        </SectionLabel>
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between lg:col-span-9">
          <div className="max-w-3xl">
            <Heading className="text-display-md text-balance">{title}</Heading>
            {lead && <p className={cn("mt-5 max-w-prose text-lead", muted)}>{lead}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col gap-8 md:flex-row md:items-end md:justify-between md:gap-12", className)}>
      <div className="max-w-3xl">
        <SectionLabel index={index} tone={tone}>
          {eyebrow}
        </SectionLabel>
        <Heading className="mt-5 text-display-md text-balance">{title}</Heading>
        {lead && <p className={cn("mt-5 max-w-prose text-lead", muted)}>{lead}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
