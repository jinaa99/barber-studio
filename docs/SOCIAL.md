# Facebook and Instagram (Phase 06)

The dashboard's **Social accounts** page (`/[locale]/admin/social`, ADMIN only) connects the
studio's own Facebook Page and Instagram professional account and shows read-only figures
from them. Nothing is posted, no messages or comments are read, and nothing from these
accounts appears on the public website. Without Meta credentials both connections show
**Not set up** and the rest of the product works as before.

Checked against Meta's documentation for **Graph API v26.0** (current on 2026-10-22):
Facebook Login manual flow, Facebook Login for Business, long-lived tokens, `debug_token`,
Page Insights, Business Login for Instagram, Instagram account insights, the permissions
reference. Meta changes metrics and review rules between versions, so check the
[changelog](https://developers.facebook.com/docs/graph-api/changelog) before upgrading
`META_GRAPH_VERSION`.

## What is implemented

| Feature | Facebook Page | Instagram professional account |
| --- | --- | --- |
| Login | Facebook Login (manual OAuth code flow; Facebook Login for Business with `META_LOGIN_CONFIG_ID`) | Business Login for Instagram |
| Account metadata | Page name, link, category, followers, likes | Username, name, account type, followers, post count |
| Insights (28 days) | `page_media_view`, `page_post_engagements`, `page_daily_follows_unique` | `reach`, `views`, `accounts_engaged`, `total_interactions` (`metric_type=total_value`) |
| Recent posts (read-only, text and link only) | `/{page}/posts`: message, date, permalink | `/me/media`: caption, type, date, permalink, like and comment counts |
| Token lifetime | Page token from a long-lived user token: no expiry, but **data access** lapses after ~90 days without a new login (shown as "Data access until") | 60 days; refreshed automatically once a week (`npm run social:check`, or on viewing the page) |
| Revocation | Deauthorize callback, `debug_token`, error 190 on any call | Deauthorize callback, error 190 on any call |

Not implemented, on purpose: posting or scheduling, messages, comments, ads and anything
else beyond reading. None of it is needed for this phase, and each would need further
permissions and app review. Post images are not shown: they would mean hotlinking Meta's
CDN, which the media rules forbid. The posts list links to each post instead.

### What has been verified, and how

- **Tested with mocked Meta responses** (fixtures follow the documented response shapes):
  URL building, response parsing, error classification, the HTTP client (endpoints,
  parameters, `appsecret_proof`, logs never containing tokens or query strings), token
  encryption, signed-request verification, and the whole connection lifecycle against
  the test database. See [Tests](#tests).
- **Not yet verified against Meta itself:** no Meta app credentials were available while
  this was built. Before relying on it, connect a real Page and account in development
  mode (see below) and confirm that each insight tile shows a figure. A metric Meta has
  retired shows as "Meta didn't return this figure". It is never estimated.

## Creating the Meta app

1. Go to <https://developers.facebook.com/apps> and choose **Create app**. Pick the
   **Business** app type (Business Login for Instagram requires it) and connect it to the
   studio's business portfolio.
2. **App settings → Basic:** note the **App ID** and **App Secret** (→ `META_APP_ID`,
   `META_APP_SECRET`). Fill in the privacy policy URL, the user data deletion instructions URL
   (see [Data and deletion](#data-and-deletion)), app icon and category. Meta requires these
   before the app can go Live.
3. **Add product → Facebook Login for Business.** Under *Settings*:
   - *Valid OAuth Redirect URIs:* `https://<your-domain>/api/social/facebook/callback`
   - *Deauthorize callback URL* (in *Settings → Advanced* or the product's settings,
     depending on the dashboard version): `https://<your-domain>/api/social/facebook/deauthorize`
   - Keep *Enforce HTTPS* and *Strict mode for redirect URIs* on.
   - Optional: create a **configuration** of type *User access token* containing
     `pages_show_list`, `pages_read_engagement` and `read_insights`, and set its ID as
     `META_LOGIN_CONFIG_ID`. Meta recommends `config_id` over `scope` for business apps.
     Without it the dialog is sent `scope`, which Meta still accepts for user tokens.
4. **Add product → Instagram → API setup with Instagram login.**
   - Note the **Instagram app ID** and **Instagram app secret** shown there
     (→ `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`). They differ from the Meta App ID.
   - *Set up Instagram business login → Business login settings:* OAuth redirect URI
     `https://<your-domain>/api/social/instagram/callback`, deauthorize callback URL
     `https://<your-domain>/api/social/instagram/deauthorize`.
5. Set the environment variables below and restart. The dashboard's **Meta app setup**
   section lists the exact URLs this deployment expects, built from `NEXT_PUBLIC_SITE_URL`.
   Meta compares redirect URIs exactly, including the scheme and trailing slash.

For local testing, `NEXT_PUBLIC_SITE_URL=http://localhost:3000` produces localhost redirect
URIs. Meta allows these only for apps in development mode, and only if they are added to the
redirect list. Otherwise use an HTTPS tunnel and set the variable to the tunnel's origin.

## Environment variables

All server-side only. Never prefix them with `NEXT_PUBLIC_`. Missing ones are listed by
name (never by value) on the dashboard page.

| Variable | Needed for | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | both | Public origin, `https://` (http only on localhost), no path. Redirect URIs are derived from it, never from the request's Host header. Callbacks arriving on another host are rejected |
| `META_APP_ID`, `META_APP_SECRET` | Facebook | App settings → Basic |
| `META_LOGIN_CONFIG_ID` | Facebook, optional | Facebook Login for Business configuration ID; sent instead of `scope` |
| `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | Instagram | Instagram → API setup with Instagram login |
| `SOCIAL_TOKEN_KEY` | both | 32 random bytes, base64 (`openssl rand -base64 32`). Encrypts stored tokens. If it changes, stored tokens can't be decrypted and connections ask to be reconnected |
| `META_GRAPH_VERSION` | both, optional | Default `v26.0` |

## Permissions requested and why

Only these are requested. "Required" ones must come back granted or nothing is connected.
"Optional" ones only unlock the insights. Granted permissions are always read back from
Meta (`debug_token` for Facebook, the token response for Instagram) and shown on the
page. Requesting a permission is never taken as proof that it was granted.

| Permission | Required | Why |
| --- | :-: | --- |
| `pages_show_list` | ✓ | List the Pages the person manages, so they can pick the studio's |
| `pages_read_engagement` | ✓ | Read the Page's name, link, follower and like counts, and recent posts |
| `read_insights` | | Page Insights (needs a Page role with the ANALYZE task) |
| `instagram_business_basic` | ✓ | Profile fields and recent media. Also required by Meta for token refresh |
| `instagram_business_manage_insights` | | Account insights |

Facebook Login is sent `auth_type=rerequest`, so permissions that were declined before are
offered again on reconnect.

## Account eligibility

- **Facebook:** the person connecting must have a role on the studio's Page (Pages
  are managed through a personal profile or a business portfolio). If they share several
  Pages, the dashboard asks which one. The others' tokens are discarded with the pending
  choice (encrypted, at most ten minutes). Page Insights only exist for Pages with **100 or
  more likes**. Demographic breakdowns (not used) need 100+ people.
- **Instagram:** only **professional accounts** (Business or Creator) work with Business
  Login for Instagram. A personal account is refused with an explanation ("switch the account
  to professional in the Instagram app first"). Some insights need **100+ followers**,
  data can be up to 48 hours late, `reach` is an estimate and `views` is marked by Meta as
  in development. An empty result is shown as "no data", never as 0.
- Business Login for Instagram does not need the Instagram account to be linked to a
  Facebook Page. The two connections are independent.

## App review and access levels

- **Standard Access** (no app review) covers accounts the app's own team owns or manages:
  people with a role on the app (admin, developer, tester; Instagram accounts added as
  Instagram testers in development mode). **This is the expected setup for one studio
  running its own Meta app.** The owner adds themself, and the Page or Instagram account
  they manage, to the app.
- **Advanced Access** is needed to connect accounts that the app's team doesn't own or
  manage, for example one vendor app serving many barber shops. It needs **App Review**
  for each permission (a screencast of this page in use), **Business Verification**, and
  the app switched to **Live** mode. Until that is granted, Meta's dialog fails or grants
  less for outside accounts, and the dashboard reports what actually came back: missing
  permission, no Pages, or not eligible. It never reports a connection that wasn't made.
- Re-selling: either each shop creates its own Meta app (Standard Access, its own
  credentials in its own deployment), or the vendor's app goes through App Review once.

## How it works

```
Admin clicks Connect ─▶ startConnectionAction (social.manage, rate-limited)
                        └ beginConnection: random 256-bit state; only its SHA-256 is
                          stored, bound to this staff login, 10-minute expiry
   ─▶ Meta's dialog (facebook.com/v26.0/dialog/oauth | instagram.com/oauth/authorize)
   ─▶ GET /api/social/{provider}/callback?code&state
        • requires the same signed-in staff member with social.manage
        • request must arrive on NEXT_PUBLIC_SITE_URL's host
        • state looked up by hash, provider + user must match, deleted on first use
        • error=access_denied → "cancelled", nothing stored
        • code exchanged server-side with the same redirect URI
          Facebook: code → user token → long-lived user token → debug_token (valid,
          our app_id, required scopes) → /me/accounts → Page token → debug_token → Page
          Instagram: code → short-lived token (+ granted permissions) → long-lived token
          → /me (must be BUSINESS or MEDIA_CREATOR)
        • token encrypted, saved; audit "social.connected"
   ─▶ 303 to /{locale}/admin/social?result=…   (code and state never reach the page)
```

- **Storage:** `social_connections` (one row per provider) holds the AES-256-GCM-encrypted
  token (`lib/server/social-crypto.ts`, provider bound in as associated data), the granted
  permissions, expiry dates, and the authorizing person's app-scoped id (to match deauthorize
  callbacks). `social_oauth_states` holds hashed states and encrypted pending Page choices.
  The user token behind a Facebook Page token is not kept.
- **Never exposed:** the view models passed to the page contain no token or ciphertext.
  Tokens go only into request URLs/bodies built in `lib/server/meta-api.ts`. Log lines give
  method, path and Meta's error code, never a URL with its query string. Graph calls with
  Facebook tokens carry `appsecret_proof`.
- **Errors:** Meta error 190 (expired, logged out, password changed, app removed) erases the
  token and marks the row `NEEDS_RECONNECT` with a reason. Errors 10/200–299 on a check mean
  a permission was removed. Rate limits (4/17/32/613) and outages leave the connection alone
  and show "try again shortly". Each insight metric is fetched separately, so one Meta has
  retired or withheld shows as unavailable without hiding the rest. Insights are cached in
  memory for 10 minutes.
- **Expiry:** an expired Instagram token, or lapsed Facebook data access, shows as
  "Needs reconnecting" before any call is made. The Instagram token is refreshed once it is
  a week old: when the page is viewed, or daily via `npm run social:check` (schedule it with
  cron; it also checks both connections). Meta refuses refreshes for tokens under 24 hours
  old or already expired, and that is respected.
- **Disconnect** deletes the row (token included) and records who did it. It can't revoke
  access on Meta's side (there is no Page-token revoke and the user token isn't stored),
  so the dialog tells the admin where to remove the app in Facebook or Instagram. That
  removal then reaches the deauthorize callback.
- **Deauthorize callbacks** (`POST /api/social/{provider}/deauthorize`) verify the
  `signed_request` (HMAC-SHA256 with that app's secret, constant-time compare,
  algorithm checked) before marking the matching connection "access removed".
- **Permissions:** `social.manage` (ADMIN only) on the page, every Server Action and the
  callback.

## Data and deletion

The studio stores the connected account's id, name, username, account type, granted
permissions, token expiry and encrypted token, nothing else. No figures are persisted.
Disconnecting deletes all of it. For the app's *User data deletion* setting, publish a
short instructions page: "Disconnect in the studio dashboard, or remove the app under
Facebook Settings → Business integrations / Instagram Settings → Website permissions →
Apps and websites; the studio then deletes the stored token." A data-deletion
*callback* endpoint is not implemented.

## Tests

- `src/lib/social/meta.test.ts`: configuration (missing variables reported by name,
  https-only origins, Graph version validation), authorization URLs (exact scopes, state,
  no secret, `config_id`), error classification per documented code, response parsing
  (both documented Instagram token shapes, `debug_token` with 0 = no expiry, null rather
  than 0 for empty insights).
- `src/lib/server/social-crypto.test.ts`: encryption round trip, wrong context/tampered
  value/rotated key rejected, key length enforced, hashed state, `appsecret_proof`,
  signed-request verification including forged payloads and `algorithm: none`.
- `src/lib/server/meta-api.test.ts`: the HTTP client against a fake `fetch`: endpoints and
  parameters, `appsecret_proof`, form-encoded Instagram exchange, token errors, network
  failures and unexpected bodies, and that no log line contains a token, secret or query.
- `tests/integration/social.test.ts`: against the test database with a fake `MetaApi`.
  Covers hashed and expiring states, single use, a state from another login, provider or
  time refused before any code exchange, cancel, personal account refused, missing
  permission, wrong app, no Pages, the multi-Page choice (no tokens exposed, bound to its
  user, single use), status views without tokens, expiry, revoked/invalid tokens erased
  and audited, outages not breaking the connection, removed permissions, a changed
  encryption key, the refresh schedule, per-metric insight states, insights not requested
  without permission, disconnect, and deauthorize with valid and forged signatures.
