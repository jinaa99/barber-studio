import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-heading";
import { cn } from "@/lib/cn";

/**
 * Opening block for inner pages: a large title on the left and the lead set
 * against its baseline on the right, so the page starts with an editorial
 * edge rather than a centred banner. `children` follow under the lead.
 */
export function PageIntro({
  eyebrow,
  title,
  lead,
  children,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Container
      as="header"
      className={cn("pb-12 pt-[calc(var(--spacing-header)+3rem)] sm:pb-16 sm:pt-[calc(var(--spacing-header)+5rem)]", className)}
    >
      <SectionLabel>{eyebrow}</SectionLabel>
      <div className="mt-6 grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-8">
        <h1 className="text-display-lg text-balance lg:col-span-8">{title}</h1>
        {(lead || children) && (
          <div className="lg:col-span-4 lg:pb-2">
            {lead && <p className="max-w-md text-lead text-muted">{lead}</p>}
            {children}
          </div>
        )}
      </div>
    </Container>
  );
}
