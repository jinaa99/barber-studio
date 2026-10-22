import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assetUrl,
  isProviderMediaUrl,
  normalizeAssetResponse,
  normalizeSearch,
  pickRendition,
  searchUrl,
  stockSearchSchema,
  stockSelectionSchema,
} from "./stock";

/* Fixtures follow the documented response shapes (trimmed to the fields used). */

const pexelsPhoto = {
  id: 3998429,
  width: 4000,
  height: 6000,
  url: "https://www.pexels.com/photo/barber-cutting-hair-3998429/",
  photographer: "Thgusstavo Santana",
  photographer_url: "https://www.pexels.com/@thgusstavo",
  alt: "Barber trimming a client's beard",
  src: {
    original: "https://images.pexels.com/photos/3998429/pexels-photo-3998429.jpeg",
    large: "https://images.pexels.com/photos/3998429/pexels-photo-3998429.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    medium: "https://images.pexels.com/photos/3998429/pexels-photo-3998429.jpeg?auto=compress&cs=tinysrgb&h=350",
  },
};

const pexelsVideo = {
  id: 3998519,
  width: 3840,
  height: 2160,
  url: "https://www.pexels.com/video/a-barber-at-work-3998519/",
  image: "https://images.pexels.com/videos/3998519/pictures/preview-0.jpg",
  duration: 14,
  user: { id: 1, name: "cottonbro studio", url: "https://www.pexels.com/@cottonbro" },
  video_files: [
    { id: 1, quality: "hd", file_type: "video/mp4", width: 3840, height: 2160, link: "https://videos.pexels.com/video-files/3998519/uhd.mp4" },
    { id: 2, quality: "hd", file_type: "video/mp4", width: 1280, height: 720, link: "https://videos.pexels.com/video-files/3998519/hd.mp4" },
    { id: 3, quality: "sd", file_type: "video/mp4", width: 640, height: 360, link: "https://videos.pexels.com/video-files/3998519/sd.mp4" },
    { id: 4, quality: "hd", file_type: "video/mp4", width: 1920, height: 1080, link: "https://evil.example.com/hd.mp4" },
  ],
};

const pixabayImage = {
  id: 2564792,
  pageURL: "https://pixabay.com/photos/barber-shop-2564792/",
  tags: "barber, haircut, shop",
  previewURL: "https://cdn.pixabay.com/photo/2017/07/31/barber_150.jpg",
  webformatURL: "https://pixabay.com/get/g1234_640.jpg",
  largeImageURL: "https://pixabay.com/get/g5678_1280.jpg",
  imageWidth: 5184,
  imageHeight: 3456,
  user: "Free-Photos",
  user_id: 242387,
};

const pixabayVideo = {
  id: 125,
  pageURL: "https://pixabay.com/videos/id-125/",
  tags: "barber, razor",
  duration: 12,
  user: "Coverr-Free-Footage",
  user_id: 1281706,
  videos: {
    large: { url: "", width: 0, height: 0, size: 0, thumbnail: "" },
    medium: { url: "https://cdn.pixabay.com/video/125/medium.mp4", width: 1920, height: 1080, size: 9000000, thumbnail: "https://cdn.pixabay.com/video/125/medium.jpg" },
    small: { url: "https://cdn.pixabay.com/video/125/small.mp4", width: 1280, height: 720, size: 4000000, thumbnail: "https://cdn.pixabay.com/video/125/small.jpg" },
    tiny: { url: "https://cdn.pixabay.com/video/125/tiny.mp4", width: 960, height: 540, size: 2000000, thumbnail: "https://cdn.pixabay.com/video/125/tiny.jpg" },
  },
};

const search = (over: Record<string, unknown> = {}) => stockSearchSchema.parse({ provider: "pexels", kind: "photo", query: "barber", ...over });

