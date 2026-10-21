import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { Testimonial } from "@/content/types";
import { Container } from "@/components/ui/container";
import { DemoNotice } from "@/components/ui/demo-notice";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";

export function Testimonials({
  dict,
  testimonials,
  index,
}: {
  dict: Dictionary;
  testimonials: Testimonial[];
  index?: string;
}) {
  const t = dict.home.testimonials;
  const hasSamples = testimonials.some((q) => q.isSample);
  return (
    <section className="py-section">
      <Container>
        <SectionHeading
          index={index}
          eyebrow={t.eyebrow}
          title={t.title}
          action={hasSamples ? <DemoNotice className="max-w-xs">{t.demoNotice}</DemoNotice> : undefined}
        />
        <ul className="mt-14 grid gap-12 md:grid-cols-3 md:gap-8">
          {testimonials.map((q, i) => (
            <Reveal as="li" key={q.id} delay={i * 100} className="flex flex-col border-t border-line-strong pt-8">
              <figure className="flex h-full flex-col">
                <blockquote className="flex-1 font-display text-2xl leading-snug italic text-ink-muted sm:text-[1.75rem]">
                  “{q.quote}”
                </blockquote>
                <figcaption className="mt-8 flex items-center gap-3 text-sm text-taupe-deep">
                  <span aria-hidden className="h-px w-6 bg-brass" />
                  {q.attribution}
                  {q.isSample && (
                    <span className="eyebrow ml-auto shrink-0 whitespace-nowrap rounded-full border border-line-strong px-2.5 py-1 text-[0.625rem]">
                      {dict.common.demoContent}
                    </span>
                  )}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}
