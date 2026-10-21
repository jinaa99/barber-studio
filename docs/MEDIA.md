# Media sources and licences

Every asset shipped with the demo, where it came from and what was changed.
Records in `src/content/media.ts` carry the same information for the UI
(gallery credits).

## Photography: Unsplash

The stills in `src/assets/media/studio-*.jpg` and `work-*.jpg` are used under the
[Unsplash License](https://unsplash.com/license). Author and source URL per
image are in `mediaRecords` (`src/content/media.ts`).

## Home hero footage: Mixkit

Downloaded 2026-10-21 from each clip's Mixkit page (720p MP4). Each page's
structured data lists `https://mixkit.co/license/#videoFree`, the
**Mixkit Stock Video Free License** (not the "Restricted" licence). Mixkit
describes this licence as allowing commercial use without attribution. We
credit the clips anyway.

> **Before launch:** the licence text loads in a script-driven modal and could
> not be archived automatically. Open the licence page, confirm the terms for
> the intended use (a client's commercial website) and keep a copy with the
> project records.

All four clips are from one Mixkit shoot: the same room, barber and client.
The sequence uses them in the order they show (room → cutting → detail →
finished cut). They are joined with cross-dissolves and are not presented as
one continuous take. The only continuous camera move is the arrival clip, which
the page scrubs frame by frame.

| Scene | Mixkit clip | Clip ID | Used | Changes |
| --- | --- | --- | --- | --- |
| Arrival | [Male Barber Chairs](https://mixkit.co/free-stock-video/male-barber-chairs-43236/) | 43236 | 0–8 s | Cropped to 1104×621 from the left edge to keep the shop's wall sign out of frame, scaled to 1280×720 |
| The chair | [Barber cutting the hair of a bearded man](https://mixkit.co/free-stock-video/barber-cutting-the-hair-of-a-bearded-man-43222/) | 43222 | 0–8 s | none beyond the shared steps |
| Detail | [Barber cutting hair with scissors and comb](https://mixkit.co/free-stock-video/barber-cutting-hair-with-scissors-and-comb-43232/) | 43232 | 0–5 s | none beyond the shared steps |
| Finish | [Barber combing his client's hair](https://mixkit.co/free-stock-video/barber-combing-his-clients-hair-43238/) | 43238 | 7.4 s–end | Uses only the tail, after the barber's branded apron leaves the frame |

Shared steps for every clip: audio removed; colour graded to the site palette
(`eq=contrast=1.05:saturation=0.82:gamma=0.97` plus a warm `colorbalance`);
H.264 High, yuv420p, `+faststart`. Scrubbed clips (arrival, finish) use a
4-frame keyframe interval with no B-frames so seeking stays responsive. Looping
clips use a 2 s GOP. Posters (`src/assets/media/hero-*.jpg`) are frame 0 of
each encoded file, so the poster and the video match exactly.

The original shoot shows a real barbershop's branding: capes, aprons and a
wall sign. Clips where it is legible were left out, including "Barber showing
the haircut to his client" (43233), or trimmed and cropped as noted above.
Before launch, check the frames again in the context they'll be used.

Files: `public/media/hero/hero-{entry,craft,detail,result}.mp4`, about 4.7 MB in
total (entry 2.2 MB, the others about 0.75–0.95 MB each).

## Replacing the footage

Edit `heroClipRecords` in `src/content/media.ts`:

- `sources`: one or more `{ src, type }`. An empty array runs the sequence on
  posters alone.
- `playback`: `"scrub"` (follows the scroll; encode with a short keyframe
  interval) or `"loop"` (plays while its scene is on screen).
- `poster`: a static import. Use frame 0 of the clip.
- `focus`: `object-position` for landscape and portrait screens.
- `credit`: source, licence and what was edited.

Phase 03 can serve these records from the database or admin media library
without changing the hero component, because it only reads `getHeroClips()`.
