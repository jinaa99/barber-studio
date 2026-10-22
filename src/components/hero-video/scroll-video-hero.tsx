"use client";

import { getImageProps, type StaticImageData } from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { heroToneEvent } from "@/lib/events";
import { cn } from "@/lib/cn";

/** A crop centre as fractions of the frame (0 = left/top, 1 = right/bottom). */
export interface Focus {
  x: number;
  y: number;
}

/** A focus that may travel with the scroll: `at` is hero progress 0–1. */
export type FocusTrack = Focus | (Focus & { at: number })[];

export interface ScrollVideoSource {
  /** Landscape file, used everywhere unless `portraitSrc` is set. */
  src: string;
  /** Optional portrait cut for `(orientation: portrait)` screens. */
  portraitSrc?: string;
  /** Source frame rate; only used to skip seeks that wouldn't change the frame. */
  fps: number;
}

type Mode = "pending" | "scrub" | "still";

/** Share of the scroll that plays the video; the rest holds the last frame and hands over. */
const VIDEO_END = 0.9;
const WASH_START = 0.93;
/** Seconds for the displayed position to close ~63% of the gap to the scroll position. */
const SMOOTHING = 0.11;
/** A seek that hasn't reported back after this long is treated as lost and retried. */
const SEEK_TIMEOUT_MS = 1200;

function detectMode(): Exclude<Mode, "pending"> {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  const saveData = Boolean(nav.connection?.saveData) || matchMedia("(prefers-reduced-data: reduce)").matches;
  return reduce || saveData ? "still" : "scrub";
}

let cachedMode: Exclude<Mode, "pending"> | null = null;
const subscribe = () => () => {};
const getSnapshot = () => (cachedMode ??= detectMode());
const getServerSnapshot = () => null;

