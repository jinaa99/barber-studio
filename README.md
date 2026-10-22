# STUDIO / 08 — Barber Studio Website

A bilingual (Mongolian / English) premium barber studio site. It's a portfolio
demo, built so a real shop's brand can replace it.

- Product spec: [docs/SPEC.md](docs/SPEC.md)
- Conventions for contributors and agents: [CLAUDE.md](CLAUDE.md)

## Getting started

Requires Node 20.19+ and PostgreSQL 14+. Booking backend details: [docs/BOOKING.md](docs/BOOKING.md).

```bash
npm install
cp .env.example .env.local   # set DATABASE_URL (and TEST_DATABASE_URL)
npm run db:local             # optional: local PostgreSQL if you don't have one
npm run db:deploy            # apply migrations
npm run db:seed              # demo services, barbers, hours and sample appointments
npm run admin:create         # first staff account
npm run dev                  # http://localhost:3000 → redirects to /mn; staff: /mn/admin
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate Prisma client and route types, then `tsc --noEmit` |
| `npm test` | Unit tests |
| `npm run test:integration` | Database tests (needs `TEST_DATABASE_URL`) |
| `npm run build` / `npm start` | Production build (needs the database) and server |
| `npm run social:check` | Daily: refresh and check Facebook/Instagram connections |
| `npm run notifications:retry` | Retry failed or skipped confirmation emails |

**Deploying:** host requirements, environment variables, proxy settings, backups, free-tier
limits and what has been verified are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Every
variable is listed in `.env.example`. Email, stock search and Meta connections are optional
and need their own credentials.

## Customising for a studio

1. **Brand and business details:** `src/content/site.ts` (name, wordmark, address, phone, hours, socials). Set `isDemo: false` when the details are real.
2. **Services, barbers, schedules, reviews, booking rules:** stored in PostgreSQL. `src/content/demo/*` is the seed's source data; the gallery still ships with the app.
3. **Copy:** `src/i18n/dictionaries/mn.ts` and `en.ts`.
4. **Photography:** add files to `src/assets/media/` and register them, with localized alt text and credit, in `src/content/media.ts`.
5. **Look and feel:** the design tokens in `src/app/globals.css`.

## Photo credits

Demo photography comes from Unsplash and is used under the
[Unsplash License](https://unsplash.com/license). Every image's photographer
and source page are listed in `src/content/media.ts` and on the gallery page.
# barber-studio
