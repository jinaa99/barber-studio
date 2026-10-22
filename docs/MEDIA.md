# Media sources and licences

Every asset shipped with the demo, where it came from and what was changed.
Records in `src/content/media.ts` carry the same information for the UI
(gallery credits).

## Photography: Unsplash

The stills in `src/assets/media/studio-*.jpg` and `work-*.jpg` are used under the
[Unsplash License](https://unsplash.com/license). Author and source URL per
image are in `mediaRecords` (`src/content/media.ts`).

## Home hero: 3D walk-through (no third-party assets)

The home hero is a real-time three.js scene (`src/components/hero3d/`, camera
path and timing in `src/lib/hero/journey.ts`). Scroll moves a perspective
camera from the pavement outside the studio, through its hinged glass door,
into the shop and up to a haircut in close-up, then hands over to the page.

Everything in it is made in this repository, so there is no asset licence to
track:

| Part | Source | Licence |
| --- | --- | --- |
| Geometry: facade, shopfront, door, room, stations, chairs, figures, clipper | Built in code from three.js primitives (`storefront.tsx`, `interior.tsx`, `figures.tsx`) | Project code |
| Textures: paving, terrazzo, plaster, oak, cladding, signage, hair density | Drawn on 2D canvases at runtime with a seeded generator (`textures.ts`) | Project code |
| Reflections | `RoomEnvironment` from three.js's examples, prefiltered once; mirrors use a one-off cube-camera capture of the scene | three.js, MIT |
| Signage text | The studio's own name and dictionary strings, set in Onest | Onest: SIL Open Font License 1.1 (via `next/font`) |
| Posters `src/assets/media/hero-storefront[-portrait]-{mn,en}.jpg` | Frame one of the scene, rendered from the site in headless Chrome (1920×1080 and 1080×2340), one pair per language because the sign is localized | Project output |
| Libraries | `three` 0.186.1, `@react-three/fiber` 9.8.2 | MIT |

**People.** No realistic, animated barber or customer model with terms
confirmed to allow redistribution in a public website bundle was sourced for
this phase. Free CC0 character packs are stylized low-poly, and the usual
sources of realistic rigged characters attach conditions to redistributing the
model files themselves; their current terms were not re-verified, so check
them before adopting one. Rather than ship an unverified or mismatched model,
the barber and customer are deliberate
sculptural figures (matte plaster, archviz style), with real 3D geometry,
two-bone IK arms and a clipper that works along the fade. The haircut uses
stacked hair shells whose density thins into a skin fade. Replacing them with
licensed models later only touches `figures.tsx`.

**Honesty.** The hero says it is an illustration (`home.hero.sceneNote`):
it is a rendering, not a photograph of the studio.

**Regenerating the posters.** After changing the scene's opening frame,
render frame one again at both sizes with the copy, header and scrims hidden,
for each language, and save over the four files (JPEG, quality ~82). The
poster is shown while the scene loads and is the whole hero when motion is
reduced, WebGL is unavailable or the device is constrained.

## Former home hero footage: Mixkit

The scroll-crossfade hero these clips were made for has been replaced by the
3D walk-through above. The clips stay bundled as the defaults of the
dashboard's Website → Home hero scenes, which are kept (and say they are not
shown on the site at the moment).

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

Staff replace hero footage in the dashboard (Website → Home hero scenes) with
media from the library, below. The bundled clips stay as each scene's default.
To change the bundled defaults themselves, edit `heroClipRecords` in
`src/content/media.ts`:

- `sources`: one or more `{ src, type }`. An empty array runs the sequence on
  posters alone.
- `playback`: `"scrub"` (follows the scroll; encode with a short keyframe
  interval) or `"loop"` (plays while its scene is on screen).
- `poster`: a static import. Use frame 0 of the clip.
- `focus`: `object-position` for landscape and portrait screens.
- `credit`: source, licence and what was edited.

## Media library (Phase 05)

