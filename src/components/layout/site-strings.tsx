"use client";

import { createContext, use, type ReactNode } from "react";
import type { Dictionary } from "@/i18n/dictionaries/mn";

/*
 * The few strings client-only parts of the public site need without a
 * server parent to pass them down (the route error boundary). Provided once
 * by the site layout, so neither dictionary ships to the browser whole.
 */

type Strings = { errorPage: Dictionary["errorPage"]; homeHref: string };

const SiteStringsContext = createContext<Strings | null>(null);

export function SiteStrings({ value, children }: { value: Strings; children: ReactNode }) {
  return <SiteStringsContext value={value}>{children}</SiteStringsContext>;
}

export function useSiteStrings(): Strings {
  const value = use(SiteStringsContext);
  if (!value) throw new Error("SiteStrings provider missing");
  return value;
}
