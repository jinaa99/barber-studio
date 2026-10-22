import { z } from "zod";

/*
 * Stock media providers (Pexels, Pixabay): request validation, defensive
 * parsing of their API responses into one shape, which rendition to download,
 * and the hosts files may come from. Pure, so it is unit-tested with fixture
 * responses; the network side is `lib/server/stock-media.ts`.
 *
 * Terms checked 2026-10-22 (see docs/MEDIA.md):
 *   Pexels  https://www.pexels.com/api/documentation/  · https://www.pexels.com/license/
 *   Pixabay https://pixabay.com/api/docs/              · https://pixabay.com/service/license-summary/
 */

export const stockProviders = ["pexels", "pixabay"] as const;
export type StockProvider = (typeof stockProviders)[number];

export const stockKinds = ["photo", "video"] as const;
export type StockKind = (typeof stockKinds)[number];

export const stockOrientations = ["any", "landscape", "portrait"] as const;
export type StockOrientation = (typeof stockOrientations)[number];

export const STOCK_PER_PAGE = 24;

/** Licence recorded with every asset saved from a provider. */
export const providerLicense: Record<StockProvider, { name: string; url: string; label: string; homepage: string }> = {
  pexels: { name: "Pexels License", url: "https://www.pexels.com/license/", label: "Pexels", homepage: "https://www.pexels.com" },
  pixabay: {
    name: "Pixabay Content License",
    url: "https://pixabay.com/service/license-summary/",
    label: "Pixabay",
    homepage: "https://pixabay.com",
  },
};

export const stockSearchSchema = z.object({
  provider: z.enum(stockProviders),
  kind: z.enum(stockKinds),
  query: z.string().trim().min(1).max(100),
  orientation: z.enum(stockOrientations).default("any"),
  page: z.coerce.number().int().min(1).max(50).default(1),
});
export type StockSearch = z.output<typeof stockSearchSchema>;

export const stockSelectionSchema = z.object({
  provider: z.enum(stockProviders),
  kind: z.enum(stockKinds),
  id: z.string().regex(/^\d{1,15}$/),
});
export type StockSelection = z.output<typeof stockSelectionSchema>;

/** One search result, as the dashboard shows it. Contains no secrets. */
export interface StockItem {
  provider: StockProvider;
  kind: StockKind;
  id: string;
  /** The asset's page on the provider's site. */
  pageUrl: string;
  creatorName: string | null;
  creatorUrl: string | null;
  /** Provider's description: Pexels alt text, Pixabay tags. */
  description: string | null;
  width: number;
  height: number;
  durationSeconds: number | null;
  thumbnailUrl: string;
  /** Larger still for the detail view (a video's poster frame). */
  previewUrl: string;
  /** Small rendition for playing a video in the detail view. */
  previewVideoUrl: string | null;
}

/** What to download when an item is saved. Server-side only. */
export interface StockDownload {
  url: string;
  /** Still frame for a video. */
  posterUrl: string | null;
  width: number;
  height: number;
}

export interface StockAsset {
  item: StockItem;
  download: StockDownload;
}

/* ------------------------------------------------------------------- Hosts */

/** Hosts that previews and saved files may come from: https, default port, nothing else. */
export const providerHosts: Record<StockProvider, readonly string[]> = {
  pexels: ["images.pexels.com", "videos.pexels.com"],
  pixabay: ["pixabay.com", "cdn.pixabay.com"],
};

export function isProviderMediaUrl(provider: StockProvider, value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.port === "" &&
    url.username === "" &&
    url.password === "" &&
    providerHosts[provider].includes(url.hostname)
  );
}

