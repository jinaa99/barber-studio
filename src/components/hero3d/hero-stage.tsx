"use client";

import dynamic from "next/dynamic";
import { getImageProps, type StaticImageData } from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { overlayOpacity, washOpacity } from "@/lib/hero/journey";
import { heroToneEvent } from "@/lib/events";
import { cn } from "@/lib/cn";
import type { Quality, SceneLabels } from "./kit";
import type { Progress } from "./hero-scene";

// The WebGL scene (three.js + R3F) is its own chunk and never renders on the server.
const HeroScene = dynamic(() => import("./hero-scene"), { ssr: false });

type Mode = "pending" | "scene" | "still";

interface Capabilities {
  mode: Exclude<Mode, "pending">;
  quality: Quality;
}

function detect(): Capabilities {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  const saveData = Boolean(nav.connection?.saveData) || matchMedia("(prefers-reduced-data: reduce)").matches;
  const memory = nav.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  let webgl = false;
  try {
    const canvas = document.createElement("canvas");
    webgl = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    webgl = false;
  }
  const constrained = saveData || memory <= 2 || cores <= 2;
  const small = matchMedia("(max-width: 767px), (pointer: coarse)").matches;
  return {
    mode: reduce || !webgl || constrained ? "still" : "scene",
    quality: small || memory <= 4 || cores <= 4 ? "low" : "high",
  };
}

/*
 * Development only: `?heroBeat=exterior|approach|door|interior|barber|closeup`
 * (or a number 0–1) pins the camera to a beat, without scrolling, for
 * inspecting the scene. Production builds ignore the parameter.
 */
const debugBeats: Record<string, number> = { exterior: 0, approach: 0.19, door: 0.3, interior: 0.44, barber: 0.6, closeup: 0.84 };

function debugBeat(): number | null {
  if (process.env.NODE_ENV === "production") return null;
  const value = new URLSearchParams(window.location.search).get("heroBeat");
  if (value === null) return null;
  const p = value in debugBeats ? debugBeats[value] : Number(value);
  return Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : null;
}

let cached: Capabilities | null = null;
const subscribe = () => () => {};
const getSnapshot = () => (cached ??= detect());
const getServerSnapshot = () => null;

/**
 * The home hero's stage. Server-rendered with a still of the storefront and
 * the intro copy, so it is complete without JavaScript. In the browser it
 * becomes a tall scroll section with the 3D walk-through, unless motion is
 * reduced, WebGL is missing or the device is constrained: then it stays a
 * single still screen. A lost WebGL context falls back to the still as well.
 */
