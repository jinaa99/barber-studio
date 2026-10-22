# Staff dashboard (Phases 04–06)

The admin dashboard at `/[locale]/admin` runs the studio day to day: calendar,
bookings, barbers and schedules, services and prices, customers, analytics, website
content and booking rules. It is bilingual like the public site and works at 390px.
Booking internals (availability, locking, notifications) are in [BOOKING.md](BOOKING.md).

## Roles and permissions

Roles are defined once in `src/lib/admin/permissions.ts` and checked on the server by
every page (`adminContext()` → `ctx.can(...)`) and every Server Action
(`permitted(permission, formData)` in `app/[locale]/admin/actions/shared.ts`). The
navigation hides what a role can't use, but that is only a convenience.

| Permission | ADMIN | STAFF (front desk) | BARBER |
| --- | :-: | :-: | :-: |
| See every barber's appointments | ✓ | ✓ | own only |
| Confirm / complete / cancel / no-show | ✓ | ✓ | own only |
| Create and reschedule appointments | ✓ | ✓ | |
| Customers and contact details | ✓ | ✓ | |
| Revenue, scheduled value, analytics | ✓ | | |
| Services, categories, barbers, hours, time off | ✓ | | |
| Staff accounts | ✓ | | |
| Booking rules, website content | ✓ | | |
| Media library: stock search, uploads, publishing, placing media | ✓ | | |
| Social accounts: connect, check, disconnect Facebook/Instagram; view their insights | ✓ | | |
| Activity log | ✓ | | |

- A **BARBER** login is linked to one barber profile (`Barber.userId`); that link is its
  scope. Every appointment query takes the scope (`scopeWhere` in
  `lib/server/appointments.ts`), so another barber's appointment is "not found" even when
  its id is typed into the URL. Barbers see customer names and booking notes, never phone
  numbers or emails, and no revenue figures.
- A BARBER login without a linked profile sees no appointments at all.
- Account rules (`lib/server/staff.ts`): nobody changes their own role or deactivates
  themself; the last active ADMIN can't be demoted or deactivated; changing someone's role
  or deactivating them ends their sessions; a new password ends their sessions too.
- Accounts can now also be created in the dashboard (Barbers & staff → Staff accounts)
  with a temporary password of at least 12 characters. `npm run admin:create` still works
  for the first account.

## Modules

| Route | What it does |
| --- | --- |
| `/admin` | Overview: today's appointments, next 7 days, pending confirmations, period metrics (revenue for admins), trends, utilization, recent activity |
| `/admin/appointments` | Calendar: day grid (one column per barber, working hours and time off shaded; agenda on phones), week view, paginated list with search and filters. `?open=<id>` opens the appointment dialog with status actions, history and notifications |
| `/admin/appointments/new` | Staff booking: pick service, barber and day, choose a free time (or type another), enter guest details. `?reschedule=<id>` moves an existing booking |
| `/admin/customers` | Search by name, phone digits or email; filters for upcoming, returning (2+ completed visits) and no-shows; masked phone numbers; `/admin/customers/<id>` shows contact details and paginated history |
| `/admin/barbers` | Barber profiles, studio closures and staff accounts. `/admin/barbers/<id>`: profile (both languages, specialties, photo from the licensed media library, services offered, active), weekly working hours, time off |
| `/admin/services` | Services by category with activate/deactivate, category management. `/admin/services/<id>`: names, summary, inclusions, duration, price, featured, active, eligible barbers |
| `/admin/analytics` | Revenue and appointments over time, popular services, barber performance, status distribution, returning customers, written definitions |
| `/admin/content` | Studio name and wordmark, address, directions, contact, opening hours, socials, demo flag; Mongolian/English overrides for selected website copy; gallery order and visibility (bundled and library photos); hero scenes (still, video, focal point); page photos |
| `/admin/media` | Media library: saved media (search, filter, publish, place, replace, delete), stock search (Pexels, Pixabay), uploads. `?asset=<id>` opens an item. See [MEDIA.md](MEDIA.md) |
| `/admin/settings` | Booking rules: slot interval, horizon, minimum notice, buffer, per-phone limit, auto-confirm |
| `/admin/social` | Facebook Page and Instagram professional account: connection status, granted permissions, token expiry, connect / reconnect / check / disconnect, read-only insights and latest posts, Meta app setup URLs. `?choose=<id>` picks one of several Pages. See [SOCIAL.md](SOCIAL.md) |
| `/admin/activity` | The audit log, filterable and paginated |

