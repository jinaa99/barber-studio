# Deployment and operations (Phase 07)

How to run STUDIO / 08 in production, what it needs from the host, and what has and hasn't
been verified. Feature details live in [BOOKING.md](BOOKING.md), [ADMIN.md](ADMIN.md),
[MEDIA.md](MEDIA.md) and [SOCIAL.md](SOCIAL.md).

## What the host must provide

| Need | Why |
| --- | --- |
| Node.js 20.19+ running `next start` (a long-lived server process) | Server Actions, route handlers, in-memory rate limits and caches |
| PostgreSQL 14+ with the `btree_gist` extension | The `appointments_no_overlap` exclusion constraint (the final double-booking guard) |
| Database reachable **at build time** | `npm run build` prerenders the public pages from the database |
| A persistent, writable directory (`MEDIA_STORAGE_DIR`) | Media library uploads and saved stock media |
| HTTPS on the public domain | Secure `__Host-` session cookie, HSTS, Meta OAuth redirect URIs |
| A scheduler (cron) | `npm run social:check` daily; optionally `npm run notifications:retry` |

A single small VM or container host (with a volume) fits this best. Serverless platforms
without a persistent disk need a shared volume or an object-storage driver for
`lib/server/media-storage.ts`; several instances also need a shared rate limiter (see below).

## Environment variables

