# Backend Options — Engineering Notes

> **Audience:** the engineer who needs to defend or push back on the
> stack pick when the team converges on a direction. This is the
> companion to `docs/backend-options.md`, which is the partner-facing
> summary. Read this when the decision is near.

The headline from the partner-facing doc still holds: at our launch
scale (1–2k accounts, ~200 MAU, fewer than 50 paying users) every
option is functionally free and the choice is mostly architectural.
The differences become real at 10k+ MAU. So this doc focuses on the
**architectural implications** rather than the dollar amounts.

## TL;DR for the engineer

- **At launch**, the choice doesn't matter financially. All paths cost
  $0–$30/mo. Pick the stack that's easiest to migrate _away from_ if
  we get something wrong.
- **The real differentiator is the database shape**, not the auth or
  analytics product. Firestore is a document store; Supabase is
  Postgres. Our public-link feature is a near-perfect fit for
  Postgres and somewhat awkward in Firestore (security rules are
  coarse-grained). The sync volume itself is small enough that
  either database is comfortable on its free tier.
- **Squarespace is fine for the marketing site** but a poor fit for
  subscriptions and a real fit only for the sensor SKU. Pair it with
  Stripe-direct subscriptions handled by RevenueCat Web Billing, not
  with Squarespace's own subscription product.
- **Webhooks need a small server somewhere.** All options require it.
  It's a few hours of work, not a deciding factor.
- **Crashlytics vs. Sentry vs. PostHog Error Tracking**: only matters
  if we hit native (BLE / sensor) crashes. If we do, Sentry is worth
  the fourth account; otherwise either of the other two is sufficient.

## How small "small" really is

### Confirmed sync model

Per the team's intent, **no per-sample / per-stroke data leaves the
device during an activity.** While the user rows, every reading goes
to local storage; the FIT file is built on-device just like it is
today, and shipped (only for premium users) once the activity ends.

Networked traffic during an activity is limited to a small number of
**lifecycle events** (e.g. `activity_started`, `activity_ended`,
`activity_paused_resumed_count`, `unrecoverable_error`). These flow
into our analytics pipeline (PostHog / Firebase Analytics), not into
the database, and they never include per-stroke detail.

```
device                                  network                       cloud
  │                                        │                            │
  │ user starts a row                      │                            │
  │── activity_started event (1) ─────────▶│ analytics                  │
  │                                        │                            │
  │ ── live samples write to local cache ─ │                            │
  │ ── ~25–50 Hz, 30 min, 0 network I/O ── │                            │
  │                                        │                            │
  │ user ends the row                      │                            │
  │── activity_ended event (1) ───────────▶│ analytics                  │
  │── if premium: PUT activity-{id}.fit ──▶│ object storage             │
  │── if premium: INSERT summary row ─────▶│ database                   │
  │                                        │                            │
```

### Per-MAU traffic with that model

Approximate per-month usage for one premium user who rows daily
(30-minute sessions, FIT files ~80 KB each):

| Operation                                    | Per MAU / month                 |
| -------------------------------------------- | ------------------------------- |
| Auth token refresh                           | ~90 reads                       |
| Lifecycle events (start, end, errors)        | ~90 events                      |
| Activity summary writes (premium only)       | ~30 writes                      |
| FIT file uploads (premium only)              | ~30 × ~80 KB                    |
| Activity history reads (user opens History)  | ~60 reads                       |
| Public-link page views (per shared activity) | unbounded but cheap (cacheable) |
| Profile / settings reads                     | ~30 reads                       |

Free users contribute only auth + lifecycle events; everything else
is gated to premium. Plug in our scenarios:

- **Launch (200 MAU, 20 premium)**: 600 summary writes / month,
  ~600 FIT uploads totalling ~50 MB. Both Firestore and Postgres
  handle this without breaking a sweat.
