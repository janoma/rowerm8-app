# Backend & SaaS Options for RowerM8

> Status: **for review**. The team will evaluate these options before any
> backend wiring is started. Once a decision is made, the chosen stack will
> be wired up in a follow-up PR (auth, subscriptions, analytics, etc.).

This document compares three concrete stacks that could power RowerM8's
backend needs. It is intentionally short on hand-wavy "best practices" and
heavy on **what you actually pay** at our target scale, **how many SaaS
accounts you'd be juggling**, and **what each option locks you into**.

## What we need to cover

| Concern                   | Why we need it                                               |
| ------------------------- | ------------------------------------------------------------ |
| User accounts (auth)      | Sign-in, sign-up, account recovery, profile metadata         |
| Subscriptions / IAP       | Premium tier on iOS App Store + Google Play (and web later)  |
| Product analytics         | Funnels, retention, "users who row > 3x/week", etc.          |
| Crash & error reporting   | Symbolicated iOS/Android crash dumps with sourcemaps         |
| Feature flags / A/B tests | Gradual rollouts, premium-feature toggles, experiments       |
| Data sync (future)        | Sync rowing activities (FIT files / metadata) across devices |
| Push notifications        | Re-engagement, "your weekly row summary"                     |

## Target scale (worst-case for cost modeling)

- **Up to 100,000 total users** (cumulative).
- **Up to 10,000 monthly active users (MAU)**.
- **Small team** (single-digit engineers) — minimizing operational
  overhead matters more than squeezing the last 10% out of any vendor.
