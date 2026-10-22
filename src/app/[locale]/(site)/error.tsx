"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button, buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { SectionLabel } from "@/components/ui/section-heading";
import { useSiteStrings } from "@/components/layout/site-strings";

/** A public page failed to render. Offer a retry and a way home; the header and footer stay usable. */
export default function SiteError({ error, retry }: { error: unknown; retry: () => void }) {
  const { errorPage: t, homeHref } = useSiteStrings();
  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;
  return (
    <Container role="alert" className="min-h-[70svh] pb-section pt-[calc(var(--spacing-header)+5rem)]">
      <SectionLabel>{t.eyebrow}</SectionLabel>
      <h1 className="mt-6 max-w-3xl text-display-lg text-balance">{t.title}</h1>
      <p className="mt-6 max-w-lg text-lead text-muted">{t.lead}</p>
      {digest && <p className="tabular mt-3 text-xs text-muted">{digest}</p>}
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => retry()}>
          <RotateCcw aria-hidden className="size-4" strokeWidth={1.75} />
          {t.retry}
        </Button>
        <Link href={homeHref} className={buttonStyles({ variant: "secondary" })}>
          {t.home}
        </Link>
      </div>
    </Container>
  );
}