- **Cap (10k MAU, 1.5k premium)**: ~45k summary writes / month,
  ~45k FIT uploads totalling ~3.6 GB. Still inside Firestore's free
  tier (50k writes/day × 30 ≈ 1.5M writes/month free) and trivially
  inside Supabase Pro.

### What this means for the database choice

The architectural argument for Postgres (Supabase) used to lean on
"per-sample writes are expensive on Firestore". With per-sample
sync taken off the table, **the cost picture is similar between
Firebase and Supabase up to and including our cap**. Both stay free
on writes; both pay the same handful of dollars for storage at scale.

The argument for Postgres now rests entirely on:

1. **Public-link simplicity** — single SQL query with a row-level-
   security policy vs. Firestore's duplicate-document workaround
   (described in the next section).
2. **Bulk operations** for GDPR delete and "give me everything you
   have" exports (a single statement on Postgres; a Cloud Function
   that walks subcollections on Firestore).

Both are real but neither is dollar-driven. The decision is purely
about how much code we want to write to support the same features.

## Data model deep dive

### Firestore (Option 1)

A schemaless document store. Reads and writes are priced per
operation. Queries are limited to indexed fields and have ANDed
conditions only — no JOINs, no aggregations.

For our needs, the natural shape is:

```
users/{userId}
  profile: { displayName, units, ... }
  subscriptions/{platform}: { productId, expiresAt, ... }   // mirror RC
  activities/{activityId}
    summary: { distance, duration, paceAvg, ... }
    fitFilePath: "users/{userId}/activities/{activityId}.fit"
    visibility: "private" | "unlisted" | "public"
    publicSlug: "abc123" | null

publicActivities/{publicSlug}
  ownerId: string
  activityRef: ref to users/{userId}/activities/{activityId}
  summary: { ... }   // duplicated for fast public reads

# FIT files live in Cloud Storage (separate from Firestore):
#   gs://<project>.appspot.com/users/{userId}/activities/{activityId}.fit
```

Two important things to flag:

1. **Public activity links require a duplicate read path.** Firestore
   security rules are coarse: either a path is readable to everyone
   or it isn't. The cleanest way to make a single activity public is
   to write a copy of its summary to `publicActivities/{slug}`, where
   the rule is "anyone can read, only the owner can write". The
   private path stays locked down. We'd duplicate this on every
   visibility change.
2. **Bulk operations are awkward.** Deleting a user (GDPR) requires
   recursive deletion of subcollections, which Firestore does not do
   natively — we'd write a Cloud Function that walks the subtree.
   Same story for "export everything I have on you".

### Postgres on Supabase (Option 2/3)

A normal relational schema. Approximate shape:

```sql
create table users (
  id uuid primary key,
  display_name text,
  units jsonb not null default '{}',
  created_at timestamptz default now()
);

create table subscriptions (
  user_id uuid references users(id) on delete cascade,
  platform text not null,             -- 'ios' | 'android' | 'stripe'
  product_id text,
  expires_at timestamptz,
  primary key (user_id, platform)
);

create table activities (
  id uuid primary key,
  user_id uuid references users(id) on delete cascade,
  started_at timestamptz not null,
  duration_seconds integer not null,
  distance_meters numeric not null,
  pace_avg_seconds_per_500m numeric,
  -- Path to the FIT file in Supabase Storage; uploaded once when the
  -- activity ends, never modified afterwards.
  fit_file_path text,
  visibility text default 'private' check (visibility in ('private','unlisted','public')),
  public_slug text unique
);

create index activities_user_started_idx on activities(user_id, started_at desc);
create index activities_public_slug_idx on activities(public_slug) where public_slug is not null;

-- FIT files live in Supabase Storage (separate from Postgres):
--   storage://activities/{user_id}/{activity_id}.fit
```

Notes:

- **Public links are trivial**: one indexed column, one query. Row-
  level security policy: `using (visibility = 'public')` for the
  public route, `using (auth.uid() = user_id)` for the private route.
