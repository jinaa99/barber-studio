import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { Testimonial } from "@/content/types";
import { Container } from "@/components/ui/container";
import { DemoNotice } from "@/components/ui/demo-notice";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/cn";

/**
 * Guest notes. The first quote is set large as the section's focus; the rest
 * follow in a narrower column. Sample reviews are tagged as such.
 */
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
  const [lead, ...rest] = testimonials;
  if (!lead) return null;

  const caption = (q: Testimonial) => (
    <figcaption className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
      <span aria-hidden className="h-px w-6 bg-current opacity-50" />
      {q.attribution}
      {q.isSample && (
        <span className="micro rounded-full border border-line-strong px-2 py-1 text-muted">{dict.common.demoContent}</span>
      )}
    </figcaption>
  );

  return (
    <section className="py-section">
      <Container>
        <SectionHeading
          index={index}
          eyebrow={t.eyebrow}
          title={t.title}
          layout="split"
          action={hasSamples ? <DemoNotice className="max-w-xs">{t.demoNotice}</DemoNotice> : undefined}
        />
        <div className="mt-14 grid gap-12 lg:mt-20 lg:grid-cols-12 lg:gap-8">
          <Reveal className="lg:col-span-7 lg:col-start-4">
            <figure>
              <blockquote className="text-statement text-balance">“{lead.quote}”</blockquote>
              {caption(lead)}
            </figure>
          </Reveal>
          {rest.length > 0 && (
            <ul className={cn("grid gap-10 border-t border-line pt-10 sm:grid-cols-2 lg:col-span-9 lg:col-start-4 lg:mt-8")}>
              {rest.map((q, i) => (
                <Reveal as="li" key={q.id} delay={i * 90}>
                  <figure>
                    <blockquote className="text-xl leading-snug tracking-[-0.02em] text-ink-muted">“{q.quote}”</blockquote>
                    {caption(q)}
                  </figure>
                </Reveal>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </section>
  );
}
