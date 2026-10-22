# Project specification — Barber Studio Website

## Purpose

A premium barber studio website, built first as a portfolio demo under the
replaceable brand **STUDIO / 08**, and designed to be re-skinned and sold to
real barber shops. Brand, business details, content and imagery must be easy to swap.

## Visual direction

- Minimal editorial layout with cinematic realism: high-quality photography (video in Phase 02).
- Subtle, purposeful motion only.
- Palette: neutral paper, ink, sand, taupe and muted brass.
- Generous whitespace and tightly controlled typography: Manrope, with Cormorant Garamond for display accents (both Cyrillic-compatible).
- Minimal, consistent Lucide icons.
- Avoid: generic AI-looking layouts, excessive cards, glowing gradients and unnecessary glassmorphism.

## Languages

- Mongolian (default) and English across all public content, navigation,
  forms, messages and metadata.
- URLs are locale-prefixed (`/mn/...`, `/en/...`). `/` redirects to the last
  chosen language, or Mongolian.
- The language switcher keeps the current page, query, hash and scroll
  position. Booking progress survives a language switch.

## Public routes

| Route | Content |
| --- | --- |
| `/[locale]` | Home: navigation, full-bleed hero, brand statement, studio intro and philosophy, signature services, barbers, selected work, testimonials (sample), location/hours/socials, final booking CTA, footer |
| `/[locale]/services` | Services and pricing by category, inclusions, policies |
| `/[locale]/barbers` | Barber profiles: role, bio, specialties, services offered, book-with link |
| `/[locale]/gallery` | Our Work gallery and photo credits |
| `/[locale]/booking` | Booking flow (live, database-backed) |
| `/[locale]/admin/*` | Staff dashboard (sign-in required, not indexed): see [ADMIN.md](ADMIN.md) |
| `/[locale]/visit` | Address, directions, opening hours, contact, socials, map link |

## Booking flow

1. Choose an active service.
2. Choose a barber, or "any available barber". Barbers who don't offer the service are disabled.
3. Choose a date (within the booking horizon; days nobody works are disabled) and a time
   from server-side availability, based on working hours, breaks, time off and
   existing appointments in Asia/Ulaanbaatar time.
4. Enter details: name and phone required, email and notes optional. Validated in the browser and again on the server.
5. Review the selection, with an edit link for each row.
6. Submit. The server re-checks availability under a lock and saves the appointment,
   then shows the booking reference, the status (confirmed or pending) and whether a
   confirmation email was actually sent.

Deep links: `/booking?service=<id>` and `/booking?barber=<id>`. Guests book without
an account. The UI talks to the server only through the `BookingProvider` interface.
Details: [BOOKING.md](BOOKING.md).

## Content honesty

- Business name, address, phone, email and social handles are placeholders and labelled as demo.
- Bookings are real records. While `site.isDemo` is true, the booking page says the studio is a placeholder.
- Seeded sample appointments and customers are flagged `isDemo` and kept apart from real ones.
- A confirmation email is only reported as sent when the provider accepted it.
- Testimonials are sample placeholders, visibly labelled. Real reviews require consent and verification.
- Photography is Unsplash-licensed stock with credits listed on the gallery
  page. It doesn't show this studio's work or the named (fictional) barbers.
- Hero footage is Mixkit stock (Stock Video Free License), labelled as demo
  footage in the hero and credited on the gallery page. See docs/MEDIA.md.
- Media added from Pexels or Pixabay keeps the creator, source page and licence the
  provider reported; it is credited on the gallery page, and stock footage in the hero is
  labelled with its provider. Nothing about a source is invented.

## Engineering

- Next.js App Router, TypeScript, Tailwind CSS v4; server components by default.
- Shared design tokens, layout components, and a typed demo-data layer behind async getters.
- Responsive and accessible: semantic landmarks, skip link, focus management in
  the booking flow, reduced-motion support, no horizontal overflow at 390px.

## Roadmap

- **Phase 02 (done):** scroll-controlled cinematic hero with licensed video. The page scrolls
  natively past a sticky stage, and GSAP ScrollTrigger maps the scroll onto a timeline:
  doorway → arrival (scrubbed) → the chair → detail → finish (scrubbed) → paper hand-over.
  With reduced motion or without JS, the hero is a single still screen.
- **Phase 03 (done):** PostgreSQL + Prisma, database-backed content, server-side availability,
  conflict-safe booking (row locks + exclusion constraint), staff sign-in with roles,
  status lifecycle, audit log, email notifications with recorded delivery status, seed and tests.
- **Phase 04 (done):** the full staff dashboard: overview, calendar (day/week/list) with
  staff booking and rescheduling under the same conflict protections, barbers, schedules
  and time off, services and categories, customers, analytics with defined metrics,
  website content and booking rules, staff accounts with ADMIN/STAFF/BARBER permissions,
  activity log. See [ADMIN.md](ADMIN.md).
- **Phase 05 (done):** media library: Pexels/Pixabay search and saving, uploads, drafts and
  publishing, and database-backed media for the hero scenes, page photos, gallery and barber
  photos, each falling back to the bundled media. See [MEDIA.md](MEDIA.md).
- **Phase 06 (done):** Facebook Page and Instagram professional account connections in the
  dashboard: official OAuth, encrypted server-side tokens, accurate connection states,
  reconnect/disconnect, and read-only insights where Meta's permissions allow. Nothing is
  posted and nothing from these accounts reaches the public site. See [SOCIAL.md](SOCIAL.md).
