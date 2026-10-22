import { site } from "@/content/site";
import { cn } from "@/lib/cn";

/** Text wordmark built from the studio's name parts, so rebranding needs no artwork. */
export function Wordmark({
  className,
  wordmark = site.brand.wordmark,
}: {
  className?: string;
  wordmark?: { primary: string; secondary: string };
}) {
  const { primary, secondary } = wordmark;
  return (
    <span className={cn("inline-flex items-baseline gap-1.5 text-base font-semibold tracking-[-0.02em]", className)}>
      <span>{primary}</span>
      {secondary && (
        <>
          <span aria-hidden className="font-light opacity-40">/</span>
          <span className="tabular font-medium opacity-80">{secondary}</span>
        </>
      )}
    </span>
  );
}
