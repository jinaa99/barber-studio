# STUDIO / 08 — Barber Studio Website

A bilingual (Mongolian / English) premium barber studio site. It's a portfolio
demo, built so a real shop's brand can replace it.

- Product spec: [docs/SPEC.md](docs/SPEC.md)
- Conventions for contributors and agents: [CLAUDE.md](CLAUDE.md)

## Getting started

```bash
npm install
cp .env.example .env.local   # optional: set NEXT_PUBLIC_SITE_URL
npm run dev                  # http://localhost:3000 → redirects to /mn
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types and run `tsc --noEmit` |
| `npm run build` / `npm start` | Production build and server |

## Customising for a studio

1. **Brand and business details:** `src/content/site.ts` (name, wordmark, address, phone, hours, socials). Set `isDemo: false` when the details are real.
2. **Services, barbers, gallery, testimonials:** `src/content/demo/*` (later replaced by database queries in `src/lib/data.ts`).
3. **Copy:** `src/i18n/dictionaries/mn.ts` and `en.ts`.
4. **Photography:** add files to `src/assets/media/` and register them, with localized alt text and credit, in `src/content/media.ts`.
5. **Look and feel:** the design tokens in `src/app/globals.css`.

## Photo credits

Demo photography comes from Unsplash and is used under the
[Unsplash License](https://unsplash.com/license). Every image's photographer
and source page are listed in `src/content/media.ts` and on the gallery page.
# barber-studio
