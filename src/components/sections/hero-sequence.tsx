"use client";

import Image from "next/image";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { HeroClip } from "@/content/types";
import { cn } from "@/lib/cn";
import { heroToneEvent } from "@/lib/events";
import { Container } from "@/components/ui/container";
import { PhotoFallback } from "@/components/media/photo";

interface Caption {
  label: string;
  line: string;
}

/*
 * Timeline layout, in timeline seconds (the scroll position maps onto these).
 * Each clip takes over from the previous one at `sceneStart[i]`.
 *   0.0–2.0  the doorway frame opens while the arrival clip tracks forward
 *   3.6      the chair     6.0  detail     8.1  finished cut
 *   9.9–10.6 the stage washes to paper and hands over to the next section
 */
const sceneStart = [0, 3.6, 6.0, 8.1];
const captionAt: [number, number | null][] = [
  [1.6, 3.2],
  [4.1, 5.6],
  [6.4, 7.8],
  [8.5, null],
];
const crossfade = 0.6;
const washAt = 9.9;
/** Start loading a clip this long (timeline seconds) before its scene. */
const preloadLead = 2.5;

/**
 * Scroll-controlled hero. The section is several viewports tall and its stage
 * is `position: sticky`, so the page scrolls natively (no pinning or scroll
 * hijacking); GSAP ScrollTrigger only maps that scroll position onto a
 * timeline. Without scripting or with reduced motion, the CSS `cinematic:`
 * variant never applies and the hero is a single still screen.
 */
