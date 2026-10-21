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
  as?: "h1" | "h2";
  className?: string;
}

export function SectionHeading({
  eyebrow,
  index,
  title,
  lead,
  action,
  tone = "default",
  as: Heading = "h2",
  className,
}: SectionHeadingProps) {
  const muted = tone === "inverse" ? "text-paper/60" : "text-taupe-deep";
  return (
    <div
      className={cn(
        "flex flex-col gap-8 md:flex-row md:items-end md:justify-between md:gap-12",
        className,
      )}
    >
      <div className="max-w-3xl">
        <p className={cn("eyebrow flex items-center gap-3", muted)}>
          {index && <span className="tabular text-brass">{index}</span>}
          {index && <span aria-hidden className="h-px w-8 bg-current opacity-40" />}
          <span>{eyebrow}</span>
        </p>
        <Heading className="mt-5 text-display-md font-medium text-balance">{title}</Heading>
        {lead && <p className={cn("mt-5 max-w-prose text-base leading-relaxed sm:text-lg", muted)}>{lead}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