Filters, date ranges and dialogs live in the URL, so every view can be bookmarked and
survives a reload or a language switch. Lists are paginated (25 rows, 50 in the log).
Forms keep what was typed when validation fails and show the error beside the field,
in the current language.

## Metric definitions

Implemented and unit-tested in `src/lib/admin/metrics.ts`; also shown at the bottom
of the analytics page.

- An appointment belongs to the studio-time (Asia/Ulaanbaatar) day it **starts**.
- **Completed-service revenue** = the sum of `priceMnt` (the price snapshot taken at
  booking time) of appointments with status `COMPLETED`. Pending, confirmed, cancelled
  and no-show appointments never count. There is no payment ledger yet, so the figure
  assumes a completed service was paid at its booked price; discounts, tips and refunds
  are not reflected.
- **Scheduled value** = the sum of `priceMnt` of `PENDING` and `CONFIRMED` appointments.
  It is expected income, never added to revenue, and always labelled as such.
- **Cancellation rate** = cancelled ÷ all appointments in the period.
- **No-show rate** = no-shows ÷ (completed + no-shows).
- **Utilization** = minutes of appointments that held the chair (every status except
  `CANCELLED`) ÷ the barber's scheduled minutes (weekly working blocks on each day of the
  period, minus their time off and studio closures). Capped at 100%.
- **Returning customers** = of the customers with a completed visit in the period, the
  share with at least two completed visits up to the end of the period. Reported only
  when at least 20 customers are in the sample; otherwise the page says how many there are.
- **Demo data**: sample appointments (`isDemo`) are excluded by default. "Include sample
  data" adds them, and every view that includes them shows a banner saying they are not
  real results. When only sample data exists, the dashboard says so instead of showing zeros silently.

## Staff bookings and reschedules

`createStaffAppointment` and `rescheduleAppointment` in `lib/server/appointments.ts` use
the same three protections as online booking: the barbers' rows are locked
(`SELECT … FOR UPDATE`, in id order), availability is recomputed inside the transaction,
and the `appointments_no_overlap` exclusion constraint is the final guard (a violation
becomes "That time is no longer free").

Compared with online booking, staff may ignore the minimum notice, the booking horizon
(up to 365 days ahead) and the per-phone limit, and may type a time off the slot grid.
They can never book in the past, outside the barber's working hours, during time off or a
studio closure, over another active appointment (including the buffer), for an inactive
service, or with a barber who doesn't offer the service. A reschedule frees the
appointment's own time while checking the new one, keeps the booked price, and only
applies to pending or confirmed appointments. Both are audited and can email the guest
(recorded as a notification with its real delivery status).

## Catalogue and schedules

- Services and barbers are never deleted (appointments reference them); deactivate them
  instead. A category can be deleted only when no service uses it.
- Price and duration changes apply to new bookings. Existing appointments keep their snapshot.
- Saving working hours locks the barber row (same order as booking) and reports how many
  upcoming appointments now fall outside the new hours. They are kept for staff to move.
- Adding time off reports how many active appointments overlap it. They are kept so
  staff can contact those guests.
- Every catalogue change calls `updateTag(catalogTag)`, so the public site updates at once.

## Website content

`site_content` holds one row with three JSON sections, validated by
`src/lib/admin/content.ts`. Anything missing or invalid falls back to
`src/content/site.ts` and the dictionaries, field by field, so an empty table changes
nothing.

- **profile**: studio name, wordmark, address/city/directions (mn + en), phone, email,
  map link, opening hours, social links, and the demo flag. Public pages, the header and
  footer, the booking confirmation and confirmation emails read it through
  `getStudioProfile()` / `readSiteContent()`.
- **texts**: overrides for selected copy (`editableTexts`). A language left blank keeps the
  dictionary text. Pages that show this copy use `getSiteDictionary(locale)`.