export function HeroSequence({
  clips,
  captions,
  intro,
  finale,
  skipLabel,
  footageNote,
  afterId,
}: {
  clips: HeroClip[];
  captions: Caption[];
  intro: ReactNode;
  finale: ReactNode;
  skipLabel: string;
  footageNote: string;
  /** Id of the element right after the hero, for the skip link. */
  afterId: string;
}) {
  const root = useRef<HTMLElement>(null);
  const count = clips.length;

  useEffect(() => {
    const section = root.current;
    if (!section || count === 0) return;
    gsap.registerPlugin(ScrollTrigger);
    // Mobile address-bar show/hide must not re-measure: the stage uses svh units.
    ScrollTrigger.config({ ignoreMobileResize: true });

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(section);
      const layers = q("[data-layer]");
      const media = q("[data-media]");
      const captionEls = q("[data-caption]");
      const ticks = q("[data-tick]");
      const videos = layers.map((l) => l.querySelector("video"));
      const scrub = clips.map(() => ({ t: 0 }));
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      const saveData = Boolean(connection?.saveData) || matchMedia("(prefers-reduced-data: reduce)").matches;

      let active = -1;
      let inView = true;
      let raf = 0;

      const load = (i: number) => {
        const video = videos[i];
        if (!video || saveData || video.dataset.state) return;
        video.dataset.state = "loading";
        video.muted = true;
        video.preload = "auto";
        video.load();
        // iOS Safari only decodes seekable frames after playback has started once.
        if (clips[i].playback === "scrub") {
          video.play().then(() => video.pause(), () => {});
        }
      };

      // Loop clips play only while their scene is on screen; scrub clips never play.
      const syncPlayback = () => {
        clips.forEach((clip, i) => {
          const video = videos[i];
          if (!video || clip.playback !== "loop") return;
          if (inView && i === active && video.dataset.state === "ready") {
            video.play().catch(() => {});
          } else if (!video.paused) {
            video.pause();
          }
        });
      };

      const cleanups = videos.map((video) => {
        if (!video) return () => {};
        const ready = () => {
          if (video.dataset.state !== "failed") video.dataset.state = "ready";
          syncPlayback();
        };
        // Capture phase also catches errors fired on child <source> elements.
        const fail = () => {
          video.dataset.state = "failed";
          video.pause();
        };
        video.addEventListener("loadeddata", ready);
        video.addEventListener("error", fail, true);
        return () => {
          video.removeEventListener("loadeddata", ready);
          video.removeEventListener("error", fail, true);
          video.pause();
        };
      });

      // Seek scrub clips toward the scroll position, one seek in flight at a time.
      const tick = () => {
        raf = requestAnimationFrame(tick);
        clips.forEach((clip, i) => {
          const video = videos[i];
          if (clip.playback !== "scrub" || !video || Math.abs(i - active) > 1) return;
          if (video.readyState < 2 || video.seeking || !video.duration) return;
          const target = scrub[i].t * (video.duration - 0.05);
          if (Math.abs(video.currentTime - target) > 1 / 48) video.currentTime = target;
        });
      };
      const startTicking = () => {
        if (!raf) raf = requestAnimationFrame(tick);
      };
      const stopTicking = () => {
        cancelAnimationFrame(raf);
        raf = 0;
      };

      const onTime = (time: number) => {
        let next = 0;
        sceneStart.forEach((start, i) => {
          if (time >= start) next = i;
          if (time >= start - preloadLead) load(i);
        });
        if (next !== active) {
          active = next;
          ticks.forEach((t, i) => (t.dataset.active = String(i === active)));
          syncPlayback();
        }
        // Lets the header switch back to its solid style as the stage turns to paper.
        const tone = time >= washAt + 0.3 ? "light" : "dark";
        if (section.dataset.tone !== tone) {
          section.dataset.tone = tone;
          window.dispatchEvent(new Event(heroToneEvent));
        }
      };

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6,
        },
        onUpdate: () => onTime(tl.time()),
      });

      // Arrival: the doorway frame opens while the camera tracks into the room.
      tl.to(q("[data-door='top']"), { yPercent: -100, duration: 2 }, 0)
        .to(q("[data-door='left']"), { xPercent: -100, duration: 2 }, 0)
        .to(q("[data-door='right']"), { xPercent: 100, duration: 2 }, 0)
        .fromTo(q("[data-sheen]"), { xPercent: -110 }, { xPercent: 260, duration: 2.6, ease: "power1.inOut" }, 0)
        .fromTo(media[0], { scale: 1.14 }, { scale: 1, duration: sceneStart[1] + crossfade }, 0)
        .to(q("[data-intro]"), { autoAlpha: 0, y: -40, duration: 1.2, ease: "power1.in" }, 0.3)
        .to(scrub[0], { t: 1, duration: sceneStart[1] + crossfade }, 0)
        .fromTo(q("[data-progress]"), { scaleX: 0 }, { scaleX: 1, duration: washAt }, 0);

      // Each later clip fades in over the last, with a slow change of scale for depth.
      const depth: [number, number][] = [
        [1.14, 1],
        [1.1, 1],
        [1.03, 1.12], // detail pushes in rather than settling
        [1.08, 1],
      ];
      for (let i = 1; i < count; i++) {
        const at = sceneStart[i];
        const end = sceneStart[i + 1] ?? washAt;
        tl.fromTo(layers[i], { autoAlpha: 0 }, { autoAlpha: 1, duration: crossfade, ease: "power1.inOut" }, at)
          .set(layers[i - 1], { autoAlpha: 0 }, at + crossfade)
          .fromTo(media[i], { scale: depth[i][0] }, { scale: depth[i][1], duration: end - at + crossfade }, at);
        if (clips[i].playback === "scrub") tl.to(scrub[i], { t: 1, duration: end - at }, at);
      }

      captionEls.forEach((el, i) => {
        const [inAt, outAt] = captionAt[i] ?? [];
        if (inAt === undefined) return;
        tl.fromTo(el, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" }, inAt);
        if (outAt !== null) tl.to(el, { autoAlpha: 0, y: -18, duration: 0.4, ease: "power1.in" }, outAt);
      });

      tl.to(q("[data-wash]"), { autoAlpha: 1, duration: 0.7, ease: "power1.inOut" }, washAt);

      const observer = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        if (inView) startTicking();
        else stopTicking();
        syncPlayback();
      });
      observer.observe(section);

      const onVisibility = () => {
        inView = document.visibilityState === "visible" && section.getBoundingClientRect().bottom > 0;
        syncPlayback();
      };
      document.addEventListener("visibilitychange", onVisibility);

      onTime(tl.time());
      startTicking();

      return () => {
        stopTicking();
        observer.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        cleanups.forEach((fn) => fn());
        delete section.dataset.tone;
        window.dispatchEvent(new Event(heroToneEvent));
      };
    });

    return () => mm.revert();
  }, [clips, count]);

  return (
    <section
      ref={root}
      data-home-hero=""
      className="relative bg-ink text-paper cinematic:h-[440svh] md:cinematic:h-[560svh]"
    >
      <div className="sticky top-0 isolate flex h-svh min-h-[36rem] flex-col overflow-hidden">
        {/* Footage layers, stacked in scroll order. */}
        <div className="absolute inset-0 -z-10">
          {clips.map((clip, i) => (
            <div
              key={clip.id}
              data-layer=""
              className={cn("absolute inset-0", i > 0 && "hidden cinematic:invisible cinematic:block")}
              style={{ "--focus-l": clip.focus.landscape, "--focus-p": clip.focus.portrait } as CSSProperties}
            >
              <div
                data-media=""
                className={cn("absolute inset-0 will-change-transform", i === 0 && "cinematic:[transform:scale(1.14)]")}
              >
                {clip.poster ? (
                  <Image
                    src={clip.poster}
                    alt={clip.alt}
                    fill
                    sizes="100vw"
                    placeholder={typeof clip.poster === "object" ? "blur" : "empty"}
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : undefined}
                    className="object-cover [object-position:var(--focus-p)] landscape:[object-position:var(--focus-l)]"
                  />
                ) : (
                  <PhotoFallback label={clip.alt} />
                )}
                {clip.sources.length > 0 && (
                  <video
                    aria-hidden
                    tabIndex={-1}
                    muted
                    playsInline
                    loop={clip.playback === "loop"}
                    preload="none"
                    disablePictureInPicture
                    className="absolute inset-0 hidden size-full object-cover opacity-0 transition-opacity duration-700 ease-soft [object-position:var(--focus-p)] landscape:[object-position:var(--focus-l)] cinematic:block data-[state=ready]:opacity-100"
                  >
                    {clip.sources.map((s) => (
                      <source key={s.src} src={s.src} type={s.type} />
                    ))}
                  </video>
                )}
              </div>
            </div>
          ))}

          {/* Shared grade: warm tint, vignette and a static grain so every clip reads as one film. */}
          <div aria-hidden className="absolute inset-0 bg-brass/15 mix-blend-soft-light" />
          <div
            aria-hidden
            className="absolute inset-0 bg-[radial-gradient(120%_85%_at_50%_45%,transparent_40%,rgb(22_21_19/0.55)_100%)]"
          />
          <div aria-hidden className="film-grain absolute inset-0 opacity-[0.07] mix-blend-overlay" />
          {/* A soft reflection that crosses the doorway glass as it opens. */}
          <div
            aria-hidden
            data-sheen=""
            className="absolute inset-y-0 left-0 hidden w-[45%] [transform:translateX(-110%)] bg-[linear-gradient(100deg,transparent_10%,rgb(243_239_231/0.09)_45%,rgb(243_239_231/0.03)_60%,transparent_85%)] cinematic:block"
          />
          {/* Legibility scrims for the header and the copy. */}
          <div aria-hidden className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgb(22_21_19/0.6),transparent)]" />
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(90deg,rgb(22_21_19/0.6)_0%,rgb(22_21_19/0.15)_55%,transparent_100%)]"
          />
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-[linear-gradient(0deg,rgb(22_21_19/0.85),transparent)]" />

          {/* The doorway: ink lintel and jambs that part as the visitor steps in. */}
          <div aria-hidden className="hidden cinematic:block">
            <div data-door="top" className="absolute inset-x-0 top-0 h-[calc(var(--spacing-header)+1rem)] bg-ink" />
            <div
              data-door="left"
              className="absolute inset-y-0 left-0 w-4 border-r border-brass/25 bg-ink sm:w-[5vw] lg:w-[7vw]"
            />
            <div
              data-door="right"
              className="absolute inset-y-0 right-0 w-4 border-l border-brass/25 bg-ink sm:w-[5vw] lg:w-[7vw]"
            />
          </div>
        </div>

        <div data-intro="" className="relative mt-auto">
          {intro}
        </div>

        {captions.slice(0, count).map((c, i) => (
          <Container
            key={c.label}
            data-caption=""
            className="absolute inset-x-0 bottom-20 hidden cinematic:invisible cinematic:block sm:bottom-24"
          >
            <p className="eyebrow tabular text-brass-soft">
              {String(i + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
              <span className="mx-3 inline-block h-px w-8 bg-brass-soft/60 align-middle" aria-hidden />
              {c.label}
            </p>
            <p className="mt-5 max-w-3xl text-display-md font-medium text-balance">{c.line}</p>
            {i === count - 1 && <div className="mt-8">{finale}</div>}
          </Container>
        ))}

        {/* Scene index (desktop). */}
        <ol aria-hidden className="absolute right-[calc(7vw+2rem)] top-1/2 hidden -translate-y-1/2 flex-col gap-4 lg:cinematic:flex">
          {captions.slice(0, count).map((c, i) => (
            <li
              key={c.label}
              data-tick=""
              data-active={i === 0 ? "true" : "false"}
              className="group flex items-center justify-end gap-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-paper/40 transition-colors duration-500 data-[active=true]:text-paper"
            >
              <span className="opacity-0 transition-opacity duration-500 group-data-[active=true]:opacity-100">{c.label}</span>
              <span className="tabular">{String(i + 1).padStart(2, "0")}</span>
              <span className="h-px w-4 bg-current transition-[width] duration-500 group-data-[active=true]:w-8" />
            </li>
          ))}
        </ol>

        <Container className="relative">
          <div className="relative flex items-center justify-between gap-6 border-t border-line-inverse py-4 text-[0.6875rem] leading-snug text-paper/55">
            <span aria-hidden data-progress="" className="absolute -top-px left-0 hidden h-px w-full origin-left [transform:scaleX(0)] bg-brass-soft cinematic:block" />
            <p>{footageNote}</p>
            <a
              href={`#${afterId}`}
              className="hidden shrink-0 font-semibold uppercase tracking-[0.18em] text-paper/70 underline-offset-4 hover:text-paper hover:underline cinematic:inline"
            >
              {skipLabel}
            </a>
          </div>
        </Container>

        {/* Hand-over to the paper sections below. */}
        <div aria-hidden data-wash="" className="pointer-events-none invisible absolute inset-0 z-10 bg-paper opacity-0" />
      </div>
    </section>
  );
}
