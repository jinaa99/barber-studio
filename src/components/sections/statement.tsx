import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";

export function Statement({ text }: { text: string }) {
  return (
    <section className="py-section">
      <Container>
        <Reveal className="mx-auto max-w-5xl">
          <span aria-hidden className="mx-auto mb-10 block h-12 w-px bg-brass" />
          <p className="text-center text-statement font-medium text-balance">{text}</p>
        </Reveal>
      </Container>
    </section>
  );
}