Admins (`media.manage`) manage photos and videos at `/admin/media`:

- **Find stock media**: search Pexels or Pixabay (photos or videos, any/landscape/portrait),
  preview a result with its creator, source page and licence, confirm a short checklist and
  save it to the library.
- **Upload**: the studio's own photos and videos, or licensed ones with their licence named.
- **Saved media**: search and filter by type, status and source; open an item to edit its alt
  text and notes, publish or unpublish it, use it on the website, add it to the gallery,
  replace it everywhere, remove it from a place, or delete it.

Saved and uploaded items start as **drafts**. Only **published** items appear on the site,
and publishing requires alt text in Mongolian and English. Where media is used:

| Place | How it's chosen | Default |
| --- | --- | --- |
| Hero scenes (arrival, chair, detail, finish), not shown while the 3D hero is in use | Website → Home hero scenes: a still, a video, a focal point | the bundled Mixkit clip |
| Studio introduction, home visit section, services page photo, visit page photo | Website → Page photos | the bundled photo |
| Gallery | Media item → Add to gallery (caption, shape, barber); order and visibility on Website → Gallery | the bundled gallery |
| Barber photos | Barbers → profile → Photo | the photo chosen at creation |

How it works:

- `media_assets` holds each item's file and metadata: provider and provider id, source page,
  creator name and link, licence name and link, the provider's description, dimensions,
  duration, file size and type, status, who saved it and when. Stock credits are stored as
  the provider's API returned them and can't be edited; nothing is filled in by guesswork
  (Pixabay, for example, gives a user name but no profile link, so none is stored).
- Every place stores a **media reference**: a bundled photo id or `asset:<id>`
  (`src/lib/media/refs.ts`). Page slots and the gallery are rows in `media_placements`
  (slots defined in `src/lib/media/slots.ts`); barber photos are `barbers.imageId`.
- The public site reads all of this through `lib/data.ts` (`getSlotMedia`, `getHeroClips`,
  `getGallery`, `getBarbers`, `getMediaCredits`), cached under the `media` tag. A missing or
  unpublished item falls back to the default, so the site never shows a broken frame.
- Hero scenes with library media play their video while the scene is on screen (`loop`).
  Frame-by-frame scrubbing stays reserved for the bundled clips, which were encoded with
  short keyframe intervals. A still alone works (the scene stays a still), and so does a
  video alone (its own poster frame is used). With reduced motion or no JavaScript the
  hero shows the first scene's still, as before.
- The gallery credits list every bundled photo and clip plus each library item in use,
  with its creator, provider or licence and a link to its source.

### Providers and their terms

Checked against the official pages on 2026-10-22. Re-check before launch; terms change.

| | Pexels | Pixabay |
| --- | --- | --- |
| API docs | https://www.pexels.com/api/documentation/ | https://pixabay.com/api/docs/ |
| Licence | [Pexels License](https://www.pexels.com/license/) | [Pixabay Content License](https://pixabay.com/service/license-summary/) ([full terms](https://pixabay.com/service/terms/)) |
| Rate limit | 200 requests/hour, 20,000/month (default) | 100 requests per 60 s per key |
| API requirements | Show a prominent link to Pexels; credit photographers when possible; don't replicate Pexels as a service | Show where results come from; cache requests for 24 hours; no automated bulk queries or mass downloads |
| Hotlinking | Not addressed in the API docs | Not allowed for images (search result URLs are temporary, valid 24 h); download to your own server |
| Licence limits | Free use and modification; attribution optional. Don't sell unaltered copies, imply endorsement by people or brands shown, show identifiable people in a bad light, redistribute on stock platforms, or use as a trademark | Free use and modification; attribution optional. No standalone sale or distribution, no misleading use, care with recognisable people and trademarks/logos, not as a trademark |

What the implementation does about it:

- **Files are downloaded when an item is saved**, and the site serves its own copy. Pixabay
  requires this for images; for Pexels the API docs don't grant permanent hotlinking, while
  the licence allows downloading and modifying. A local copy also keeps the site working if
  a provider URL changes or disappears. Search previews (thumbnails and short preview clips)
  load from the providers' CDNs while searching, which both allow.
- The search panel links to the provider ("Photos and videos provided by Pexels"), every
  saved item keeps its creator and source page, and the gallery credits name them.
- Search responses are cached in memory for 24 hours (Pixabay) or 1 hour (Pexels). A
  provider's 429 pauses requests to it until its window resets. Each admin is also limited
  to 40 searches a minute and 30 saves per 10 minutes.
- Before saving, the admin confirms a checklist: no legible third-party logos or signs,
  people shown appropriately and not implying endorsement, and stock media is never
  presented as the studio's own work (the site labels it, see `site.isDemo` and the hero
  footage note).