Copy `.env.example` (it lists every variable, with placeholders only). Set them in the host's
secret store in production rather than in a file.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string (build and runtime) |
| `NEXT_PUBLIC_SITE_URL` | yes in production | Public `https://` origin. Used for canonical/hreflang/Open Graph URLs, the sitemap and robots, and the Meta redirect URIs. It is inlined at build time: rebuild after changing it. Unset, everything points at `http://localhost:3000`. |
| `MEDIA_STORAGE_DIR` | recommended | Media library folder (default `./storage/media`) |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` | optional | Confirmation emails via Resend. Without them bookings still work and customers are told no email was sent. |
| `PEXELS_API_KEY`, `PIXABAY_API_KEY` | optional | Stock search in the media library |
| `META_APP_ID`, `META_APP_SECRET` | optional | Facebook Page connection |
| `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | optional | Instagram professional account connection |
| `SOCIAL_TOKEN_KEY` | with either Meta app | 32 random bytes, base64 (`openssl rand -base64 32`). Encrypts stored tokens; keep it with your secrets backup, losing it means reconnecting. |
| `META_LOGIN_CONFIG_ID`, `META_GRAPH_VERSION` | optional | See SOCIAL.md |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`, `ADMIN_ROLE` | one-off | Only for `npm run admin:create`; pass inline, don't store. Passwords need 12+ characters. |
| `TEST_DATABASE_URL` | tests only | Separate database whose name contains "test"; the tests empty it |
| `SEED_SAMPLE_APPOINTMENTS`, `SEED_ALLOW_PRODUCTION`, `LOCAL_DB_PORT` | optional | Seed and local-database switches |

Every secret is read only on the server. Only `NEXT_PUBLIC_SITE_URL` reaches the browser.

## First deployment

```bash
npm ci                                   # installs and runs `prisma generate`
npm run db:deploy                        # apply migrations; never resets data
# Optional, for a demo: sample services, barbers, hours and flagged sample appointments.
# For a real studio, enter services and barbers in the dashboard instead.
SEED_ALLOW_PRODUCTION=true SEED_SAMPLE_APPOINTMENTS=false npm run db:seed
ADMIN_EMAIL=owner@your-domain.mn ADMIN_PASSWORD='…12+ chars…' npm run admin:create
npm run build
npm start                                # PORT=3000 by default
```

Then, before announcing the site:

1. Replace the demo business details in `src/content/site.ts` (or the dashboard's website
   content) and set `isDemo: false` only when they are real. Remove sample appointments with
   `npm run db:remove-demo -- --yes`.
2. Check `/robots.txt` and `/sitemap.xml` show your domain (they come from `NEXT_PUBLIC_SITE_URL`).
3. Make a test booking and confirm it in the dashboard.
4. Schedule `npm run social:check` daily if Meta accounts are connected.

## Updates

```bash
npm ci && npm run db:deploy && npm run build && npm start   # restart the process
```

Migrations are additive. Take a database backup before `db:deploy`.

## Reverse proxy

- Forward `Host` (or `X-Forwarded-Host`) unchanged. Server Actions, the upload route and the
  Meta callback compare the browser's `Origin` against it; a proxy that rewrites the host
  breaks sign-in and saving (add `experimental.serverActions.allowedOrigins` only if you must).
- Set `X-Forwarded-For` to the real client address and strip any value the client sent:
  rate limits key on its first entry.
- Allow request bodies up to ~81 MB on `/api/admin/media/upload` (video uploads).

## Security headers

`next.config.ts` sends on every response: `frame-ancestors 'none'` and `X-Frame-Options: DENY`
(no framing, so no clickjacking of the dashboard), `nosniff`, a same-origin referrer policy,
a restrictive `Permissions-Policy`, and HSTS (`max-age=31536000`) in production. There is no
script CSP: the pages are prerendered and can't carry per-request nonces. React escapes all
user text and the codebase has no raw-HTML rendering.

## Backups and recovery

Back up these together; one without the others is incomplete:

- **PostgreSQL:** appointments, customers, staff accounts, content, media metadata, audit log.
  Use the provider's automated backups with point-in-time recovery where available, plus a
  periodic `pg_dump --format=custom` kept off the host. Test a restore into a scratch database.
- **`MEDIA_STORAGE_DIR`:** the library files. Rows without files show the fallback frame.
- **Secrets:** at minimum `SOCIAL_TOKEN_KEY` and the Meta/Instagram app secrets.

Restoring: restore the database, then the media folder, set the same environment, run
`npm run db:deploy` (applies any newer migrations) and start the app. Sessions in a restored
database may still be valid; delete the `sessions` table's rows to sign everyone out.

## Limits and costs to plan for

- **Rate limits are per process, in memory.** Fine for one server; with several instances or
  after restarts the counts reset. Put a shared limiter (CDN/WAF rule or Redis) in front of
  `/api/booking` and the sign-in page for stricter protection.
- **Free database tiers** often pause when idle, cap connections or storage, and may not
  allow `btree_gist`. Check the extension is available before choosing one; a paused database
  also fails the build.
- **Free hosting tiers** that are serverless (no disk, many short-lived instances) don't fit
  the media library or the in-memory limits without the changes above.
- **Email (Resend):** the free plan has daily and monthly send limits and needs a verified
  sending domain.
- **Pexels / Pixabay:** free keys with hourly request limits; results are cached.
- **Meta:** connections need an app in Live mode, and insights for accounts you don't
  administer need App Review (SOCIAL.md).
- **Hero footage:** about 4.5 MB of MP4 in `public/media/hero`, loaded progressively while
  scrolling and skipped entirely with reduced motion or Save-Data. A CDN in front of the app
  helps; re-encoding `hero-entry.mp4` (2.2 MB) would cut the first download.

## Verification status (Phase 07, 2026-10-22)

Verified locally against a production build (`next build` + `next start`) on a disposable
test database:

- Public pages in both languages: status codes, `<html lang>`, one `<h1>`, localized titles,
  canonical and hreflang links, sitemap and robots; locale redirect with and without the
  language cookie.
- Booking API: availability, booking, idempotent retry, conflicting booking (409), eight
  concurrent requests for one slot (exactly one succeeds), invalid input, cross-origin and
  opaque-origin rejection, rate limiting; `email: "not_sent"` when no provider is set.
- Dashboard: every page for ADMIN, STAFF and BARBER matches the permission table; a BARBER
  sees neither other barbers' appointments nor phone numbers.
- Uploads: origin, session and role checks, content sniffing, drafts hidden from the public,
  published library images through the image optimizer.
- Meta endpoints reject forged state and unsigned deauthorize requests; missing credentials
  show "Not set up".

**Not verified** (needs real credentials or infrastructure): email delivery through Resend,
Pexels/Pixabay searches with real keys, Facebook/Instagram OAuth and insights against Meta,
behaviour behind a specific reverse proxy or CDN, and any particular hosting provider.

## Known limitation: 404 page without JavaScript

Unknown URLs return status 404 with `noindex`, and with JavaScript the localized not-found
page renders. The server-sent HTML for a 404 is an empty shell, though, so without JavaScript
the page is blank. The catch-all route's `notFound()` ends its prerender; making the decision
per request would need the site header's `usePathname()` behind a `<Suspense>` boundary and
risks a soft 404 (status 200). Left as is.