describe("stock media providers", () => {
  it("accepts only https URLs on the provider's own media hosts", () => {
    assert.equal(isProviderMediaUrl("pexels", "https://images.pexels.com/photos/1.jpeg"), true);
    assert.equal(isProviderMediaUrl("pexels", "https://videos.pexels.com/video-files/1/a.mp4"), true);
    assert.equal(isProviderMediaUrl("pexels", "http://images.pexels.com/photos/1.jpeg"), false);
    assert.equal(isProviderMediaUrl("pexels", "https://images.pexels.com:8443/photos/1.jpeg"), false);
    assert.equal(isProviderMediaUrl("pexels", "https://user:pw@images.pexels.com/x.jpg"), false);
    assert.equal(isProviderMediaUrl("pexels", "https://images.pexels.com.evil.example/x.jpg"), false);
    assert.equal(isProviderMediaUrl("pexels", "https://cdn.pixabay.com/x.jpg"), false);
    assert.equal(isProviderMediaUrl("pixabay", "https://pixabay.com/get/x_640.jpg"), true);
    assert.equal(isProviderMediaUrl("pixabay", "https://127.0.0.1/x.jpg"), false);
    assert.equal(isProviderMediaUrl("pixabay", "file:///etc/passwd"), false);
    assert.equal(isProviderMediaUrl("pixabay", "not a url"), false);
  });

  it("validates search input and ids", () => {
    assert.equal(stockSearchSchema.safeParse({ provider: "pexels", kind: "photo", query: "  " }).success, false);
    assert.equal(stockSearchSchema.safeParse({ provider: "unsplash", kind: "photo", query: "x" }).success, false);
    assert.equal(stockSearchSchema.safeParse({ provider: "pexels", kind: "photo", query: "x".repeat(101) }).success, false);
    assert.equal(search({ page: "3" }).page, 3);
    assert.equal(stockSelectionSchema.safeParse({ provider: "pexels", kind: "photo", id: "12345" }).success, true);
    assert.equal(stockSelectionSchema.safeParse({ provider: "pexels", kind: "photo", id: "../1" }).success, false);
    assert.equal(stockSelectionSchema.safeParse({ provider: "pexels", kind: "photo", id: "https://x" }).success, false);
  });

  it("builds provider URLs without the API key", () => {
    const pexels = searchUrl(search({ orientation: "portrait", page: 2 }));
    assert.equal(pexels.origin + pexels.pathname, "https://api.pexels.com/v1/search");
    assert.equal(pexels.searchParams.get("orientation"), "portrait");
    assert.equal(pexels.searchParams.get("page"), "2");
    const pixabay = searchUrl(search({ provider: "pixabay", orientation: "landscape" }));
    assert.equal(pixabay.searchParams.get("orientation"), "horizontal");
    assert.equal(pixabay.searchParams.get("safesearch"), "true");
    assert.equal(pixabay.searchParams.has("key"), false);
    assert.equal(assetUrl({ provider: "pexels", kind: "video", id: "9" }).toString(), "https://api.pexels.com/v1/videos/videos/9");
    assert.equal(assetUrl({ provider: "pixabay", kind: "photo", id: "9" }).searchParams.get("id"), "9");
  });

  it("normalizes Pexels photos with the provider's own credits", () => {
    const page = normalizeSearch(search(), { total_results: 100, photos: [pexelsPhoto, { id: "broken" }] });
    assert.ok(page);
    assert.equal(page.items.length, 1, "malformed hits are skipped");
    assert.equal(page.hasMore, true);
    const [item] = page.items;
    assert.equal(item.creatorName, "Thgusstavo Santana");
    assert.equal(item.creatorUrl, "https://www.pexels.com/@thgusstavo");
    assert.equal(item.pageUrl, pexelsPhoto.url);
    assert.equal(item.description, pexelsPhoto.alt);
    assert.equal(item.id, "3998429");
  });

  it("drops hits whose files are not on the provider's hosts", () => {
    const tampered = { ...pexelsPhoto, src: { ...pexelsPhoto.src, original: "https://evil.example.com/a.jpg" } };
    assert.equal(normalizeSearch(search(), { total_results: 1, photos: [tampered] })?.items.length, 0);
  });

  it("does not invent a creator link the provider didn't send", () => {
    const page = normalizeSearch(search(), { total_results: 1, photos: [{ ...pexelsPhoto, photographer_url: "javascript:alert(1)" }] });
    assert.equal(page?.items[0].creatorUrl, null);
    const pixabay = normalizeSearch(search({ provider: "pixabay" }), { totalHits: 1, hits: [pixabayImage] });
    assert.equal(pixabay?.items[0].creatorName, "Free-Photos");
    assert.equal(pixabay?.items[0].creatorUrl, null);
  });

  it("picks the largest rendition up to 1280 px for video downloads", () => {
    const asset = normalizeAssetResponse({ provider: "pexels", kind: "video", id: "3998519" }, pexelsVideo);
    assert.ok(asset);
    assert.equal(asset.download.url, "https://videos.pexels.com/video-files/3998519/hd.mp4");
    assert.equal(asset.download.posterUrl, pexelsVideo.image);
    assert.equal(asset.item.previewVideoUrl, "https://videos.pexels.com/video-files/3998519/sd.mp4");
    assert.equal(asset.item.durationSeconds, 14);
    assert.equal(pickRendition([{ url: "a", width: 3840, height: 2160 }])?.url, "a", "falls back to the smallest available");
    assert.equal(pickRendition([{ url: "a", width: 0, height: 0 }]), null);
  });

  it("normalizes Pixabay videos and photos", () => {
    const video = normalizeAssetResponse({ provider: "pixabay", kind: "video", id: "125" }, { totalHits: 1, hits: [pixabayVideo] });
    assert.ok(video);
    assert.equal(video.download.url, "https://cdn.pixabay.com/video/125/small.mp4");
    assert.equal(video.download.posterUrl, "https://cdn.pixabay.com/video/125/small.jpg");
    assert.equal(video.item.width, 1920, "reports the largest available size");

    const photo = normalizeAssetResponse({ provider: "pixabay", kind: "photo", id: "2564792" }, { totalHits: 1, hits: [pixabayImage] });
    assert.ok(photo);
    assert.equal(photo.download.url, pixabayImage.largeImageURL);
    assert.equal(photo.item.thumbnailUrl, "https://pixabay.com/get/g1234_340.jpg");
    assert.deepEqual([photo.download.width, photo.download.height], [1280, 853]);
  });

  it("rejects a by-id answer for a different asset", () => {
    assert.equal(normalizeAssetResponse({ provider: "pixabay", kind: "photo", id: "1" }, { totalHits: 1, hits: [pixabayImage] }), null);
    assert.equal(normalizeAssetResponse({ provider: "pexels", kind: "photo", id: "1" }, pexelsPhoto), null);
    assert.equal(normalizeAssetResponse({ provider: "pixabay", kind: "photo", id: "1" }, { totalHits: 0, hits: [] }), null);
  });

  it("filters Pixabay videos by orientation locally", () => {
    const portrait = { ...pixabayVideo, id: 126, videos: { tiny: { ...pixabayVideo.videos.tiny, width: 540, height: 960 } } };
    const page = normalizeSearch(search({ provider: "pixabay", kind: "video", orientation: "portrait" }), { totalHits: 2, hits: [pixabayVideo, portrait] });
    assert.deepEqual(page?.items.map((i) => i.id), ["126"]);
  });

  it("returns null for an unexpected response shape", () => {
    assert.equal(normalizeSearch(search(), { error: "nope" }), null);
    assert.equal(normalizeSearch(search({ provider: "pixabay" }), "[ERROR 400]"), null);
  });
});
