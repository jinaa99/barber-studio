import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { Media } from "@/content/types";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "@/components/ui/section-heading";
import { Photo } from "@/components/media/photo";

/**
 * Wide photograph against a narrow column of copy, then the three working
 * principles as a numbered row on a hairline.
 */
export function StudioIntro({ dict, media }: { dict: Dictionary; media: Media }) {
  const t = dict.home.intro;
  return (
    <section className="pb-section">
      <Container>
        <div className="grid gap-10 md:grid-cols-12 md:gap-8">
          <Reveal variant="mask" className="md:col-span-7 lg:col-span-8">
            <Photo media={media} ratio="3/2" sizes="(min-width: 1440px) 940px, (min-width: 768px) 60vw, 100vw" />
          </Reveal>
          <Reveal delay={120} className="flex flex-col justify-end md:col-span-5 lg:col-span-4">
            <SectionLabel>{t.eyebrow}</SectionLabel>
            <h2 className="mt-5 text-display-sm text-balance">{t.title}</h2>
            <p className="mt-5 text-[1.0625rem] leading-relaxed text-muted">{t.body}</p>
          </Reveal>
        </div>

        <ol className="mt-16 grid border-t border-line sm:mt-24 md:grid-cols-3">
          {t.principles.map((p, i) => (
            <Reveal
              as="li"
              key={p.title}
              delay={i * 90}
              className="border-b border-line py-7 md:border-b-0 md:border-l md:px-8 md:py-9 md:first:border-l-0 md:first:pl-0"
            >
              <span className="tabular text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-6 text-xl tracking-[-0.02em]">{p.title}</h3>
              <p className="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-muted">{p.body}</p>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
