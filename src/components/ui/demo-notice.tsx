import { Info } from "lucide-react";
import { cn } from "@/lib/cn";

/** Marks placeholder content so it is never mistaken for real business information. */
export function DemoNotice({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: "default" | "inverse";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-2.5 text-[0.8125rem] leading-relaxed",
        tone === "inverse" ? "text-canvas/65" : "text-muted",
        className,
      )}
    >
      <Info aria-hidden className={cn("mt-0.5 size-3.5 shrink-0", tone === "inverse" ? "text-canvas/50" : "text-faint")} strokeWidth={1.75} />
      <span>{children}</span>
    </p>
  );
}