- **gallery**: order and hidden items for the Our Work gallery (also applied to the home
  page). Items are the bundled gallery plus photos added from the media library
  (`media_placements` rows with slot `gallery`, keyed by placement id).

Content changes call `updateTag(contentTag)`. Media is separate (Phase 05, [MEDIA.md](MEDIA.md)):
hero scenes and page photos are edited on the Website page by admins with `media.manage`,
stored as `media_placements`, and refresh the site with `updateTag(mediaTag)`.

## Audit log

Recorded actions (`AuditAction` in `lib/server/audit.ts`): sign-ins (including failures)
and sign-outs; appointment created / rescheduled / status changed (with the cancellation
reason); service, category and barber created / updated / (de)activated / deleted;
working hours changed; time off added / removed; booking rules changed (before and
after); website profile, copy and gallery changed; staff account created / updated /
password set; media saved from a provider / uploaded / edited / published / unpublished /
deleted / replaced everywhere, placed on or removed from the website; social account
connected / disconnected / flagged for reconnecting (by the system, with the reason).
Passwords, session tokens, API keys and Meta access tokens are never logged.

## Schema changes (migration `20261021150000_admin_dashboard`)

Additive only; existing rows are backfilled.

- `UserRole` gains `BARBER`.
- New `service_categories` table, created with the three former enum categories;
  `services.categoryId` is backfilled from the old `category` enum column. That column is
  now nullable and unused, and can be dropped in a later cleanup migration.
- New `site_content` table (single row, `CHECK (id = 'default')`).
- Index on `appointments.updatedAt` for the activity feed.

## Schema changes (migration `20261022120000_media_library`)

Additive only.

- New `media_assets` table with `MediaKind`, `MediaSource` and `MediaStatus` enums; unique
  `(source, providerAssetId)` so a stock item is saved once; CHECKs that uploads have no
  provider id, sizes are positive and only videos have a poster.
- New `media_placements` table; a partial unique index keeps one row per slot except `gallery`.
- `barbers.imageId` now also accepts `asset:<id>` (a published library image). Existing values
  are unchanged.

## Schema changes (migration `20261022180000_social_accounts`)

Additive only.

- New `social_connections` table (`SocialProvider`, `SocialConnectionStatus` enums), one row
  per provider; a CHECK keeps a token on CONNECTED rows and none on NEEDS_RECONNECT rows.
- New `social_oauth_states` table for pending OAuth round trips and Page choices; a CHECK
  makes each row either a hashed state or an encrypted choice.

## Tests

- Unit (`npm test`): permissions, metric definitions, form validation and working-hour
  blocks, content fallbacks and overrides; media references and slots, provider response
  parsing and host allow-lists, file-type sniffing, byte ranges, upload validation.
- Database (`npm run test:integration`, `tests/integration/admin.test.ts`): staff bookings
  against hours, breaks, time off and the past; concurrent staff and online bookings for
  one slot; reschedules; barber scoping of reads and status changes; contact-detail
  hiding; revenue excluding cancelled, no-show, scheduled and demo appointments;
  utilization; catalogue changes affecting availability; account guards; content storage;
  customer search. `tests/integration/media.test.ts`: upload re-encoding and metadata
  stripping, refusing disguised files, publishing rules, slot validation and rollback,
  gallery items, delete/replace guards and file removal, saving stock media with a stubbed
  provider (credits recorded as returned, no off-host downloads).
  `tests/integration/social.test.ts`: the Meta connection lifecycle with a fake `MetaApi`
  (see [SOCIAL.md](SOCIAL.md#tests)).

## Known limits

- No payment records: revenue is "completed at booked price" (see above).
- Media files live on the server's disk (`MEDIA_STORAGE_DIR`); multi-instance or serverless
  hosting needs a shared volume or an object-storage driver (see MEDIA.md).
- Uploaded videos are stored as sent (no transcoding), so their dimensions and length aren't
  recorded and they have no poster frame; pair them with a still in the hero.
- The time zone is fixed in settings: changing it would shift every schedule, and
  multi-branch support (see BOOKING.md) is the place to make it configurable.
