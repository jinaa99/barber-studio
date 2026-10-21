import type { Dictionary } from "@/i18n/dictionaries/mn";
import type { Media } from "@/content/types";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { Photo } from "@/components/media/photo";

export function StudioIntro({ dict, media }: { dict: Dictionary; media: Media }) {
  const t = dict.home.intro;
  return (
    <section className="pb-section">
      <Container>
        <div className="grid gap-12 md:grid-cols-12 md:gap-8">
          <Reveal className="md:col-span-6 lg:col-span-7">
            <Photo media={media} ratio="3/2" sizes="(min-width: 1440px) 800px, (min-width: 768px) 55vw, 100vw" />
          </Reveal>
          <Reveal delay={120} className="flex flex-col justify-end md:col-span-6 lg:col-span-4 lg:col-start-9">
            <p className="eyebrow text-taupe-deep">{t.eyebrow}</p>
            <h2 className="mt-5 text-display-md font-medium text-balance">{t.title}</h2>
            <p className="mt-6 text-base leading-relaxed text-taupe-deep sm:text-lg">{t.body}</p>
          </Reveal>
        </div>

        <ol className="mt-20 grid gap-10 sm:mt-28 md:grid-cols-3 md:gap-8">
          {t.principles.map((p, i) => (
            <Reveal as="li" key={p.title} delay={i * 100} className="border-t border-line-strong pt-6">
              <span className="tabular text-xs font-semibold text-brass">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-taupe-deep">{p.body}</p>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
