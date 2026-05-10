# Backend & Web Options for RowerM8

> **Status: for review.** This document is for the team to read together
> and pick a direction. Once we agree, an engineer will wire up the
> chosen tools. Nothing has been committed to yet.
>
> _Engineering counterpart: there is a sister document with the technical
> details (data models, migration costs, webhook plumbing, etc.) at
> [`backend-options-engineering-notes.md`](./backend-options-engineering-notes.md).
> Non-engineers can ignore it._

## How to read this document

The goal is to pick a small set of online services ("the stack") that
together do the things RowerM8 needs:

- store user accounts, log them in, and let them recover passwords
- let people pay for the premium subscription (and one-time sensor)
- let us see how the app is being used (which screens are popular, etc.)
- alert us when the app crashes
- run gradual rollouts of new features (turn a feature on for 10% of
  users at first)
- sync each user's rowing activities to the cloud so they see them on
  every device, and so we can publish each activity at a public link
  (per the team's plan to make activities shareable)
- power the website (sensor store, subscriptions, "view my activities")

A short glossary lives at the bottom. Acronyms are spelled out the first
time they appear.

## Our scale and revenue assumptions

These are the numbers we use to estimate every monthly bill below. They
are deliberately conservative.

- **Up to 100,000 total accounts** (cumulative — every person who has
  ever signed up).
- **Up to 10,000 monthly active users** (people who open the app at
  least once a month — we'll abbreviate this as **MAU**).
- **Small team** — fewer than five engineers; we want each tool to be
  low-maintenance.

Pricing model (working assumption, can change):

- **Sensor package**: $29.99 one-time, includes 30 days of premium.
- **Premium**: $4.99 / month or $49 / year (saves about 18%).
- **Free tier**: very limited (free row, basically nothing else).

Three illustrative scenarios for the cost tables below. They take the
average revenue per paying user (about $4.60 / month, after blending
monthly and annual plans) and add the sensor sales:

| Scenario   | Total accounts | MAU    | Paying subscribers | Sensors sold / year | Gross monthly revenue |
| ---------- | -------------- | ------ | ------------------ | ------------------- | --------------------- |
| **Launch** | 1,000          | 200    | 20                 | 30                  | ~$170                 |
| **Growth** | 10,000         | 2,000  | 200                | 200                 | ~$1,400               |
| **Steady** | 50,000         | 10,000 | 1,000              | 500                 | ~$5,900               |
| **Cap**    | 100,000        | 10,000 | 1,500              | 1,000               | ~$9,500               |

> "Gross monthly revenue" is the dollar amount that flows in _before_
> Apple/Google take their cut on in-app purchases (15–30%) and _before_
> any of the tools below take their share. It's the number RevenueCat
> calls "Monthly Tracked Revenue" or **MTR**.

## The two required pieces (regardless of the option)

Every option below includes the same two services to handle in-app
purchases and global privacy compliance. We don't have a real choice
about these.

### 1. RevenueCat — for managing subscriptions on iOS / Android

When someone buys a subscription inside the iOS or Android app,
Apple and Google handle the payment (and take a 15–30% cut). What's
hard is everything around that: knowing who is currently paying, who
has cancelled, who upgraded, restoring past purchases, sending receipts
to our backend. **RevenueCat** is a service that solves all of this.
Every modern indie / small-team app uses it (or their direct
competitor, Adapty); building it ourselves is a multi-week project we
shouldn't take on.

**What it costs.** Free up to **$2,500 / month of Monthly Tracked
Revenue (MTR)**. Above that, RevenueCat charges 1% of MTR.

| Scenario | RevenueCat fee |
| -------- | -------------- |
| Launch   | $0             |
| Growth   | $0             |
| Steady   | ~$59 / month   |
| Cap      | ~$94 / month   |

Source: <https://www.revenuecat.com/pricing>

### 2. Privacy & data-retention compliance

Because we'll have users in the European Union, the United Kingdom,
Brazil, California, and other places, we need to comply with each
region's privacy laws. The most demanding is the EU's **GDPR** (General
Data Protection Regulation), which is increasingly the global baseline.
Practically that means we must be able to:

- show a user every piece of data we hold about them,
- delete that data on request, fully, within 30 days,
- record their explicit consent for any analytics tracking,
- store passwords / personal data inside reputable services that have
  signed equivalent paperwork with us.

All three options below can satisfy this; the difference is how much
manual work it takes. **Supabase** (Option 2 / 3) makes deletion
particularly easy because the data sits in a normal database we can
query. **Firebase** (Option 1) requires a small amount of custom code
to walk the user's documents and delete them.

There is no extra fee from any of the listed services for GDPR
compliance — but we do need to budget a couple of engineering days to
build the export/delete flow, regardless of which option we pick.

# Option 1 — Firebase + RevenueCat

**Two service providers in total. One Google account, one RevenueCat
account.**

Firebase is a Google product that bundles almost everything we need
into one console: sign-in, a database, crash reports, analytics,
feature flags. RevenueCat handles the subscriptions on top.

| Need we have                | Tool that handles it                           |
| --------------------------- | ---------------------------------------------- |
| Sign-in / sign-up           | Firebase Authentication (email, Apple, Google) |
| User profiles & activity DB | Firebase Firestore (the database)              |
| Crash reports               | Firebase Crashlytics                           |
| App usage analytics         | Google Analytics for Firebase                  |
| Feature flags / A/B tests   | Firebase Remote Config + A/B Testing           |
| Subscriptions               | RevenueCat (separate account)                  |

### What we'd pay (mobile app only, website handled separately below)

| Scenario | Firebase             | RevenueCat | **Mobile total** |
| -------- | -------------------- | ---------- | ---------------- |
| Launch   | $0 (free tier)       | $0         | **$0**           |
| Growth   | $0 (free tier)       | $0         | **$0**           |
| Steady   | ~$30–80 (paid tier)  | ~$59       | **~$90–140**     |
| Cap      | ~$60–150 (paid tier) | ~$94       | **~$155–245**    |

Firebase is free up to 50,000 sign-in users and 50k database reads /
20k database writes per day. We hit the paid tier (called "Blaze")
once we're syncing every user's rowing activities to the cloud, which
the team has decided is required for premium. The numbers above are
the order of magnitude — the actual bill could vary by a factor of 2
depending on how often each device syncs.

Source: <https://firebase.google.com/pricing>

### Strengths

- Fewest moving parts. One console, one bill (besides RevenueCat).
- Crashlytics is the most respected mobile crash reporting product —
  if the app misbehaves, it tells us exactly where, complete with
  device model and OS version.
- Free during the launch and growth phases.
- Engineering integration with our app framework (Expo) is the
  smoothest of the three options.

### Trade-offs

- Google Analytics is fine but noticeably less powerful than the
  PostHog tool used in the other options — more clicks to answer
  questions like "what % of premium users row at least 3 times a week?"
- The database (Firestore) stores data as JSON-like documents, not as
  rows in a normal database. If we ever wanted to leave Firebase, we'd
  need to convert that data to a different shape — doable, but not
  cheap.
- Google has a track record of shutting down products with limited
  notice. Firebase's core offerings are safe, but we should not bet on
  any of its newer add-ons.

# Option 2 — Supabase + RevenueCat + PostHog

**Three service providers.**

Supabase is the open-source equivalent of Firebase, but built on top of
a standard database (PostgreSQL). PostHog covers analytics, feature
flags, and crash reporting in a single tool with a much sharper
analytics experience than Google Analytics.

| Need we have                | Tool that handles it                             |
| --------------------------- | ------------------------------------------------ |
| Sign-in / sign-up           | Supabase Auth (email, Apple, Google, magic link) |
| User profiles & activity DB | Supabase Postgres                                |
| Crash reports               | PostHog Error Tracking                           |
| App usage analytics         | PostHog Product Analytics                        |
| Feature flags / A/B tests   | PostHog Feature Flags                            |
| Session replay              | PostHog Session Replay (bonus — see below)       |
| Subscriptions               | RevenueCat                                       |

### What we'd pay (mobile app only)

| Scenario | Supabase | PostHog  | RevenueCat | **Mobile total** |
| -------- | -------- | -------- | ---------- | ---------------- |
| Launch   | $0       | $0       | $0         | **$0**           |
| Growth   | $0–25    | $0       | $0         | **$0–25**        |
| Steady   | $25–60   | ~$25–75  | ~$59       | **~$110–195**    |
| Cap      | $60–120  | ~$50–120 | ~$94       | **~$205–335**    |

- **Supabase**: free up to 50,000 monthly active users in the database;
  Pro plan is $25 / month (up to 100,000 MAU, plenty of storage,
  daily backups).  
  Source: <https://supabase.com/pricing>
- **PostHog**: free for up to 1 million analytics events / month and
  100,000 errors / month; meter ticks afterwards (about $0.00005 per
  event at the lowest tier).  
  Source: <https://posthog.com/pricing>

### Strengths

- We own the database. The data sits in a standard Postgres database,
  so if we ever leave Supabase we run one export command and we're
  done. (This is meaningful insurance if the company changes
  ownership.)
- PostHog's analytics is dramatically better than Google's for the
  kind of question we'll actually ask ("Do people who use a heart-rate
  monitor stay subscribed longer?").
- **Session replay** is included — we can watch (anonymized) recordings
  of confusing user sessions. Very useful when someone reports that
  "the connect button does nothing".
- Both Supabase and PostHog are open-source: in the unlikely case
  pricing becomes an issue we could host them ourselves.

### Trade-offs

- Three accounts to manage, three invoices, three sets of credentials.
  Real overhead, just not large.
- PostHog's mobile crash reporting is solid but newer than Crashlytics
  or Sentry. For most crashes it's fine; for unusually weird native
  crashes it can be slightly less sharp.

# Option 3 — Supabase + RevenueCat + Sentry + PostHog

**Four service providers.** Same as Option 2 but with **Sentry** added
for top-tier crash reporting.

This is the same picture as Option 2, except PostHog stops doing crash
reports and Sentry takes over. Sentry is the gold standard for mobile
crash diagnosis — when a customer complains "the app crashes when I
tap Connect", Sentry will already have the stack trace, the device
model, and even a video of the crash waiting for the engineer.

### What we'd pay (mobile app only)

| Scenario | Supabase | PostHog  | Sentry    | RevenueCat | **Mobile total** |
| -------- | -------- | -------- | --------- | ---------- | ---------------- |
| Launch   | $0       | $0       | $0 (free) | $0         | **$0**           |
| Growth   | $0–25    | $0       | $26       | $0         | **$26–51**       |
| Steady   | $25–60   | ~$25–75  | $26–80    | ~$59       | **~$135–275**    |
| Cap      | $60–120  | ~$50–120 | $26–80    | ~$94       | **~$230–415**    |

Sentry's Team plan is $26 / month for up to 50,000 errors per month;
the free Developer tier covers 5,000 errors / month and is enough until
we have real users.  
Source: <https://sentry.io/pricing>

### Strengths and trade-offs

Same as Option 2, plus best-in-class crash quality. Cost is only
slightly higher than Option 2 in absolute terms — the marginal $26 to
$80 / month is a rounding error once subscription revenue is steady.
The price you pay is the fourth account.

# The website (separate decision, can be picked independently)

The website needs to do three things:

1. Sell the **sensor package** (one physical product).
2. Sell the **premium subscription** for users who'd rather pay on the
   web than through the app.
3. Show a logged-in user their **rowing activities**, and serve a
   public link for each activity that anyone can open.

There are two reasonable shapes here.

### Web option A — Squarespace (or similar) for store + small custom site for activities

The team mentioned Squarespace specifically. Squarespace is a website
builder that includes a store. It's friendly to non-engineers, has
nice templates, and handles SEO and email forms out of the box.

What it costs:

| Squarespace plan      | Monthly (annual billing) | Notes                                                                        |
| --------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| Business              | $33 / month              | 3% extra fee on each sale (on top of Stripe's ~3%)                           |
| Basic Commerce        | $36 / month              | No Squarespace transaction fee                                               |
| **Advanced Commerce** | **$65 / month**          | The only plan with API access — you'd need this to support **subscriptions** |

Source: <https://www.squarespace.com/pricing>

> **Important caveat for the team:** Squarespace's selling-point for us
> is the polished store. But subscriptions and any "let our website
> read user data" feature require the Advanced Commerce plan ($65 /
> month). On the cheaper plans we could still sell the sensor, but
> not memberships.

The "show your activities" page would NOT be on Squarespace itself.
We'd build a small custom page (probably a single-page app on a
subdomain like `app.rowerm8.com`) that talks directly to whichever
backend we picked above (Firebase or Supabase). This custom page is
free to host on Vercel or Cloudflare Pages at our scale.

**Approximate website monthly cost:**

- Domain: ~$15 / year ($1.25 / month)
- Squarespace Basic Commerce: $36 / month (or $65 / month for the
  Advanced plan if we sell subscriptions on web)
- Stripe processing fee on each sale: 2.9% + $0.30 (on the $29.99
  sensor, that's ~$1.17 per sale)
- Custom activity page hosting: $0 (free tier)
- **Total**: $36 – $65 / month plus per-sale processing fees.

### Web option B — Build a custom site with Next.js + Stripe

Next.js is a popular framework for building marketing + e-commerce
sites. Stripe powers the payments directly (no e-commerce middleman).
We'd host the whole thing on Vercel.

| Item                           | Cost                                 |
| ------------------------------ | ------------------------------------ |
| Vercel hosting (Hobby tier)    | $0 — likely sufficient at our scale  |
| Vercel Pro (if we outgrow)     | $20 / month per developer            |
| Stripe processing fee per sale | 2.9% + $0.30 (same as Squarespace)   |
| Domain                         | ~$15 / year                          |
| **Total**                      | **$0 – $20 / month** plus processing |

Strengths:

- Cheaper at every scale.
- Full control. The "show your activities" page is a normal page on
  the same site instead of a bolted-on subdomain.
- Subscriptions are easy: Stripe Checkout + RevenueCat's web billing
  integration share the same subscriber list as the iOS / Android app.
- The same database powers the mobile app and the website, so a public
  activity link is just a URL on the marketing site.

Trade-offs:

- This is a build job (likely one to two weeks of engineering for a
  basic shop + activity page). Squarespace is mostly drag-and-drop.
- Marketing-team self-service (e.g., the team adding a blog post,
  changing copy on the homepage) is harder than Squarespace.

### A third path worth knowing about — Shopify

If we want a more dedicated commerce experience for the sensor, Shopify
Basic is $29 / month (annual) and is more focused on physical-product
sales than Squarespace. The same caveats apply — we'd still need a
separate place for the activity page. Shopify also charges 2.9% + $0.30
on each card sale (via Shopify Payments), the same as Stripe.

Source: <https://www.shopify.com/pricing>

# Putting it all together

The mobile-app stack and the website choice are independent. Combined
monthly bills look like:

| Combination                                           | At Launch | At Cap (~$9.5k revenue) |
| ----------------------------------------------------- | --------- | ----------------------- |
| Option 1 (Firebase) + Web option B (Next.js)          | **$0**    | ~$155 – $265            |
| Option 1 (Firebase) + Web option A (Squarespace)      | $36       | ~$190 – $310            |
| Option 2 (Supabase + PostHog) + Web option B          | **$0**    | ~$205 – $355            |
| Option 2 (Supabase + PostHog) + Web option A          | $36       | ~$240 – $400            |
| Option 3 (Supabase + Sentry + PostHog) + Web option B | ~$26      | ~$230 – $435            |

**For a quick gut-check**: at our cap (~$113k / year of gross revenue)
the most expensive combination above costs us about $5,200 / year.
That's roughly 5% of revenue. The cheapest is closer to 1.5%.

# Strong opinions, lightly held

If we were forced to pick today:

- **Cheapest, fewest tools, fastest to set up**: \*\*Option 1 (Firebase)
  - Web option B (Next.js)\*\*. Two SaaS accounts. Free at launch. Around
    $200 / month at our cap.
- **Best long-term flexibility**: **Option 2 (Supabase + PostHog) +
  Web option B (Next.js)**. We own a real database and have first-class
  product analytics. About $30 / month more than Option 1 at the cap;
  similar at small scale.
- **For the marketing team to self-serve the website**: pair either
  mobile option with **Web option A (Squarespace)** — they can edit
  copy without engineering involvement. Cost is +$36 to $65 / month
  versus the custom site.

The recommendation we landed on while writing this is **Option 2 +
Squarespace for now**. The reasoning, in plain language:

1. The data being premium-gated and shareable via public links is a
   core feature, and that's exactly what a normal database (Postgres)
   handles best.
2. PostHog will tell us which premium features actually drive paying
   users, which matters most in year 1.
3. Squarespace gets the sensor on sale next week without engineering
   work; we can still migrate to a custom site later without losing
   the Squarespace investment (it's just a different URL).

But this is a coin-flip-class decision against Option 1 + Squarespace,
and we should not block on a perfect answer. Either choice works.

# Glossary

- **API** (Application Programming Interface): a programmatic doorway
  that lets one piece of software fetch data from another. We use
  these to talk to RevenueCat, Firebase, etc.
- **Backend / database**: the part of a service that stores data and
  does work behind the scenes. Users don't see it directly.
- **GDPR** (General Data Protection Regulation): the EU's privacy
  law, increasingly the global standard. It gives users the right to
  see, export, and delete their data.
- **IAP** (In-App Purchase): a payment made inside an iOS or Android
  app. Apple and Google take a cut of every IAP (15–30%), regardless
  of which company we use to manage the subscription.
- **MAU** (Monthly Active Users): the count of distinct users who open
  the app at least once in a given calendar month. Our cap is 10,000.
- **MTR** (Monthly Tracked Revenue): the total of all subscription and
  one-time-purchase revenue in a month, before Apple/Google's cut.
  RevenueCat uses this number to bill us.
- **SaaS** (Software-as-a-Service): a tool we pay for monthly that
  someone else hosts. Firebase, Supabase, RevenueCat, etc.
- **SDK** (Software Development Kit): the package an engineer drops
  into the app to talk to a service.
- **Webhook**: a notification that one service sends to another when
  something happens. Example: RevenueCat tells our backend "user 123
  just cancelled their subscription".

# Open questions for the team

1. The illustrative scenario numbers above (paying-user counts, sensor
   sales) — are they realistic? Bigger numbers move us to the paid
   tiers of every option faster, but the _ranking_ of the options
   doesn't change much.
2. Squarespace vs. a custom Next.js site: do we want the marketing
   team to self-serve copy changes (Squarespace) or do we prefer the
   tighter integration of a single codebase (Next.js)?
3. Is anyone on the team strongly opposed to a Google relationship
   (Firebase) for any reason? It's the simplest option but also the
   one with the most vendor concentration.
