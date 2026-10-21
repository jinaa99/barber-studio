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
        "flex items-start gap-2.5 text-xs leading-relaxed",
        tone === "inverse" ? "text-paper/55" : "text-taupe-deep",
        className,
      )}
    >
      <Info aria-hidden className="mt-px size-3.5 shrink-0 text-brass" strokeWidth={1.75} />
      <span>{children}</span>
    </p>
  );
}
