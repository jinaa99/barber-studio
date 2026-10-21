# Booking backend (Phase 03)

How appointments, availability, staff access and notifications work, and how to run them.

## Setup

```bash
npm install                       # also runs `prisma generate`
cp .env.example .env.local        # set DATABASE_URL (and TEST_DATABASE_URL for tests)
npm run db:local                  # optional: local PostgreSQL on :5433, prints the URLs
npm run db:deploy                 # apply migrations (never resets data)
npm run db:seed                   # demo services, barbers, hours, sample reviews + appointments
npm run admin:create              # first staff account (prompts, or ADMIN_* env vars)
npm run dev
```

`npm run build` prerenders the public pages from the database, so `DATABASE_URL` must
be reachable at build time.

| Script | Purpose |
| --- | --- |
| `npm run db:local` | Development-only Postgres (`embedded-postgres`), data in `.data/postgres` |
| `npm run db:migrate` | Create a new migration while developing (`prisma migrate dev`) |
| `npm run db:deploy` | Apply pending migrations (use this in production) |
| `npm run db:seed` | Idempotent demo seed; creates only what's missing |
| `npm run db:remove-demo -- --yes` | Delete sample appointments and demo customers only |
| `npm run admin:create` | Create an ADMIN or STAFF account |
| `npm run notifications:retry` | Retry failed or skipped confirmation emails for upcoming bookings |
| `npm test` | Unit tests (availability, time zone, status rules, validation, passwords) |
| `npm run test:integration` | Database tests against `TEST_DATABASE_URL` (concurrency, rules, auth, email) |

Nothing in this project resets or drops a database. `prisma migrate dev` can ask to
reset a development database if migrations and schema drift apart. Answer no, and
fix the drift with a new migration.

## Data model

`prisma/schema.prisma` is the source of truth. In brief:

- **User**: staff account (`ADMIN` or `STAFF`), scrypt password hash, lockout counters. **Session**: hashed session tokens.
- **Customer**: a guest who booked, keyed by normalized phone. There are no customer accounts; booking needs only a name and phone (email and notes optional).
- **Service**, **Barber**, **BarberService**: the catalogue. Localized text is JSON `{ mn, en }`. `active = false` hides a service or barber and stops new bookings.
- **WorkingHour**: one row per working block (weekday 0 = Sunday, minutes after midnight in the studio zone). Several blocks on a day model breaks; no block means a day off.
- **TimeOff**: absences for one barber, or for the whole studio when `barberId` is null.
- **BusinessSettings**: single `default` row: time zone (`Asia/Ulaanbaatar`), slot interval, booking horizon, minimum notice, buffer between appointments, max upcoming bookings per phone, and auto-confirm.
- **Appointment**: UTC `startsAt`/`endsAt`, price and duration snapshot, the contact details submitted with it, `reference` (e.g. `S08-7KQ2MD`), `idempotencyKey`, `source` and `isDemo`.
- **Notification**: one row per message with its real delivery outcome.
- **Review**: published reviews feed the home page testimonials; samples are flagged `isSample` and labelled on the site.
- **AuditLog**: logins (including failures), logouts, status changes, service activation, account creation.

**Multi-branch later:** add a `Branch` model and a `branchId` to BusinessSettings, Barber,
TimeOff and Appointment. Availability already takes the time zone and rules as inputs,
so it won't need to change.

## Availability

`src/lib/booking/availability.ts` is pure and unit-tested. For a date, a service and one
or all candidate barbers, a start time is offered when:

1. the service fits entirely inside one of the barber's working blocks (on the slot grid from the block start),
2. it doesn't overlap the barber's time off or a studio closure,
3. it doesn't overlap a PENDING or CONFIRMED appointment, widened by `bufferMinutes`,
4. it starts at least `minLeadMinutes` from now, and the date is within `bookingHorizonDays` (today counts as day 1).

All wall-clock maths happens in the studio time zone (`src/lib/booking/time.ts`).
`GET /api/booking/availability?service=&barber=&date=` serves these slots, uncached.

## Creating a booking

`POST /api/booking` → `createBooking()` in `src/lib/server/booking.ts`:

1. Rejects cross-origin and non-JSON requests and bodies over 8 KB. Applies a rate limit of 10 per 10 minutes per IP.
2. Validates the payload with zod and the shared customer rules (`src/lib/booking/validation.ts`).
3. If the `idempotencyKey` was already used, returns that booking. The browser keeps one key per submit attempt, so a double click or a retried request never creates two bookings.
4. Opens a transaction and locks the candidate barbers' rows (`SELECT … FOR UPDATE`, in id order). Concurrent bookings for the same barber therefore run one after another.
5. Recomputes availability from the database inside that transaction. A slot the page showed earlier is never trusted.
6. Enforces the per-phone limit, picks a barber (for "any", the one with the fewest bookings that day), and inserts the appointment, plus a PENDING notification row if an email was given.
7. Behind all of that, the `appointments_no_overlap` exclusion constraint (migration SQL, `btree_gist`) makes the database itself refuse two overlapping PENDING/CONFIRMED appointments for one barber.

Results: `201` with `{ reference, status, barberId, date, time, email }`. Errors are `409 slot_taken`,
`409 limit_reached`, `422 invalid` (with the offending customer `fields`), `429 rate_limited`
and `500 unknown`. The response never includes other customers' data.

## Appointment statuses

```
PENDING ──► CONFIRMED ──► COMPLETED
   │            ├───────► NO_SHOW
   └──────► CANCELLED ◄──┘
```

COMPLETED and NO_SHOW can only be recorded once the start time has passed.
COMPLETED, CANCELLED and NO_SHOW are final. Only PENDING and CONFIRMED hold a
barber's time. New online bookings start CONFIRMED, or PENDING when
`autoConfirm` is off. Rules: `src/lib/booking/status.ts`. Changes lock the row
and write an audit entry: `src/lib/server/appointments.ts`.

## Staff access

- `/[locale]/admin/login` and `/[locale]/admin` (noindex). The dashboard lists a day's
  appointments, can hide sample data, and offers only the status changes that are valid.
  ADMINs can also activate and deactivate services.
- Sessions: a 256-bit random token in an httpOnly, SameSite=Lax cookie (`__Host-` and
  `Secure` in production), lasting 12 hours. Only its SHA-256 hash is stored.
- Passwords: scrypt (N=2^15), at least 12 characters. After 5 failed attempts the
  account locks for 15 minutes. The login form also has a per-IP rate limit. Error
  messages never reveal whether an email exists.
- Every Server Action re-reads the session from the database and checks the role
  (`authorize("ADMIN")`). The UI hiding a button is never the check.
- Accounts are only created with `npm run admin:create`, which reads credentials from
  `ADMIN_*` environment variables or an interactive prompt. None are hardcoded.

## Notifications

`src/lib/server/notifications.ts` defines an `EmailProvider` interface. Resend is
implemented, using the HTTP API with no SDK. It's enabled when `EMAIL_PROVIDER=resend`,
`RESEND_API_KEY` and `EMAIL_FROM` are all set.

The notification row is written inside the booking transaction; delivery is attempted after commit:

| Status | Meaning | Customer sees |
| --- | --- | --- |
| `SENT` | Provider accepted the message | "A confirmation email has been sent to …" |
| `SKIPPED` | No provider configured | "We couldn't send a confirmation email, so please note your reference" |
| `FAILED` | Provider rejected it or was unreachable (error stored) | Same as SKIPPED |

A missing or failing provider never fails the booking. `npm run notifications:retry`
re-attempts FAILED, SKIPPED and PENDING emails for upcoming appointments, up to 5
attempts each. Run it from cron once a provider is configured. SMS is modelled
(`NotificationChannel.SMS`) but has no provider yet.

## Demo data

The seed's sample appointments have `isDemo = true`, `source = DEMO_SEED` and a
`DEMO-00001` style reference; demo customers have `isDemo = true`. They cover the
last four weeks (completed, cancelled and no-show, for analytics previews) and a few
confirmed bookings over the next week, which really do occupy those slots. Filter
reports with `isDemo = false`, or delete the samples with `npm run db:remove-demo -- --yes`.
The seed refuses to run with `NODE_ENV=production` unless `SEED_ALLOW_PRODUCTION=true`.

## Operational notes

- The rate limiter is in memory, per server instance. With several instances, add a
  shared limiter (CDN, proxy or Redis). Client IPs come from `x-forwarded-for`, which
  is only trustworthy behind a proxy that sets it.
- Public pages cache catalogue data (`use cache`, tag `catalog`/`settings`, hourly).
  Admin changes call `updateTag(catalogTag)`. If you edit the database directly,
  expect up to an hour of delay, or redeploy.
