import { z } from "zod";
import type { Locale, LocalizedText } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/mn";
import { site, type OpeningHours, type SocialLink } from "@/content/site";
import type { Weekday } from "@/content/types";
import { parseTime } from "@/lib/booking/time";

/*
 * Editable website content: the studio profile (name, contact, opening hours,
 * socials, demo flag), overrides for selected website copy, and gallery
 * curation. Stored as JSON in the single `site_content` row; `src/content/site.ts`
 * and the dictionaries are the defaults, so an empty or partly invalid row
 * never breaks the site, it just falls back field by field.
 */

export interface StudioProfile {
  /** Placeholder details are labelled as demo content on the site while true. */
  isDemo: boolean;
  name: string;
  wordmark: { primary: string; secondary: string };
  contact: {
    address: LocalizedText;
    city: LocalizedText;
    directions: LocalizedText;
    phoneDisplay: string;
    phoneHref: string;
    email: string;
    mapsUrl: string;
  };
  hours: OpeningHours[];
  socials: SocialLink[];
}

export const weekdayOrder: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const defaultProfile: StudioProfile = {
  isDemo: site.isDemo,
  name: site.brand.name,
  wordmark: { ...site.brand.wordmark },
  contact: { ...site.contact },
  hours: site.hours.map((h) => ({ ...h })),
  socials: site.socials.map((s) => ({ ...s })),
};

/** `tel:` link from a display number: digits and a leading "+". */
export function phoneHrefFor(display: string): string {
  const digits = display.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return digits ? `tel:${digits}` : "";
}

/* -------------------------------------------------------------- Stored JSON */

const localizedText = z.object({ mn: z.string(), en: z.string() });
const hhmm = z.string().refine((t) => parseTime(t) !== null || t === "24:00");

const storedProfile = z
  .object({
    isDemo: z.boolean(),
    name: z.string().min(1),
    wordmark: z.object({ primary: z.string().min(1), secondary: z.string() }),
    contact: z.object({
      address: localizedText,
      city: localizedText,
      directions: localizedText,
      phoneDisplay: z.string(),
      phoneHref: z.string(),
      email: z.string(),
      mapsUrl: z.string(),
    }),
    hours: z
      .array(z.object({ day: z.enum(weekdayOrder), open: hhmm.nullable(), close: hhmm.nullable() }))
      .length(7),
    socials: z.array(z.object({ label: z.string().min(1), handle: z.string(), href: z.string().nullable() })).max(6),
  })
  .partial();

/** Stored profile merged over the defaults, top-level field by field. */
export function resolveProfile(stored: unknown): StudioProfile {
  const parsed = storedProfile.safeParse(stored ?? {});
  if (!parsed.success) return defaultProfile;
  const value = parsed.data;
  return {
    isDemo: value.isDemo ?? defaultProfile.isDemo,
    name: value.name ?? defaultProfile.name,
    wordmark: value.wordmark ?? defaultProfile.wordmark,
    contact: value.contact ?? defaultProfile.contact,
    hours: value.hours ?? defaultProfile.hours,
    socials: value.socials ?? defaultProfile.socials,
  };
}

/* ------------------------------------------------------------ Website copy */

/** Copy the studio can rewrite. `list` entries are one item per line. */
export const editableTexts = [
  { key: "home.hero.titleLead", max: 60 },
  { key: "home.hero.titleAccent", max: 60 },
  { key: "home.hero.lead", max: 300, multiline: true },
  { key: "home.statement", max: 300, multiline: true },
  { key: "home.intro.title", max: 100 },
  { key: "home.intro.body", max: 800, multiline: true },
  { key: "home.finalCta.title", max: 80 },
  { key: "home.finalCta.lead", max: 200, multiline: true },
  { key: "visitPage.lead", max: 300, multiline: true },
  { key: "servicesPage.notes", max: 800, multiline: true, list: true },
] as const;

export type EditableTextKey = (typeof editableTexts)[number]["key"];
export type TextOverrides = Partial<Record<EditableTextKey, LocalizedText>>;

export function resolveTexts(stored: unknown): TextOverrides {
  const parsed = z.record(z.string(), localizedText).safeParse(stored ?? {});
  if (!parsed.success) return {};
  const result: TextOverrides = {};
  for (const { key, max } of editableTexts) {
    const value = parsed.data[key];
    if (value && (value.mn.trim() || value.en.trim())) {
      result[key] = { mn: value.mn.slice(0, max), en: value.en.slice(0, max) };
    }
  }
  return result;
}

function getPath(object: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], object);
}