export function HeroStage({
  poster,
  posterPortrait,
  posterAlt,
  labels,
  intro,
  finale,
  sceneNote,
  skipLabel,
  afterId,
}: {
  poster: StaticImageData;
  posterPortrait: StaticImageData;
  posterAlt: string;
  labels: SceneLabels;
  intro: ReactNode;
  finale: ReactNode;
  sceneNote: string;
  skipLabel: string;
  afterId: string;
}) {
  const caps = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [lost, setLost] = useState(false);
  const mode: Mode = caps === null ? "pending" : lost ? "still" : caps.mode;
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);
  const [font, setFont] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const progress = useMemo<Progress>(() => ({ current: 0 }), []);
  const requestFrame = useRef<(() => void) | null>(null);

  // Signage is drawn with the page font, so wait for it before building the scene.
  useEffect(() => {
    if (mode !== "scene") return;
    let cancelled = false;
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-onest").trim() || "sans-serif";
    document.fonts.load(`600 64px ${family}`).finally(() => !cancelled && setFont(family));
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // Scroll → progress → overlays. The scene reads the same object every frame.
  useEffect(() => {
    const section = root.current;
    if (!section || mode !== "scene") return;
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    const q = gsap.utils.selector(section);
    const [introEl] = q("[data-intro]");
    const [finaleEl] = q("[data-finale]");
    const [washEl] = q("[data-wash]");
    const [barEl] = q("[data-progress]");

    const apply = () => {
      const p = progress.current;
      const o = overlayOpacity(p);
      gsap.set(introEl, { autoAlpha: o.intro, y: (1 - o.intro) * -24 });
      gsap.set(finaleEl, { autoAlpha: o.finale, y: (1 - o.finale) * 16 });
      gsap.set(washEl, { autoAlpha: washOpacity(p) });
      gsap.set(barEl, { scaleX: p });
      requestFrame.current?.();
      const tone = p >= 0.975 ? "light" : "dark";
      if (section.dataset.tone !== tone) {
        section.dataset.tone = tone;
        window.dispatchEvent(new Event(heroToneEvent));
      }
    };

    const beat = debugBeat();
    if (beat !== null) {
      gsap.set(progress, { current: beat });
      apply();
      return;
    }

    // Native scrolling; the tween only smooths progress (scrub) so the camera glides in both directions.
    const tween = gsap.to(progress, {
      current: 1,
      ease: "none",
      scrollTrigger: { trigger: section, start: "top top", end: "bottom bottom", scrub: 0.9 },
      onUpdate: apply,
    });
    apply();

    const observer = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting));
    observer.observe(section);
    return () => {
      observer.disconnect();
      tween.scrollTrigger?.kill();
      tween.kill();
      delete section.dataset.tone;
      window.dispatchEvent(new Event(heroToneEvent));
    };
  }, [mode, progress]);

  // One art-directed picture: the browser fetches only the poster it shows.
  const common = { alt: posterAlt, fill: true, sizes: "100vw", placeholder: "blur" } as const;
  const portraitSet = getImageProps({ ...common, src: posterPortrait }).props.srcSet;
  const { props: posterProps } = getImageProps({ ...common, src: poster, loading: "eager", fetchPriority: "high" });

  const onReady = useCallback(() => setReady(true), []);
  const onContextLost = useCallback(() => setLost(true), []);
  const onFrameRequester = useCallback((fn: () => void) => {
    requestFrame.current = fn;
  }, []);
  const scene = mode === "scene";

  return (
    <section
      ref={root}
      data-home-hero=""
      data-mode={mode}
      data-ready={ready ? "true" : undefined}
      className={cn("relative bg-ink text-canvas", scene && "h-[620svh] md:h-[700svh]")}
    >
      <div className="sticky top-0 isolate h-svh min-h-[34rem] overflow-hidden">
        {/* The still: frame one of the walk-through, rendered from the same scene. */}
        <div aria-hidden={scene && ready} className={cn("absolute inset-0 -z-20 transition-opacity duration-700", scene && ready && "opacity-0")}>
          <picture>
            <source media="(orientation: portrait)" srcSet={portraitSet} sizes="100vw" />
            {/* eslint-disable-next-line jsx-a11y/alt-text -- props (incl. alt) come from getImageProps */}
            <img {...posterProps} className="object-cover" />
          </picture>
        </div>

        {scene && font && caps && (
          <div className={cn("absolute inset-0 -z-10 opacity-0 transition-opacity duration-700", ready && "opacity-100")}>
            <HeroScene
              progress={progress}
              labels={labels}
              font={font}
              quality={caps.quality}
              active={active}
              onReady={onReady}
              onContextLost={onContextLost}
              onFrameRequester={onFrameRequester}
            />
          </div>
        )}

        {/* Legibility: a low scrim under the copy, nothing over the camera's path. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-[linear-gradient(0deg,rgb(18_18_17/0.78),rgb(18_18_17/0.25)_55%,transparent)]" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-[linear-gradient(180deg,rgb(18_18_17/0.55),transparent)]" />

        <div data-intro="" className="absolute inset-x-0 bottom-14 sm:bottom-16">
          {intro}
        </div>
        <div data-finale="" className={cn("absolute inset-x-0 bottom-14 sm:bottom-16", scene ? "invisible opacity-0" : "hidden")}>
          {finale}
        </div>

        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto w-full max-w-page px-4 sm:px-6 lg:px-10 xl:px-12">
            <div className="relative flex items-center justify-between gap-6 border-t border-line-inverse py-3.5 text-xs leading-snug text-canvas/65">
              <span aria-hidden data-progress="" className={cn("absolute -top-px left-0 h-px w-full origin-left bg-accent-soft [transform:scaleX(0)]", !scene && "hidden")} />
              <p>{sceneNote}</p>
              {scene && (
                <a href={`#${afterId}`} className="link-draw shrink-0 text-[0.8125rem] font-medium text-canvas/80 hover:text-canvas">
                  {skipLabel}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Hand-over to the light sections below. */}
        <div aria-hidden data-wash="" className="pointer-events-none invisible absolute inset-0 z-10 bg-canvas opacity-0" />
      </div>
    </section>
  );
}