- **Deletion is a single statement**: `delete from users where id = $1`
  cascades to everything thanks to foreign keys.
- **Public activity page is a single SQL query**, not a duplicate
  storage path.

If we expect activity sync to be a meaningful product feature
(it is, given premium gating + public links), Postgres is the obvious
choice purely on the "lines of code" axis.

## Authentication flow comparison

Both Firebase Auth and Supabase Auth support: email/password, magic
links, Apple sign-in (required by App Store for any other social
login), Google sign-in, anonymous sessions, and the upgrade-anonymous-
to-real-account flow.

### Firebase Auth specifics

- Anonymous → permanent: `linkWithCredential()`. Same UID survives.
- Apple sign-in requires the
  `@invertase/react-native-apple-authentication` plugin (or Expo's
  `expo-apple-authentication`) plus a Firebase config plugin.
- Token refresh is handled by the SDK; no rotation hooks needed for
  the typical case.

### Supabase Auth specifics

- Anonymous sign-ups are first-class (`auth.signInAnonymously()`).
  Upgrade with `updateUser({ email })` + magic link verification, or
  `linkIdentity()` for OAuth.
- Apple sign-in via `expo-apple-authentication` + `signInWithIdToken`.
- The session token is a JWT (JSON Web Token) signed with our project's
  secret. Easy to verify on the website backend without a round-trip.

**Difference that matters**: Supabase JWTs are easy to verify on
arbitrary servers (we can stand up a tiny Node service to verify a
session and look up the user). Firebase ID tokens require the Firebase
Admin SDK to verify, which is fine but means the website backend
acquires a Firebase dependency.

## Subscription / RevenueCat plumbing

The flow is the same shape for any backend choice:

```
mobile app           RevenueCat            our backend           database
   │                     │                       │                  │
   │── purchase ────────▶│                       │                  │
   │                     │── webhook ───────────▶│                  │
   │                     │   (INITIAL_PURCHASE)  │                  │
   │                     │                       │── upsert sub ───▶│
   │                     │                       │                  │
   │                     │── webhook ───────────▶│── delete grant ─▶│
   │                     │   (CANCELLATION)      │                  │
   │                     │                       │                  │
   │── isPremium? ──────▶│                       │                  │
   │ (RC SDK, fast path) │                       │                  │
```

Two paths:

1. **Hot path (no webhook)**: the mobile app calls
   `Purchases.getCustomerInfo()` and reads
   `entitlements.active.premium`. This is fine for gating UI and
   doesn't need the backend at all. Works on launch day.
2. **Cold path (webhook)**: the website needs to know "is this user
   premium?" without going through the mobile SDK. Our backend
   subscribes to RevenueCat webhooks and maintains a cached
   subscription state in our database. Required before we ship the
   web "view my activities" feature behind a paywall.

### Where the webhook handler lives

| Stack                 | Where the webhook handler runs | Cost                            |
| --------------------- | ------------------------------ | ------------------------------- |
| Option 1 (Firebase)   | Firebase Cloud Functions       | Free at our volume; needs Blaze |
| Option 2/3 (Supabase) | Supabase Edge Functions (Deno) | Free 500k invocations/mo        |
| Either                | Next.js API route on Vercel    | Free Hobby tier                 |

If we go with Web Option B (Next.js + Stripe), putting the webhook
handler on Vercel is the cleanest path because the same codebase
already talks to Stripe and to our database. If the website is
Squarespace, we'd put the handler on Cloud Functions / Edge
Functions.

### Web purchases via RevenueCat Web Billing

RevenueCat now offers a Stripe-backed web billing product. The user
buys on the website with their card; RevenueCat treats it as the same
"customer" as their Apple/Google ID via a shared `appUserId`. Same
entitlements, same webhooks, no parallel subscription state to keep
straight.