/** Links shown to staff (asset and creator pages) must be plain https URLs on the provider's site. */
function isProviderPage(provider: StockProvider, value: string): boolean {
  try {
    const url = new URL(value);
    const site = provider === "pexels" ? "pexels.com" : "pixabay.com";
    return url.protocol === "https:" && (url.hostname === site || url.hostname === `www.${site}`);
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- Pexels */

const pexelsPhoto = z.object({
  id: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  url: z.string(),
  photographer: z.string().nullish(),
  photographer_url: z.string().nullish(),
  alt: z.string().nullish(),
  src: z.object({ original: z.string(), large: z.string(), medium: z.string() }),
});

const pexelsVideo = z.object({
  id: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  url: z.string(),
  image: z.string(),
  duration: z.number().nonnegative(),
  user: z.object({ name: z.string().nullish(), url: z.string().nullish() }).nullish(),
  video_files: z.array(
    z.object({
      file_type: z.string().nullish(),
      width: z.number().int().nullish(),
      height: z.number().int().nullish(),
      link: z.string(),
    }),
  ),
});

const pexelsPage = z.object({ total_results: z.number().int().nonnegative(), photos: z.array(z.unknown()).optional(), videos: z.array(z.unknown()).optional() });

/* --------------------------------------------------------------- Pixabay */

const pixabayImage = z.object({
  id: z.number().int().positive(),
  pageURL: z.string(),
  tags: z.string().nullish(),
  webformatURL: z.string(),
  largeImageURL: z.string(),
  imageWidth: z.number().int().positive(),
  imageHeight: z.number().int().positive(),
  user: z.string().nullish(),
});

const pixabayRendition = z.object({
  url: z.string(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  thumbnail: z.string().nullish(),
});

const pixabayVideo = z.object({
  id: z.number().int().positive(),
  pageURL: z.string(),
  tags: z.string().nullish(),
  duration: z.number().nonnegative(),
  user: z.string().nullish(),
  videos: z.object({
    large: pixabayRendition.nullish(),
    medium: pixabayRendition.nullish(),
    small: pixabayRendition.nullish(),
    tiny: pixabayRendition.nullish(),
  }),
});

const pixabayPage = z.object({ totalHits: z.number().int().nonnegative(), hits: z.array(z.unknown()) });

/* -------------------------------------------------------------- Normalize */

const clean = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
};

interface Rendition {
  url: string;
  width: number;
  height: number;
}

/**
 * The rendition to keep: the largest whose long edge is at most 1280 px (the
 * size the hero is encoded at), else the smallest available. Keeps saved
 * footage light for phones.
 */
export function pickRendition<T extends Rendition>(renditions: T[]): T | null {
  const usable = renditions.filter((r) => r.width > 0 && r.height > 0).sort((a, b) => Math.max(a.width, a.height) - Math.max(b.width, b.height));
  if (usable.length === 0) return null;
  const fitting = usable.filter((r) => Math.max(r.width, r.height) <= 1280);
  return fitting.at(-1) ?? usable[0];
}

function normalizePexelsPhoto(raw: unknown): StockAsset | null {
  const parsed = pexelsPhoto.safeParse(raw);
  if (!parsed.success) return null;
  const p = parsed.data;
  const urls = [p.src.original, p.src.large, p.src.medium];
  if (!urls.every((u) => isProviderMediaUrl("pexels", u)) || !isProviderPage("pexels", p.url)) return null;
  const creatorUrl = p.photographer_url && isProviderPage("pexels", p.photographer_url) ? p.photographer_url : null;
  return {
    item: {
      provider: "pexels",
      kind: "photo",
      id: String(p.id),
      pageUrl: p.url,
      creatorName: clean(p.photographer),
      creatorUrl,
      description: clean(p.alt),
      width: p.width,
      height: p.height,
      durationSeconds: null,
      thumbnailUrl: p.src.medium,
      previewUrl: p.src.large,
      previewVideoUrl: null,
    },
    download: { url: p.src.original, posterUrl: null, width: p.width, height: p.height },
  };
}

function normalizePexelsVideo(raw: unknown): StockAsset | null {
  const parsed = pexelsVideo.safeParse(raw);
  if (!parsed.success) return null;
  const v = parsed.data;
  if (!isProviderMediaUrl("pexels", v.image) || !isProviderPage("pexels", v.url)) return null;
  const files = v.video_files
    .filter((f) => f.file_type === "video/mp4" && f.width && f.height && isProviderMediaUrl("pexels", f.link))
    .map((f) => ({ url: f.link, width: f.width!, height: f.height! }));
  const chosen = pickRendition(files);
  if (!chosen) return null;
  const smallest = [...files].sort((a, b) => a.width * a.height - b.width * b.height)[0];
  const creatorUrl = v.user?.url && isProviderPage("pexels", v.user.url) ? v.user.url : null;
  return {
    item: {
      provider: "pexels",
      kind: "video",
      id: String(v.id),
      pageUrl: v.url,
      creatorName: clean(v.user?.name),
      creatorUrl,
      description: null,
      width: v.width,
      height: v.height,
      durationSeconds: v.duration,
      thumbnailUrl: v.image,
      previewUrl: v.image,
      previewVideoUrl: smallest.url,
    },
    download: { url: chosen.url, posterUrl: v.image, width: chosen.width, height: chosen.height },
  };
}

function normalizePixabayImage(raw: unknown): StockAsset | null {
  const parsed = pixabayImage.safeParse(raw);
  if (!parsed.success) return null;
  const p = parsed.data;
  if (![p.webformatURL, p.largeImageURL].every((u) => isProviderMediaUrl("pixabay", u)) || !isProviderPage("pixabay", p.pageURL)) {
    return null;
  }
  // Documented: replacing "_640" in webformatURL gives the 340 px tall version.
  const thumbnail = p.webformatURL.replace("_640", "_340");
  const scale = Math.min(1, 1280 / Math.max(p.imageWidth, p.imageHeight));
  return {
    item: {
      provider: "pixabay",
      kind: "photo",
      id: String(p.id),
      pageUrl: p.pageURL,
      creatorName: clean(p.user),
      creatorUrl: null,
      description: clean(p.tags),
      width: p.imageWidth,
      height: p.imageHeight,
      durationSeconds: null,
      thumbnailUrl: thumbnail,
      previewUrl: p.webformatURL,
      previewVideoUrl: null,
    },
    // largeImageURL is at most 1280 px on its long edge.
    download: {
      url: p.largeImageURL,
      posterUrl: null,
      width: Math.round(p.imageWidth * scale),
      height: Math.round(p.imageHeight * scale),
    },
  };
}

function normalizePixabayVideo(raw: unknown): StockAsset | null {
  const parsed = pixabayVideo.safeParse(raw);
  if (!parsed.success) return null;
  const v = parsed.data;
  if (!isProviderPage("pixabay", v.pageURL)) return null;
  const sizes = [v.videos.tiny, v.videos.small, v.videos.medium, v.videos.large].filter(
    (r): r is z.output<typeof pixabayRendition> => Boolean(r?.url && isProviderMediaUrl("pixabay", r.url)),
  );
  const chosen = pickRendition(sizes);
  if (!chosen) return null;
  const still = (r: z.output<typeof pixabayRendition> | null | undefined) =>
    r?.thumbnail && isProviderMediaUrl("pixabay", r.thumbnail) ? r.thumbnail : null;
  const poster = still(chosen) ?? still(v.videos.medium) ?? still(v.videos.small);
  const thumbnail = still(v.videos.tiny) ?? still(v.videos.small) ?? poster;
  if (!poster || !thumbnail) return null;
  const largest = sizes.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
  return {
    item: {
      provider: "pixabay",
      kind: "video",
      id: String(v.id),
      pageUrl: v.pageURL,
      creatorName: clean(v.user),
      creatorUrl: null,
      description: clean(v.tags),
      width: largest.width,
      height: largest.height,
      durationSeconds: v.duration,
      thumbnailUrl: thumbnail,
      previewUrl: poster,
      previewVideoUrl: sizes[0].url,
    },
    download: { url: chosen.url, posterUrl: poster, width: chosen.width, height: chosen.height },
  };
}

export function normalizeAsset(provider: StockProvider, kind: StockKind, raw: unknown): StockAsset | null {
  if (provider === "pexels") return kind === "photo" ? normalizePexelsPhoto(raw) : normalizePexelsVideo(raw);
  return kind === "photo" ? normalizePixabayImage(raw) : normalizePixabayVideo(raw);
}

export interface StockPage {
  items: StockItem[];
  total: number;
  hasMore: boolean;
}

/** A provider's search response as a page of items. Malformed hits are skipped, never guessed at. */
export function normalizeSearch(search: StockSearch, body: unknown): StockPage | null {
  const { provider, kind, page, orientation } = search;
  let hits: unknown[];
  let total: number;
  if (provider === "pexels") {
    const parsed = pexelsPage.safeParse(body);
    if (!parsed.success) return null;
    hits = (kind === "photo" ? parsed.data.photos : parsed.data.videos) ?? [];
    total = parsed.data.total_results;
  } else {
    const parsed = pixabayPage.safeParse(body);
    if (!parsed.success) return null;
    hits = parsed.data.hits;
    total = parsed.data.totalHits;
  }
  let items = hits.flatMap((hit) => normalizeAsset(provider, kind, hit)?.item ?? []);
  // Pixabay's video search has no orientation filter.
  if (provider === "pixabay" && kind === "video" && orientation !== "any") {
    items = items.filter((i) => (orientation === "landscape" ? i.width >= i.height : i.height > i.width));
  }
  return { items, total, hasMore: page * STOCK_PER_PAGE < total };
}

/** The provider's search endpoint for `search` (without the API key). */
export function searchUrl(search: StockSearch): URL {
  const { provider, kind, query, page, orientation } = search;
  if (provider === "pexels") {
    const url = new URL(kind === "photo" ? "https://api.pexels.com/v1/search" : "https://api.pexels.com/v1/videos/search");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", String(STOCK_PER_PAGE));
    url.searchParams.set("page", String(page));
    if (orientation !== "any") url.searchParams.set("orientation", orientation);
    return url;
  }
  const url = new URL(kind === "photo" ? "https://pixabay.com/api/" : "https://pixabay.com/api/videos/");
  url.searchParams.set("q", query);
  url.searchParams.set("per_page", String(STOCK_PER_PAGE));
  url.searchParams.set("page", String(page));
  url.searchParams.set("safesearch", "true");
  if (kind === "photo") {
    url.searchParams.set("image_type", "photo");
    if (orientation !== "any") url.searchParams.set("orientation", orientation === "landscape" ? "horizontal" : "vertical");
  } else {
    url.searchParams.set("video_type", "film");
  }
  return url;
}

/** The provider's endpoint for one asset by id (used when saving, so the browser never supplies URLs). */
export function assetUrl({ provider, kind, id }: StockSelection): URL {
  if (provider === "pexels") {
    return new URL(kind === "photo" ? `https://api.pexels.com/v1/photos/${id}` : `https://api.pexels.com/v1/videos/videos/${id}`);
  }
  const url = new URL(kind === "photo" ? "https://pixabay.com/api/" : "https://pixabay.com/api/videos/");
  url.searchParams.set("id", id);
  return url;
}

/** The single asset in a by-id response (Pexels returns the object, Pixabay a one-hit page). */
export function normalizeAssetResponse(selection: StockSelection, body: unknown): StockAsset | null {
  let raw: unknown = body;
  if (selection.provider === "pixabay") {
    const parsed = pixabayPage.safeParse(body);
    if (!parsed.success || parsed.data.hits.length === 0) return null;
    raw = parsed.data.hits[0];
  }
  const asset = normalizeAsset(selection.provider, selection.kind, raw);
  return asset?.item.id === selection.id ? asset : null;
}
