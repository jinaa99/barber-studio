import { ArrowUpRight } from "lucide-react";
import type { SocialLink } from "@/content/site";
import { cn } from "@/lib/cn";

/** Social accounts. Entries without an `href` (demo placeholders) render as plain text. */
export function SocialLinks({
  socials,
  tone = "default",
  className,
}: {
  socials: SocialLink[];
  tone?: "default" | "inverse";
  className?: string;
}) {
  const muted = tone === "inverse" ? "text-paper/50" : "text-taupe-deep";
  return (
    <ul className={cn("space-y-3 text-sm", className)}>
      {socials.map((social) => (
        <li key={social.label} className="flex items-baseline justify-between gap-4">
          {social.href ? (
            <a
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1.5 hover:opacity-70"
            >
              {social.label}
              <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.75} />
            </a>
          ) : (
            <span>{social.label}</span>
          )}
          <span className={muted}>{social.handle}</span>
        </li>
      ))}
    </ul>
  );
}