This is the killer reason to **avoid Squarespace's own subscription
product**: it lives outside the RevenueCat data model, which means
two parallel subscription states to reconcile. With RevenueCat Web
Billing + Stripe, the web upgrade path stays inside the same
entitlement system as iOS/Android.

For the sensor (one-time physical purchase), RevenueCat is overkill
and we'd just take the payment with Stripe Checkout directly. The
"30 days of premium" grant after a sensor purchase is a custom
RevenueCat "promotional grant" call from the Stripe webhook.

## Squarespace API reality check

The partner-facing doc says API access requires Advanced Commerce
($65/mo). Detail:

- **Inventory API** (read products, update stock): available on
  Business and above.
- **Orders API** (read recent orders, mark fulfilled): available on
  Commerce Basic and above. Read-only on Business.
- **Customer Profile API**, **subscription management**, **webhook
  delivery**: Advanced Commerce only.

For RowerM8, the relevant question is "can we tell our backend that a
sensor was sold so we can grant 30 days of premium to the buyer?"
There are two ways:

1. Use Squarespace's order-completed webhook (Advanced Commerce only)
   to ping our backend, and grant the entitlement via RevenueCat.
2. Skip Squarespace's commerce entirely and embed Stripe Checkout
   for the sensor sale; the Stripe webhook drives the entitlement.

Path 2 is cheaper and uses the same Stripe relationship as web
subscriptions. The Squarespace site stays as the marketing surface
plus a "Buy" button that opens Stripe Checkout. This works on the
$33/mo Business plan, no Advanced needed.

Recommended pattern, if we go with Squarespace:

- Squarespace Business ($33/mo) for marketing pages.
- Stripe Checkout (no extra fee beyond 2.9% + $0.30) for the sensor
  and any web subscriptions.
- Stripe webhook → small Vercel API route → RevenueCat promotional
  grant + our database.

This is **strictly cheaper** and **more flexible** than relying on
Squarespace's commerce APIs.

## Crash reporting: which one and when

We've not seen real production crashes yet, but the BLE + native
sensor path is the area to watch. Native iOS/Android stack traces
are where the tools differentiate.

| Tool                   | Mobile crash quality                    | Sourcemaps for JS errors | Symbolication for native | Free tier                |
| ---------------------- | --------------------------------------- | ------------------------ | ------------------------ | ------------------------ |
| Crashlytics (Firebase) | Excellent — best-in-class for native    | Reasonable               | Excellent                | Unlimited (always free)  |
| PostHog Error Tracking | Good for JS exceptions; native is newer | Yes                      | Limited                  | 100k errors/mo           |
| Sentry                 | Excellent — gold standard               | Excellent                | Excellent                | 5k errors/mo (Developer) |

**Practical heuristic**: if we go with Option 1 (Firebase), use
Crashlytics. If we go with Option 2 (Supabase + PostHog), use PostHog
Error Tracking until we hit a hard-to-diagnose native crash, then add
Sentry. Don't add Sentry preemptively — its fixed $26/mo is small but
nonzero and PostHog ET handles 90% of what we'll see.

The cost of being wrong here is at most $26/mo and a couple of hours
of integration. It's reversible.

## Feature flags: differences that matter

| Tool                          | Targeting                          | A/B experiments | Local fallback       |
| ----------------------------- | ---------------------------------- | --------------- | -------------------- |
| Firebase Remote Config        | User properties + custom cohorts   | Yes (built-in)  | Yes (default values) |
| PostHog Feature Flags         | Person properties + cohorts + JSON | Yes             | Yes                  |
| LaunchDarkly / Statsig (skip) | More powerful, $$$                 | Yes             | Yes                  |

For our "premium feature toggle" use case, both Firebase Remote
Config and PostHog Feature Flags are fine. PostHog has a nicer UI for
"show this to users in cohort X" because it shares the cohort
definition with the analytics tool — you can build a cohort from a
funnel result and immediately use it as a flag target. Firebase
Remote Config requires duplicating the cohort definition into Audiences.