/** The dictionary's current value for `key`, as a string (lists joined by newlines). */
export function dictionaryText(dict: Dictionary, key: EditableTextKey): string {
  const value = getPath(dict, key);
  return Array.isArray(value) ? value.join("\n") : String(value ?? "");
}

/**
 * The dictionary with the studio's copy overrides applied for `locale`. A
 * language left blank keeps the default text, so a half-translated override
 * never empties a page.
 */
export function applyTextOverrides(dict: Dictionary, overrides: TextOverrides, locale: Locale): Dictionary {
  const entries = editableTexts.filter(({ key }) => overrides[key]?.[locale]?.trim());
  if (entries.length === 0) return dict;
  const next = structuredClone(dict);
  for (const entry of entries) {
    const raw = overrides[entry.key]![locale].trim();
    const value = "list" in entry && entry.list ? raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : raw;
    const parts = entry.key.split(".");
    const parent = getPath(next, parts.slice(0, -1).join(".")) as Record<string, unknown>;
    parent[parts.at(-1)!] = value;
  }
  return next;
}

/* ----------------------------------------------------------------- Gallery */

export interface GallerySettings {
  /** Gallery item ids in display order; items not listed follow in their default order. */
  order: string[];
  hidden: string[];
}

export function resolveGallery(stored: unknown): GallerySettings {
  const parsed = z
    .object({ order: z.array(z.string()).default([]), hidden: z.array(z.string()).default([]) })
    .safeParse(stored ?? {});
  return parsed.success ? parsed.data : { order: [], hidden: [] };
}

/** Apply curation to items that have an `id`: hidden ones removed, listed ones first. */
export function curate<T extends { id: string }>(items: T[], settings: GallerySettings): T[] {
  const rank = (id: string) => {
    const i = settings.order.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !settings.hidden.includes(item.id))
    .sort((a, b) => rank(a.item.id) - rank(b.item.id) || a.index - b.index)
    .map(({ item }) => item);
}

/* -------------------------------------------------------------- Form input */

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), "url");

export const profileFormSchema = z
  .object({
    isDemo: z.boolean(),
    name: z.string().trim().min(1).max(60),
    wordmark: z.object({ primary: z.string().trim().min(1).max(24), secondary: z.string().trim().max(12) }),
    contact: z.object({
      address: z.object({ mn: z.string().trim().min(1).max(200), en: z.string().trim().min(1).max(200) }),
      city: z.object({ mn: z.string().trim().min(1).max(100), en: z.string().trim().min(1).max(100) }),
      directions: z.object({ mn: z.string().trim().max(600), en: z.string().trim().max(600) }),
      phoneDisplay: z
        .string()
        .trim()
        .max(40)
        .refine((v) => v === "" || /^\+?[\d\s()-]{6,}$/.test(v), "phone"),
      email: z
        .string()
        .trim()
        .max(254)
        .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "email"),
      mapsUrl: optionalUrl,
    }),
    hours: z
      .array(
        z.object({
          day: z.enum(weekdayOrder),
          closed: z.boolean(),
          open: z.string(),
          close: z.string(),
        }),
      )
      .length(7),
    socials: z
      .array(z.object({ label: z.string().trim().max(40), handle: z.string().trim().max(80), href: optionalUrl }))
      .max(6),
  })
  .superRefine((v, ctx) => {
    v.hours.forEach((h, i) => {
      if (h.closed) return;
      const open = parseTime(h.open);
      const close = h.close === "24:00" ? 1440 : parseTime(h.close);
      if (open === null) ctx.addIssue({ code: "custom", path: ["hours", i, "open"], message: "time" });
      if (close === null) ctx.addIssue({ code: "custom", path: ["hours", i, "close"], message: "time" });
      if (open !== null && close !== null && close <= open) {
        ctx.addIssue({ code: "custom", path: ["hours", i, "close"], message: "range" });
      }
    });
  });

export type ProfileFormInput = z.output<typeof profileFormSchema>;

export function profileFromForm(input: ProfileFormInput): StudioProfile {
  return {
    isDemo: input.isDemo,
    name: input.name,
    wordmark: input.wordmark,
    contact: { ...input.contact, phoneHref: phoneHrefFor(input.contact.phoneDisplay) },
    hours: input.hours.map((h) => (h.closed ? { day: h.day, open: null, close: null } : { day: h.day, open: h.open, close: h.close })),
    socials: input.socials
      .filter((s) => s.label)
      .map((s) => ({ label: s.label, handle: s.handle, href: s.href || null })),
  };
}
