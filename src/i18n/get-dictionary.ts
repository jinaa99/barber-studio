import { locale as localeParam } from "next/root-params";
import { notFound } from "next/navigation";
import { hasLocale, type Locale } from "./config";
import type { Dictionary } from "./dictionaries/mn";

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  mn: () => import("./dictionaries/mn").then((m) => m.mn),
  en: () => import("./dictionaries/en").then((m) => m.en),
};

/** The active locale for the current request, read from the root `[locale]` segment. */
export async function getLocale(): Promise<Locale> {
  const value = await localeParam();
  if (!hasLocale(value)) notFound();
  return value;
}

export async function getDictionary(locale?: Locale): Promise<Dictionary> {
  return dictionaries[locale ?? (await getLocale())]();
}

export type { Dictionary };