/** One download per file for the page's lifetime; a hidden `<Activity>` remount reuses it. */
const downloads = new Map<string, Promise<Blob>>();
function download(src: string): Promise<Blob> {
  let pending = downloads.get(src);
  if (!pending) {
    pending = fetch(src).then((res) => {
      if (!res.ok) throw new Error(`video ${res.status}`);
      return res.blob();
    });
    // A failed download may succeed on the next visit to the page.
    pending.catch(() => downloads.delete(src));
    downloads.set(src, pending);
  }
  return pending;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function focusAt(track: FocusTrack, p: number): Focus {
  if (!Array.isArray(track)) return track;
  const next = track.findIndex((k) => k.at >= p);
  if (next <= 0) return track[next === 0 ? 0 : track.length - 1];
  const a = track[next - 1];
  const b = track[next];
  const t = smoothstep(a.at, b.at, p);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

const objectPosition = (f: Focus) => `${(f.x * 100).toFixed(2)}% ${(f.y * 100).toFixed(2)}%`;

/**
 * Home hero test: a generated video scrubbed by the scroll position.
 *
 * Server-rendered as a single screen with the video's first frame and the
 * copy, so it works without JavaScript. In the browser, unless motion or
 * data is reduced, it becomes a tall section whose sticky screen maps scroll
 * progress 0 → `VIDEO_END` onto the video's real duration (read from its
 * metadata), holds the last frame, and fades to the page colour. The file is
 * downloaded once in full (scrubbing needs every frame) and played from a
 * blob URL, so seeks never wait on the network. If it can't be loaded or
 * decoded, the hero falls back to the still screen.
 */
export function ScrollVideoHero({
  video,
  poster,
  still,
  posterAlt,
  stillAlt,
  focus,
  intro,
  footer,
  scrollHint,
  bookCta,
  skipLabel,
  afterId,
}: {
  video: ScrollVideoSource;
  /** The video's first frame: shown while it loads, so the hand-over is seamless. */
  poster: StaticImageData;
  /** Static frame for reduced motion. */
  still: StaticImageData;
  posterAlt: string;
  stillAlt: string;
  /** Crop centres: landscape is usually near-centre; portrait crops hard, so it can travel. */
  focus: { landscape: FocusTrack; portrait: FocusTrack };
  intro: ReactNode;
  /** Left side of the bottom bar (e.g. a note about the footage). */
  footer: ReactNode;
  scrollHint: string;
  /** Compact booking link kept in the bar for the whole scroll. */
  bookCta: ReactNode;
  skipLabel: string;
  afterId: string;
}) {
  const preferred = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const mode: Mode = preferred === null ? "pending" : failed ? "still" : preferred;
  const scrub = mode === "scrub";
  const root = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const section = root.current;
    const el = videoRef.current;
    if (!section || !el || !scrub) return;
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });

    const q = gsap.utils.selector(section);
    const [introEl] = q("[data-intro]");
    const [hintEl] = q("[data-hint]");
    const [washEl] = q("[data-wash]");
    const [barEl] = q("[data-progress]");
    const portrait = matchMedia("(orientation: portrait)");
    const src = video.portraitSrc && portrait.matches ? video.portraitSrc : video.src;

    let disposed = false;
    let objectUrl: string | null = null;
    let duration = 0;
    let target = 0; // scroll progress, 0–1
    let shown = 0; // smoothed progress actually displayed
    let loaded = false; // the first frame has decoded
    let requested = -1; // last time handed to the decoder
    let queued: number | null = null; // newest time waiting for the current seek to finish
    let seekStarted = 0;
    let raf = 0;
    let last = 0;

    const fail = () => {
      if (!disposed) setFailed(true);
    };

    const seek = (time: number) => {
      if (el.seeking && performance.now() - seekStarted < SEEK_TIMEOUT_MS) {
        queued = time; // one seek in flight; the newest target wins
        return;
      }
      queued = null;
      requested = time;
      seekStarted = performance.now();
      try {
        el.currentTime = time;
      } catch {
        requested = -1; // try again on the next frame
      }
    };

    const onSeeked = () => {
      if (queued !== null && queued !== requested) seek(queued);
    };

    const paint = (p: number) => {
      const intro = 1 - smoothstep(0.015, 0.12, p);
      gsap.set(introEl, { autoAlpha: intro, y: (1 - intro) * -20 });
      gsap.set(hintEl, { autoAlpha: 1 - smoothstep(0, 0.05, p) });
      gsap.set(washEl, { autoAlpha: smoothstep(WASH_START, 1, p) });
      gsap.set(barEl, { scaleX: p });
      gsap.set(el, { objectPosition: objectPosition(focusAt(portrait.matches ? focus.portrait : focus.landscape, p)) });
      const tone = p >= 0.975 ? "light" : "dark";
      if (section.dataset.tone !== tone) {
        section.dataset.tone = tone;
        window.dispatchEvent(new Event(heroToneEvent));
      }
      if (loaded && duration > 0) {
        const frame = 1 / video.fps;
        // Stop just short of the end: some decoders show a blank frame at exactly `duration`.
        const time = Math.min(duration - frame / 2, (clamp01(p / VIDEO_END) * duration));
        if (Math.abs(time - requested) >= frame / 2) seek(Math.round(time / frame) * frame);
      }
    };

    // Runs only while the displayed position is catching up with the scroll.
    const tick = (now: number) => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
      last = now;
      shown += (target - shown) * (1 - Math.exp(-dt / SMOOTHING));
      if (Math.abs(target - shown) < 0.0005) shown = target;
      paint(shown);
      raf = shown === target ? 0 : requestAnimationFrame(tick);
      if (!raf) last = 0;
    };

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        target = self.progress;
        if (!raf) raf = requestAnimationFrame(tick);
      },
    });
    target = shown = trigger.progress;
    paint(shown);

    el.addEventListener("seeked", onSeeked);
    el.addEventListener("error", fail);
    el.addEventListener(
      "loadedmetadata",
      () => {
        duration = Number.isFinite(el.duration) ? el.duration : 0;
        if (duration <= 0) fail();
      },
      { once: true },
    );
    el.addEventListener(
      "loadeddata",
      () => {
        if (disposed) return;
        loaded = true;
        requested = -1;
        paint(shown);
        el.addEventListener("seeked", () => !disposed && setReady(true), { once: true });
      },
      { once: true },
    );

    download(src).then(
      (blob) => {
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        el.src = objectUrl;
        el.load();
      },
      fail,
    );

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      trigger.kill();
      el.removeEventListener("seeked", onSeeked);
      el.removeEventListener("error", fail);
      // Release the decoder and the blob.
      el.removeAttribute("src");
      el.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      delete section.dataset.tone;
      window.dispatchEvent(new Event(heroToneEvent));
      setReady(false);
    };
  }, [scrub, video, focus]);

  // The first frame by default; reduced-motion visitors get a frame from the haircut instead.
  const common = { fill: true, sizes: "100vw", placeholder: "blur" } as const;
  const stillSet = getImageProps({ ...common, alt: stillAlt, src: still }).props.srcSet;
  const { props: posterProps } = getImageProps({ ...common, alt: posterAlt, src: poster, loading: "eager", fetchPriority: "high" });
  const posterFocus = objectPosition(focusAt(focus.landscape, 0));

  return (
    <section
      ref={root}
      data-home-hero=""
      data-mode={mode}
      data-ready={ready ? "true" : undefined}
      className={cn("relative bg-ink text-canvas", scrub && "h-[380svh] md:h-[420svh]")}
    >
      <div className="sticky top-0 isolate h-svh min-h-[34rem] overflow-hidden">
        <div aria-hidden={scrub && ready} className={cn("absolute inset-0 -z-20", scrub && ready && "invisible")}>
          <picture>
            <source media="(prefers-reduced-motion: reduce)" srcSet={stillSet} sizes="100vw" />
            {/* eslint-disable-next-line jsx-a11y/alt-text -- props (incl. alt) come from getImageProps */}
            <img {...posterProps} className="object-cover" style={{ ...posterProps.style, objectPosition: posterFocus }} />
          </picture>
        </div>

        {scrub && (
          <video
            ref={videoRef}
            muted
            playsInline
            preload="metadata"
            disablePictureInPicture
            disableRemotePlayback
            aria-hidden
            tabIndex={-1}
            className={cn("absolute inset-0 -z-10 size-full object-cover opacity-0", ready && "opacity-100")}
            style={{ objectPosition: posterFocus }}
          />
        )}

        {/* Legibility: a low scrim under the copy and a light one under the header. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-3/5 bg-[linear-gradient(0deg,rgb(18_18_17/0.72),rgb(18_18_17/0.2)_60%,transparent)]" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-[linear-gradient(180deg,rgb(18_18_17/0.5),transparent)]" />

        <div data-intro="" className="absolute inset-x-0 bottom-20 sm:bottom-24">
          {intro}
        </div>

        {scrub && (
          // Phones stack both buttons where the hint would sit; the progress rule shows the scroll there.
          <div data-hint="" aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[4.5rem] hidden justify-center sm:flex">
            <span className="flex flex-col items-center gap-2 text-[0.75rem] text-canvas/70">
              {scrollHint}
              <span className="relative block h-8 w-px overflow-hidden bg-canvas/25">
                <span className="absolute inset-x-0 top-0 h-1/2 animate-[scroll-cue_1.8s_var(--ease-emphasis)_infinite] bg-canvas motion-reduce:animate-none" />
              </span>
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto w-full max-w-page px-4 sm:px-6 lg:px-10 xl:px-12">
            <div className="relative flex items-center justify-between gap-4 border-t border-line-inverse py-3 text-xs leading-snug text-canvas/65">
              <span aria-hidden data-progress="" className={cn("absolute -top-px left-0 h-px w-full origin-left bg-accent-soft [transform:scaleX(0)]", !scrub && "hidden")} />
              <div className="min-w-0">{footer}</div>
              <div className="flex shrink-0 items-center gap-5">
                {scrub && (
                  <a href={`#${afterId}`} className="link-draw hidden text-[0.8125rem] font-medium text-canvas/80 hover:text-canvas sm:inline">
                    {skipLabel}
                  </a>
                )}
                {bookCta}
              </div>
            </div>
          </div>
        </div>

        {/* Hand-over to the light sections below. */}
        <div aria-hidden data-wash="" className="pointer-events-none invisible absolute inset-0 z-10 bg-canvas opacity-0" />
      </div>
    </section>
  );
}
