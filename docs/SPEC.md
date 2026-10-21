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
| `/[locale]/booking` | Booking flow (frontend demo) |
| `/[locale]/visit` | Address, directions, opening hours, contact, socials, map link |

## Booking flow (Phase 01: frontend demo)

1. Choose a service.
2. Choose a barber, or "any available barber". Barbers who don't offer the service are disabled.
3. Choose a date (14 days ahead; closed days disabled) and view example time slots.
4. Enter details: name and phone required, email and notes optional, with validation.
5. Review the selection, with an edit link for each row.
6. See a confirmation screen that clearly says it's a demo and that nothing was saved.

Deep links: `/booking?service=<id>` and `/booking?barber=<id>`.
The UI is isolated from its data source by the `BookingProvider` interface.
Phase 03 implements the real backend.

## Content honesty

- Business name, address, phone, email and social handles are placeholders and labelled as demo.
- Testimonials are sample placeholders, visibly labelled. Real reviews require consent and verification.
- Photography is Unsplash-licensed stock with credits listed on the gallery
  page. It doesn't show this studio's work or the named (fictional) barbers.
- Hero footage is Mixkit stock (Stock Video Free License), labelled as demo
  footage in the hero and credited on the gallery page. See docs/MEDIA.md.

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
- **Phase 03:** real booking backend (persistence, availability, notifications) and database-backed content.
