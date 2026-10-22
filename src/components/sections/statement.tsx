import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";

/**
 * The studio's point of view, set large and off-centre: a short label in the
 * left column and the statement running across the rest of the grid.
 */
export function Statement({ text, label }: { text: string; label: string }) {
  return (
    <section className="pb-section-sm pt-section">
      <Container className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <p className="eyebrow self-start text-muted lg:col-span-3 lg:pt-4">{label}</p>
        <Reveal variant="fade" className="lg:col-span-9">
          <p className="max-w-5xl text-statement text-balance">{text}</p>
        </Reveal>
      </Container>
    </section>
  );
}
