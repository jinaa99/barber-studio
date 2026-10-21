import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/cn";

/** Opening block for inner pages: generous top space below the fixed header. */
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
    <Container as="header" className={cn("pb-14 pt-[calc(var(--spacing-header)+3.5rem)] sm:pb-20 sm:pt-[calc(var(--spacing-header)+6rem)]", className)}>
      <p className="eyebrow text-taupe-deep">{eyebrow}</p>
      <h1 className="mt-6 max-w-5xl text-display-lg font-medium text-balance">{title}</h1>
      {lead && <p className="mt-6 max-w-2xl text-base leading-relaxed text-taupe-deep sm:text-lg">{lead}</p>}
      {children}
    </Container>
  );
}