- **Subscription revenue**: assume a paying-conversion in the 2–5% range,
  i.e. 200–500 subscribers at $5/mo → $1k–$2.5k MTR
  (Monthly Tracked Revenue, RevenueCat's term). At launch we likely sit
  inside RevenueCat's free band; once we're consistently above $2.5k MTR
  the 1% cut kicks in but is dwarfed by Apple/Google's 15-30% take.

## The non-negotiable: RevenueCat

Every option below includes **RevenueCat** for App Store / Google Play
in-app subscription management. There is no integrated "auth + analytics

- IAP" SaaS that handles iOS receipt validation, Google Play Billing, and
  restore-purchases logic well — and rolling our own is a non-trivial
  multi-week project we don't want to own. RevenueCat is the de-facto
  standard for indie/small-team apps and integrates with everything below.

* **Pricing**: Free up to **$2,500 MTR/month**, then **1% of MTR**.
  (At $1k MTR → $0/mo. At $5k MTR → $50/mo. At $25k MTR → $250/mo.)
  Source: <https://www.revenuecat.com/pricing>.
* **What it gives us**: receipt validation, entitlement checks via SDK,
  webhook stream of subscription events, paywall A/B testing, and a
  unified dashboard for cohort/churn metrics on subscribers.
* **What it doesn't give us**: user accounts, product analytics, crash
  reports. Those are what the three options below differentiate on.

# Option 1 — Firebase + RevenueCat (most integrated)

**Two SaaS accounts. One Google account, one RevenueCat account.**

Firebase covers everything except the IAP layer in a single Google Cloud
project with a single billing relationship.

| Capability             | Firebase service                               |
| ---------------------- | ---------------------------------------------- |
| Auth                   | Firebase Authentication (email, Apple, Google) |
| User / activity data   | Cloud Firestore                                |
| Crash reporting        | Crashlytics                                    |
| Product analytics      | Google Analytics for Firebase (GA4)            |
| Feature flags / config | Firebase Remote Config                         |
| A/B tests              | Firebase A/B Testing                           |
| Push notifications     | Firebase Cloud Messaging (FCM)                 |
| Subscriptions          | RevenueCat (separate account)                  |

### Approximate monthly cost at our scale

| Volume             | Firebase (Spark)       | RevenueCat | **Total** |
| ------------------ | ---------------------- | ---------- | --------- |
| 1k MAU, $0 revenue | $0                     | $0         | **$0**    |
| 5k MAU, $1k MTR    | $0                     | $0         | **$0**    |
| 10k MAU, $2.5k MTR | $0                     | $0         | **$0**    |
| 10k MAU, $10k MTR  | ~$0–10 (Blaze if used) | ~$100      | **~$100** |
| 50k MAU, $25k MTR  | ~$25–80 (Blaze writes) | ~$250      | **~$300** |

Firebase Spark (free) tier covers up to **50,000 MAU on Auth**,
**50k document reads / 20k writes per day on Firestore**, and **unlimited
Crashlytics + Analytics events**. ([Firebase pricing](https://firebase.google.com/pricing).)
A 10k MAU app that writes ~3 docs/day per user lives comfortably inside
Spark; the moment we add features that write more (live activity sync,
chat, etc.) we move to Blaze (pay-as-you-go) and costs are still tiny —
Firestore writes are $0.18 per 100k. Even at 50k MAU + heavy sync the
bill is double-digit dollars per month.

### Strengths

- **Single console for everything except IAP**. One billing account, one
  IAM, one set of credentials.
- **First-class Expo support** via `@react-native-firebase/*` config
  plugins. The Expo team's docs walk you through it.
- **Crashlytics is best-in-class** for mobile crash reporting and ships
  with the Firebase SDK at no incremental cost.
- **Generous free tier** — we're free at launch and likely free at 10k
  MAU.
- **Remote Config + A/B Testing** lets us flip on premium features for
  cohorts without shipping a new build.

### Trade-offs

- **GA4 is a step down from PostHog** for ad-hoc product analytics.
  Funnels, cohort drilldowns, and event property exploration are all
  noticeably clunkier; expect to lean on BigQuery export for non-trivial
  questions.
- **Firestore data model lock-in**. Future migration off Firestore means
  rewriting queries against a relational schema. Mitigation: keep
  documents flat and export nightly to BigQuery / GCS.
- **Vendor concentration**: Google decides our pricing model. They
  already deprecated several Firebase products (Crashlytics for non-Spark
  is fine, but Dynamic Links was killed; Test Lab is being shuffled).
- **No session replay** out of the box (we'd add LogRocket / PostHog
  later if we ever need it — adds a 3rd account at that point).

# Option 2 — Supabase + RevenueCat + PostHog (best-of-breed, 3 accounts)

**Three SaaS accounts.** Supabase replaces Firebase for auth + data;
PostHog covers analytics + flags + crash reporting in one place.

| Capability             | Service                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| Auth                   | Supabase Auth (email, Apple, Google, magic-link)                        |
| User / activity data   | Supabase Postgres                                                       |
| Crash + error tracking | PostHog Error Tracking                                                  |
| Product analytics      | PostHog Product Analytics                                               |
| Feature flags / A/B    | PostHog Feature Flags + Experiments                                     |
| Session replay         | PostHog Session Replay                                                  |
| Push notifications     | Supabase Edge Functions + APNs/FCM (DIY) **or** OneSignal (4th account) |
| Subscriptions          | RevenueCat                                                              |

### Approximate monthly cost at our scale

| Volume             | Supabase            | PostHog             | RevenueCat | **Total**     |
| ------------------ | ------------------- | ------------------- | ---------- | ------------- |
| 1k MAU, $0 revenue | $0 (Free)           | $0                  | $0         | **$0**        |
| 5k MAU, $1k MTR    | $0 (Free)           | $0                  | $0         | **$0**        |
| 10k MAU, $2.5k MTR | $0–25 (Free or Pro) | $0                  | $0         | **$0–25**     |
| 10k MAU, $10k MTR  | $25 (Pro)           | $0–10 (under 1M ev) | ~$100      | **~$130**     |
| 50k MAU, $25k MTR  | $25–60 (Pro)        | ~$25–75             | ~$250      | **~$320–385** |

- **Supabase Free**: 50k MAU, 500 MB database, 1 GB storage, projects
  pause after 1 week of inactivity. Pro plan **$25/mo** lifts to 100k
  MAU (then $0.00325/MAU), 8 GB DB, 250 GB egress, daily backups.
  Source: <https://supabase.com/pricing>.
- **PostHog Free**: 1M events/mo for product analytics, 100k errors/mo
  for crash tracking, 1M feature-flag requests, 5k session replays. At
  10k MAU and ~50 events/MAU/day (high) we'd land around 15M events/mo
  → ~$60–75 PostHog bill. The free tier covers small/medium apps for
  free; metered overage scales linearly. Source:
  <https://posthog.com/pricing>.

### Strengths

- **You own the schema (Postgres)**. Migrating off Supabase later is a
  `pg_dump` away — no rewrite. Great for long-term insurance.
- **PostHog is dramatically better than GA4** for product analytics:
  funnel exploration, cohort definitions, formula-based metrics, and
  session replay all in the same UI.
- **Mobile session replay** is unique among the options — invaluable for
  reproducing weird touch sequences during stroke detection.
- **Open-source escape hatch**: Supabase is OSS; PostHog is OSS. Both
  can be self-hosted if SaaS pricing ever bites (we wouldn't, but the
  optionality is reassuring).
- **Supabase Auth is excellent** — magic links, OAuth, anonymous-to-real
  account upgrade flow, Apple sign-in (required by App Store), all built
  in. Row-level security lets us write policies once instead of guarding
  every API call.

### Trade-offs

- **Three accounts, three billing relationships**. Slightly more invoice
  management; modest in absolute terms but real.
- **PostHog mobile crash reporting is newer than Sentry's**. It works,
  but if a fancy iOS native crash with a stripped symbol table needs
  resolving, Sentry would do a better job (see Option 3).
- **Push notifications need either Edge Functions + DIY APNs/FCM or a
  4th account (OneSignal)**. Firebase wins on this front for being
  built-in.
- **Supabase availability** has historically been less rock-solid than
  Firebase's at the free tier (incidents are louder because you can see
  them in the open Slack). Pro plan SLA is fine.

# Option 3 — Supabase + RevenueCat + Sentry + PostHog (4 accounts, max polish)

Same as Option 2, but split crash reporting from PostHog into Sentry —
the gold standard for mobile crash dumps.

| Capability              | Service    |
| ----------------------- | ---------- |
| Auth + data             | Supabase   |
| Crash + perf monitoring | Sentry     |
| Product analytics       | PostHog    |
| Feature flags / A/B     | PostHog    |
| Session replay          | PostHog    |
| Subscriptions           | RevenueCat |

### Approximate monthly cost at our scale

| Volume             | Supabase | PostHog | Sentry (Team) | RevenueCat | **Total**     |
| ------------------ | -------- | ------- | ------------- | ---------- | ------------- |
| 1k MAU, $0 revenue | $0       | $0      | $0 (Dev)      | $0         | **$0**        |
| 5k MAU, $1k MTR    | $0       | $0      | $0–26         | $0         | **$0–26**     |
| 10k MAU, $2.5k MTR | $25      | $0      | $26           | $0         | **~$51**      |
| 10k MAU, $10k MTR  | $25      | $0–10   | $26           | ~$100      | **~$160**     |
| 50k MAU, $25k MTR  | $25–60   | ~$25–75 | $26–80        | ~$250      | **~$340–465** |

- **Sentry Team plan**: $26/mo (annual), 50k errors/mo included; $0.0003625
  per overage error. With a stable build we expect well under 50k
  errors/mo. Source: <https://sentry.io/pricing>.
- Free Sentry "Developer" plan handles 5k errors/mo at $0 — enough for
  pre-launch and small private betas.

### Strengths

- **Best-in-class crash reporting**. Sentry's iOS/Android symbolication,
  ANR detection, and stack-trace UX are still better than anyone else's.
- All other strengths of Option 2 (Postgres ownership, PostHog analytics
  - replay, etc.).

### Trade-offs

- **Four accounts**, four invoices, four sets of credentials, four IAM
  systems to keep tidy.
- Two services overlap on "errors" — PostHog Error Tracking and Sentry
  both ingest exceptions. We'd point our SDK at Sentry only and use
  PostHog purely for product analytics + flags + replay; otherwise we
  pay twice.
- Highest fixed monthly cost of the three (Sentry adds the only
  baseline-cost item: $26/mo regardless of volume on the Team plan).

# Quick comparison

| Dimension                        | Option 1 (Firebase) | Option 2 (Supabase+PostHog) | Option 3 (+ Sentry) |
| -------------------------------- | ------------------- | --------------------------- | ------------------- |
| SaaS accounts                    | **2**               | 3                           | 4                   |
| Cost @ launch (1k MAU, $0)       | **$0**              | **$0**                      | $0                  |
| Cost @ 10k MAU, $2.5k MTR        | **$0**              | $0–25                       | ~$51                |
| Cost @ 50k MAU, $25k MTR         | **~$300**           | ~$320–385                   | ~$340–465           |
| Auth quality                     | Excellent           | **Excellent**               | **Excellent**       |
| Mobile crash reports             | **Crashlytics**     | PostHog (newer)             | **Sentry (best)**   |
| Product analytics                | GA4 (OK)            | **PostHog (great)**         | **PostHog (great)** |
| Session replay (mobile)          | none                | **PostHog**                 | **PostHog**         |
| Feature flags / A/B              | Remote Config + A/B | **PostHog**                 | **PostHog**         |
| Push notifications               | **FCM built-in**    | DIY or OneSignal            | DIY or OneSignal    |
| Schema portability               | Firestore lock-in   | **Postgres dump**           | **Postgres dump**   |
| Expo / RN integration smoothness | **Excellent**       | Excellent                   | Excellent           |
| Operational overhead             | **Lowest**          | Medium                      | Highest             |

## Recommendation framing (for the team to decide)

We'd lean on these heuristics:

- If our top constraints are **fewest-vendors** and **lowest cost**:
  **Option 1 (Firebase + RevenueCat)**. Two accounts, free at launch,
  ~$300/mo at 50k MAU. Crashlytics is great. The trade-off you accept is
  GA4 instead of PostHog for analytics and Firestore lock-in for data.
- If **product-analytics quality and schema portability** matter more
  than vendor count: **Option 2 (Supabase + PostHog + RevenueCat)**.
  Three accounts, very similar total cost, but a much better analytics
  story and you own a Postgres database.
- If **iOS/Android crash quality** is critical (e.g. native crashes in
  the BLE / sensor path are common pain): **Option 3** adds Sentry. The
  marginal cost is the smallest piece of the bill once subscriptions
  scale, and the troubleshooting time saved on tricky native crashes
  generally pays for it.

For RowerM8 specifically — small team, mobile-only, not many crashes
expected once stroke detection stabilizes, but with a strong product-
analytics need (we'll want to understand which sensor placements
correlate with retention) — the **Option 1 vs Option 2** split is the
real question. **Option 3** is a future upgrade path from Option 2 if
crash reporting ever becomes a bottleneck.

## Notes on caveats and assumptions

- All prices are **list prices in USD as of the document date** and do
  not include enterprise discounts, promo credits, or annual prepay
  discounts. Vendors change pricing without much notice; treat the
  numbers as **order-of-magnitude estimates**.
- "MAU" is defined slightly differently by each vendor (Firebase counts
  any auth-active user; Supabase counts users who hit the API; PostHog
  doesn't gate on MAU). The columns above use _our_ internal MAU
  estimate (10k or 50k) and translate it to each vendor's metric.
- App Store / Google Play take their **15–30% cut** before any of these
  vendors see revenue. RevenueCat's MTR is gross (pre-cut) by design.
- We assume our analytics event volume is "moderate" for a fitness app:
  ~30–80 events/MAU/day. If we instrumented every accelerometer sample
  we'd blow PostHog's free tier on day one, but that's never the
  intent — we'd track sessions, screens, and key feature use.

## Open questions for the team

1. Are there hard requirements (e.g. EU data residency, HIPAA-style
   audit) that would rule out any of these vendors?
2. Do we need server-side webhook handling for subscription events on
   day one, or can we live entirely on client-side entitlement checks
   (RevenueCat's SDK answers "is the user pro?" with one call) and add
   webhooks later?
3. Is push notification a launch requirement? If yes, Firebase's bundled
   FCM is a meaningful tilt toward Option 1.
4. Activity-history sync: do we want it at launch (push the team toward
   committing to Postgres or Firestore now), or is "FIT files stay on
   device" acceptable for the first release?
