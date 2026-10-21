import { site } from "@/content/site";
import { cn } from "@/lib/cn";

/** Text wordmark built from `site.brand`, so rebranding needs no artwork. */
export function Wordmark({ className }: { className?: string }) {
  const { primary, secondary } = site.brand.wordmark;
  return (
    <span className={cn("inline-flex items-baseline gap-2 text-[0.9375rem] font-bold tracking-[0.22em]", className)}>
      <span>{primary}</span>
      <span aria-hidden className="font-light opacity-50">/</span>
      <span className="tabular">{secondary}</span>
    </span>
  );
}
