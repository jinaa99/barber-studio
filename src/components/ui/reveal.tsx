"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type RevealVariant = "up" | "fade" | "mask" | "scale";

/**
 * Reveals its children once they enter the viewport. `up` lifts copy into
 * place, `fade` suits wide blocks, `mask` opens a photograph upward and
 * `scale` lets a photo settle into its frame. The hidden state lives in CSS
 * behind `(scripting: enabled)` and reduced-motion queries, so content is
 * never hidden for visitors who can't run the animation.
 */
export function Reveal({
  children,
  delay = 0,
  variant = "up",
  className,
  as: Component = "div",
}: {
  children: ReactNode;
  delay?: number;
  variant?: RevealVariant;
  className?: string;
  as?: "div" | "li" | "section" | "figure";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          node.dataset.reveal = "shown";
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Component
      ref={ref as never}
      data-reveal=""
      data-variant={variant}
      className={cn(className)}
      style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}
    >
      {children}
    </Component>
  );
}