- Pinterest and design galleries are not providers: use them for inspiration only, never as
  a source of files.

Saved renditions: Pexels photos from the original file, Pixabay photos from `largeImageURL`
(at most 1280 px on the long edge, fine for profiles and the gallery, soft as a full-screen
hero). Videos: the largest MP4 rendition whose long edge is at most 1280 px (the hero's own
encoding size), plus the provider's poster frame.

### Storage

Files live in `MEDIA_STORAGE_DIR` (default `./storage/media`, git-ignored), outside `public/`,
and are served by `GET /api/media/<asset id>.<ext>`:

- The directory must be **writable, persistent and shared** by every server instance (for
  example a mounted volume). Serverless hosts without a persistent disk need a volume, or an
  object-storage driver behind the same small interface in `lib/server/media-storage.ts`.
  The dashboard says so when the folder isn't writable instead of failing on save.
- Back the folder up together with the database: rows without files show the fallback frame.
- `npm run build` doesn't need the folder; the app reads it at request time.

### Security

- `PEXELS_API_KEY` and `PIXABAY_API_KEY` are read only in `lib/server/stock-media.ts`. They
  never reach the browser, are never logged (Pixabay takes the key in the query string, so
  request URLs aren't logged either), and responses returned to the browser contain only
  normalized results.
- Search, save, upload and every library or placement change require `media.manage` (ADMIN),
  checked on the server in each Server Action and in the upload route.
- **No URLs from the browser.** Saving sends only provider, type and numeric id. The server
  looks the asset up again at the provider's API and downloads only `https` URLs on the
  provider's own media hosts (`images.pexels.com`, `videos.pexels.com`, `pixabay.com`,
  `cdn.pixabay.com`; default port, no credentials). Redirects are followed by hand, at most
  three, and each hop is checked again. Downloads have a 90 s timeout and a size cap
  (photos 25 MB, videos 80 MB); API calls time out after 10 s.
- **Types come from the bytes**, never from names or headers. Images (JPEG, PNG, WebP, AVIF)
  are decoded and re-encoded by sharp as JPEG: EXIF orientation applied, all metadata
  (location, camera, embedded profiles) dropped, at most 2560 px. SVG, HTML, GIF and anything
  else is refused. Videos must be MP4 (ISO base media) or WebM and are stored as received.
- Uploads go to `POST /api/admin/media/upload` (a route handler, so the large body limit
  applies to this endpoint only). It requires a same-origin request (`Origin` must match the
  host; the session cookie is also SameSite=Lax), a signed-in admin, a rights confirmation,
  and is rate-limited (30 per 10 minutes per user).
- File names are generated (`<asset id>.<ext>`). The file route only serves names that match
  that pattern **and** belong to an asset row; drafts are served only to admins. Responses
  carry a fixed `Content-Type`, `X-Content-Type-Options: nosniff`,
  `Content-Security-Policy: default-src 'none'; sandbox`, `Content-Disposition: inline` and
  `Cross-Origin-Resource-Policy: same-origin`, so a stored file can never run as a page.