If we go with Option 1, accept Remote Config and move on. If we go
with Option 2, PostHog Feature Flags is a nicer experience and is
free up to 1M flag requests/month.

## Privacy / GDPR delete flow

Both options need a "delete me" endpoint that:

1. Calls Apple's "Account Deletion API" requirement (we must offer
   account deletion in-app — App Store rule).
2. Removes the user from auth.
3. Removes all of their data from the database.
4. Asks RevenueCat to delete the subscriber via their REST API.
5. Removes them from analytics if they had identified themselves
   (PostHog `posthog.distinct_id_delete()`, Firebase Analytics has a
   user-deletion API too).

Engineering effort:

- **Supabase**: ~2 hours. `delete from users where id = $1` cascades.
- **Firebase**: ~1 day. Cloud Function walks subcollections.

Same applies to GDPR data export ("show me everything you have").
Postgres → one query, JSON serialize. Firestore → recursive read of
all subcollections, JSON serialize.

This is a real, repeatable engineering cost difference, and it
compounds if our schema grows. Not enough to single-handedly decide
the question, but worth knowing.

## Vendor risk and migration

What does it cost to switch off each vendor in 12 months?

- **RevenueCat**: low. They expose all subscription state via REST API
  - webhook history. Migrating to Adapty (their main competitor) or
    rolling our own requires re-validating receipts but is well-trodden.
- **Firebase**: medium-to-high. Firestore export → BigQuery is easy;
  Firestore export → SQL is a re-shape. Auth user export needs the
  Firebase Admin SDK and only includes the password hashes if you're
  on the right plan. Crashlytics, Analytics, Remote Config don't
  meaningfully migrate at all (you accept the data loss).
- **Supabase**: low. `pg_dump` for the database; auth users export
  is a single API call; PostHog data exports cleanly. Self-hosting
  Supabase is a documented escape hatch.
- **PostHog**: low. Self-hostable; data export via API; OSS license.
- **Sentry**: low. Self-hostable; export is easy.
- **Squarespace**: medium. Page content is a manual copy-paste job.
  Customer/order data exports as CSV. No structured migration tools.
- **Stripe**: low. The customer + payment-method object model is a
  near-standard, supported by every billing replacement (Paddle,
  Lemon Squeezy, etc.).

A reasonable lens: **the more easily a vendor lets us walk away, the
less it matters which one we pick at launch.** That favors Supabase
slightly over Firebase, RevenueCat for both, and Stripe over
Squarespace's commerce.

## Engineering effort to reach launch

Rough estimates for a single engineer working part-time, assuming we
already have the in-app guest experience (which we just shipped).

| Milestone                                               | Effort                                           |
| ------------------------------------------------------- | ------------------------------------------------ |
| Backend selection + project setup                       | 0.5 day                                          |
| Real sign-in + sign-up wired into our `AuthProvider`    | 2–3 days                                         |
| Anonymous-to-account upgrade (preserves any local data) | 1 day                                            |
| Subscriptions wired via RevenueCat (mobile)             | 2 days                                           |
| Activity summary sync to backend (one row per session)  | 1.5 days                                         |
| Public activity link page (simple read-only HTML)       | 2 days                                           |
| RevenueCat webhook handler + cached subscription state  | 1 day                                            |
| Stripe Checkout for sensor + 30-day premium grant       | 1.5 days                                         |
| GDPR delete + export endpoints                          | 1 day (Supabase) / 2 days (Firebase)             |
| Crash reporter + analytics SDK installed and identified | 0.5 day                                          |
| **Total**                                               | **~14 days** for Supabase, ~16 days for Firebase |

The 1.5–2-day delta for Firebase is real but small. Pick the stack
on architectural merits, not on this margin.

## Cost projections beyond the partner-facing doc

