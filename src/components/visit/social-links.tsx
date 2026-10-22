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
  const muted = tone === "inverse" ? "text-canvas/65" : "text-muted";
  return (
    <ul className={cn("space-y-3 text-sm", className)}>
      {socials.map((social) => (
        <li key={social.label} className="flex items-baseline justify-between gap-4">
          {social.href ? (
            <a
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1.5"
            >
              <span className="link-draw">{social.label}</span>
              <ArrowUpRight
                aria-hidden
                className="size-3.5 transition-transform duration-300 ease-emphasis group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                strokeWidth={1.75}
              />
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