The partner-facing doc uses three illustrative scenarios. For our own
sanity, here's the same model with explicit assumptions:

```
Subscription mix:
  60% monthly @ $4.99
  40% annual @ $49 → $4.08 amortized
  Blended ARPU per paying user: ~$4.63 / month

Sensor: $29.99 one-time, includes 30-day premium grant
Apple/Google cut: 30% (year 1), 15% (year 2+) on subscriptions
Stripe processing on web: 2.9% + $0.30
```

| Year | MAU    | Paying subs | Sensors / yr | Gross monthly revenue (MTR) | After Apple/Google + Stripe |
| ---- | ------ | ----------- | ------------ | --------------------------- | --------------------------- |
| 1    | 200    | 20          | 30           | ~$170                       | ~$130 (most via App Store)  |
| 2    | 2,000  | 200         | 200          | ~$1,400                     | ~$1,150                     |
| 3    | 10,000 | 1,000       | 500          | ~$5,900                     | ~$4,900                     |
| 4    | 10,000 | 1,500       | 1,000        | ~$9,500                     | ~$7,900                     |

At year 1, the **entire** SaaS bill (any option) is dwarfed by the
domain registration ($15/yr). Don't over-think the choice.

## Concrete recommendation

If asked to choose today, I would advocate for:

- **Mobile**: Supabase + RevenueCat + PostHog (Option 2). With the
  per-sample sync ruled out, this is no longer about cost — it's about
  Postgres being the cleaner model for the public activity link
  feature (one query + one row-level-security policy), about saving a
  day or two on GDPR delete/export endpoints, and about PostHog being
  meaningfully better than Google Analytics for the product questions
  we'll lean on in year 1 ("which premium features keep paying users
  paying").
- **Website**: Next.js + Stripe (Web Option B), hosted on Vercel
  Hobby. Subscriptions go through RevenueCat Web Billing on top of
  Stripe so the entitlement layer stays unified.
- **Crash reporting**: PostHog Error Tracking at launch. Add Sentry
  (Option 3) only if/when we hit a real native-crash debugging
  problem.
- **Feature flags**: PostHog (comes free with Option 2).

Total monthly cost at launch: **$0**. At year-3 (10k MAU, $5.9k MTR):
**~$110–195/month**.

Reasons I'd hold this opinion lightly:

- If the team is uncomfortable with a multi-vendor setup, Option 1 +
  Web Option A is genuinely fine. The marginal complexity of the
  Postgres approach buys us flexibility we may never use.
- If the marketing team strongly wants Squarespace, run the hybrid:
  Squarespace marketing pages + Stripe Checkout for the store. Same
  RevenueCat-centric subscription architecture; only the marketing
  surface changes.

## What I want to know from the team before committing

Things I'd want answered before writing the first line of backend
code:

1. **Public-link visibility model**: is "public via unlisted slug" the
   only mode, or do we want a discoverable feed of public activities
   (a la Strava)? The latter changes the schema (search indexes,
   privacy controls).
2. **Multi-device conflict on activity upload**: with sync deferred
   to "after the activity ends", true conflicts are very rare (the
   user would have to row on two devices at once and finish at the
   same moment). The simplest answer is "each device uploads what it
   recorded; both rows persist, distinguished by their `started_at`
   timestamp". Worth confirming the team is fine with that vs. some
   form of dedup.
3. **Pre-launch beta scale**: how many users in TestFlight before
   public launch? If <100, we're free on every option for the entire
   beta and the choice is purely architectural.
4. **Marketing-team self-service**: who edits the marketing site, how
   often? If never (we're engineering-led), Next.js + Stripe wins on
   simplicity. If weekly, Squarespace pays for itself.
5. **Apple's "Sign in with Apple" hidden requirement**: it's mandatory
   any time we offer a competing third-party sign-in. We'd have to
   ship Apple sign-in in the same release as Google or email. This
   is a build issue, not a choice issue.
