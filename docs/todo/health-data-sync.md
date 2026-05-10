# Health-data sync (HealthKit / Health Connect)

Status: planning. This document is intentionally agent-ready — sections
are sized so each phase can be turned into a CreatePlan call without
further discussion. Last reviewed: see `git log --follow` on this file.

## 1. Goal & rationale

The user already enters their profile manually in
`app/(tabs)/settings/profile.tsx`:

- Max HR (changes rarely; default ~190).
- Threshold HR / LTHR (changes rarely; default ~85% of max).
- Body weight (drifts with training cycles; default 75 kg).
- Age (ticks once a year; default 35).
- Biological sex (typically stable; default male).

Plus a chosen HR-zone display model (`garminPolar5` / `cogganFriel7`).

The OS health stores already track most of this, and the watch / phone
already collect live HR. Letting the user opt in to a one-way (or
two-way) sync gives them:

- One source of truth for body weight (so kg→lb conversions and
  Keytel calorie estimates stay accurate as weight drifts).
- Automatic age (computed from DOB rather than a hard-coded year).
- Biological sex from a system-managed source.
- Optional live HR from the Apple Watch / Wear OS without requiring a
  paired BLE strap.
- Two-way sync of completed rowing workouts so they show up on Apple
  Health / Google Fit / Health Connect alongside other activities.

LTHR and Max HR are sport- and user-derived — neither HealthKit nor
Health Connect ships them as standard read targets — so those will
remain in our app's profile screen.

## 2. What HealthKit and Health Connect actually expose

### iOS (HealthKit)

| Profile field    | HK type                                       | Notes                                                                                             |
| ---------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `weightKg`       | `HKQuantityTypeIdentifierBodyMass`            | Most recent sample. Available as a quantity in `HKUnit.gramUnitWithMetricPrefix(.kilo)`.          |
| `ageYears`       | `HKCharacteristicTypeIdentifierDateOfBirth`   | DOB only; we compute age. Read once per launch is fine.                                           |
| `sex`            | `HKCharacteristicTypeIdentifierBiologicalSex` | Returns `male`/`female`/`other`/`notSet`. Map `male`/`female` directly; treat the rest as `null`. |
| Live HR          | `HKQuantityTypeIdentifierHeartRate`           | Stream via `HKAnchoredObjectQuery` + `HKObserverQuery`; rate ~1 Hz when actively measured.        |
| Resting HR (opt) | `HKQuantityTypeIdentifierRestingHeartRate`    | One sample per night/day; not actionable in real-time but useful to seed defaults.                |
| Max HR           | -                                             | Not stored; computed downstream by some apps. Stays in our profile.                               |
| LTHR             | -                                             | Not stored. Stays in our profile.                                                                 |

Workouts (write):

- `HKWorkoutTypeIdentifier` with `HKWorkoutActivityType.rowing` (indoor
  rowing is reported as `.rowing` on iOS 14+).
- Total energy (`HKQuantityTypeIdentifierActiveEnergyBurned`) and total
  duration; samples can be associated with the workout (HR series).

### Android (Health Connect)

| Profile field | HC record type           | Notes                                                                                |
| ------------- | ------------------------ | ------------------------------------------------------------------------------------ |
| `weightKg`    | `WeightRecord`           | Most recent sample. Float kg.                                                        |
| `ageYears`    | -                        | Health Connect does not store DOB. Stays in our profile.                             |
| `sex`         | -                        | Not standard. Stays in our profile.                                                  |
| Live HR       | `HeartRateRecord`        | Per-sample series; latency depends on the source app (Wear OS / chest strap bridge). |
| Resting HR    | `RestingHeartRateRecord` | Available; same caveats as iOS.                                                      |
| Max HR        | -                        | Not standard.                                                                        |
| LTHR          | -                        | Not standard.                                                                        |

Workouts (write):

- `ExerciseSessionRecord` with `EXERCISE_TYPE_ROWING_MACHINE` (indoor)
  or `EXERCISE_TYPE_ROWING` (outdoor), wrapped in
  `TotalCaloriesBurnedRecord` and `HeartRateRecord` series.
- Health Connect requires a permission tier per record; rowing-machine
  is in the standard exercise list since HC v1.0.

Caveat: if the device is below Android 14, Health Connect installs as a
sideload APK on Android 12/13 ("Health Connect by Android") and is
unavailable on older. Expect a non-trivial fraction of users with no
backend at all on Android — fallback to manual profile values must
remain bullet-proof.

## 3. Library options & trade-offs

### iOS

| Library                              | Status           | Trade-offs                                                                                                                    |
| ------------------------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `@kingstinct/react-native-healthkit` | Active, TS-first | Best DX (typed quantities/units), MIT, Expo config plugin available. Recommended.                                             |
| `react-native-health`                | Older, JS-first  | Wider feature surface (sleep, ECG, …) but typing is loose; community-maintained. Workable if the king library lags a feature. |
| Native module from scratch           | -                | Only if both above prove insufficient for a specific HKAnchoredObjectQuery configuration we want.                             |

Both ship as Expo config plugins so we don't need to eject; they
register `NSHealthShareUsageDescription` /
`NSHealthUpdateUsageDescription` and the HealthKit entitlement in
`app.json` extras at prebuild time.

### Android

| Library                                | Status      | Trade-offs                                                                                                                           |
| -------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `react-native-health-connect`          | Active      | Mirrors the official Health Connect Java SDK; permission model is well-typed. Recommended. Expo config plugin needs hand-validation. |
| Google Fit (`react-native-google-fit`) | Deprecating | Don't add new code paths for Fit; Google will sunset it for new apps in favour of Health Connect by 2026.                            |

## 4. Permissions & manifest plumbing

### iOS

`app.json` extras → `expo-build-properties` → iOS:

- `NSHealthShareUsageDescription`: "RowerM8 reads your heart rate,
  weight, age and sex from Apple Health to keep your profile and
  calorie estimates up to date."
- `NSHealthUpdateUsageDescription`: "RowerM8 saves completed rowing
  activities to Apple Health so they show up alongside your other
  workouts."
- HealthKit entitlement (`com.apple.developer.healthkit`).
- Privacy Nutrition Label: "Health & Fitness" → "Used for app
  functionality, not linked to user identity".

Runtime: a single `HKHealthStore.requestAuthorization` call covering
all needed read + write types. iOS 17+ surfaces a granular per-type
toggle; we must handle "user granted weight but not HR" cleanly.

### Android

`AndroidManifest.xml` (via Expo plugin):

```xml
<uses-permission android:name="android.permission.health.READ_WEIGHT" />
<uses-permission android:name="android.permission.health.READ_HEART_RATE" />
<uses-permission android:name="android.permission.health.READ_RESTING_HEART_RATE" />
<uses-permission android:name="android.permission.health.WRITE_EXERCISE" />
<uses-permission android:name="android.permission.health.WRITE_HEART_RATE" />
<uses-permission android:name="android.permission.health.WRITE_TOTAL_CALORIES_BURNED" />
```

Plus a Health Connect rationale activity (mandatory per Health Connect
policy) — a screen explaining why each permission is requested,
linkable from the system permissions dialog.

Runtime: Health Connect routes permission requests through its own UI.
We must handle a missing-app case (Health Connect not installed on
older Android) by deep-linking to the Play Store.

## 5. Phased rollout proposal

The phases are deliberately sized so each can be a single C-numbered
commit (or a pair).

### P1 — Read static profile

Scope:

- Add an "Auto-fill from Health" CTA on the Profile screen for both
  platforms.
- Tap → triggers permission prompt → on grant, populate `weightKg`,
  `ageYears` (computed from DOB on iOS), `sex` (iOS only) into
  `ProfilePrefs` _unless_ the user has already typed a value for that
  field.
- New `manualOverride: Record<keyof ProfilePrefs, boolean>` flag in
  `ProfilePrefs` (or equivalent) so we know whether HK should clobber
  on subsequent reads.
- New `lib/health/adapters.ts` (pure) that converts
  HealthKit/Health Connect sample shapes into a `Partial<ProfilePrefs>`
  patch — testable in node with mocked sample inputs.

Files touched (estimate):

- `lib/health/adapters.ts` (new, pure)
- `lib/health/healthkit.native.ts` (new, iOS)
- `lib/health/health-connect.native.ts` (new, Android)
- `lib/health/index.ts` (platform-routed entry)
- `lib/profile/resolver.ts` (add `manualOverride` to ProfilePrefs)
- `app/(tabs)/settings/profile.tsx` (Auto-fill CTA + state)
- `locales/en/settings.json`
- `app.json` (config-plugin entries)
- `__tests__/health-adapters.test.ts`

### P2 — Observe changes + write workouts

Scope:

- Subscribe to weight changes on iOS (`HKObserverQuery` +
  `HKAnchoredObjectQuery` for the latest sample) and Android (Health
  Connect change-feed) so the profile re-syncs in the background when
  the user weighs themselves.
- Background delivery entitlement on iOS; Health Connect background
  reads on Android (requires extra permission tier).
- After `recorder.finish()` completes, write the activity back as:
  - iOS: `HKWorkout` (rowing) + `HKQuantitySample`s for HR series + an
    `HKQuantitySample` for active energy.
  - Android: `ExerciseSessionRecord` + `HeartRateRecord` series +
    `TotalCaloriesBurnedRecord`.
- Workouts written by RowerM8 must be tagged with our bundle source
  so we don't read them back as a "new" entry (avoiding the round-trip
  issue listed in §7).

Files touched:

- `lib/activity/recorder.ts` (no behaviour change; recorder is pure —
  the hook around it dispatches to a new `lib/health/writer.ts`).
- `lib/health/writer.ts` (new, platform-routed).
- `app/free-row.tsx` (after save → fire-and-forget `writeToHealth`).
- `lib/health/observers.ts` (new, P2-only).
- Background-task wiring (Expo `BackgroundFetch` or similar for the
  observers; iOS HealthKit background delivery is the simpler path).

### P3 — Live HR from OS

Scope:

- Add a "Live HR source" preference: `none | ble | healthkit |
healthConnect` (auto-resolved by default).
- New `useOsHeartRateStream()` hook that mirrors the existing
  `useHeartRateStream()` shape (`{ bpm, isStreaming, source }`).
- Aggregator: when both BLE and OS are streaming, prefer the higher
  Hz source (typically BLE; Apple Watch HR is reported at 1 Hz and is
  fine for cadence tinting but not for strict zone training).
- Fall through cleanly to manual / no HR if the chosen source is
  unavailable.

Files touched:

- `hooks/use-os-heart-rate-stream.ts` (new)
- `hooks/use-heart-rate-stream.ts` (extend to multiplex sources)
- `lib/health/hr-stream.ts` (new, platform-routed)
- `app/free-row.tsx` (no API change; pulls from the same hook)
- Settings screen: a new "HR source" picker.

## 6. UX considerations

- Opt-in flow: surface the prompt once, on first visit to the Profile
  screen _or_ on first BLE-less Free-row attempt. Provide a clear
  "Maybe later" path.
- Source-of-truth conflict: `manualOverride` flag per field; HK reads
  populate fields where `manualOverride === false`. Editing a field
  in-app sets the flag for that field to `true`. Resetting a field to
  default (`null`) clears the flag.
- Permission denial: we never nag. Surface a single "Reconnect to
  Health" row in Settings → Profile after a denial; tapping it
  re-presents the system prompt.
- Multiple weight entries: HK can have several samples per day; we
  always read the most recent sample.
- DOB → age: compute on read. Re-compute on app-launch to handle the
  rare case where the user crosses a birthday with the app open.
- Unit conversions: sample values come in HK's preferred unit; convert
  to our storage unit (`kg`) at the adapter boundary, never in the
  resolver.

## 7. Caveats / known sharp edges

- HealthKit isn't available on the iOS simulator. P1 device QA needs a
  real device and an Apple Health profile populated with sample data.
- Health Connect on Android < 14 routes through a sideload APK and may
  simply be missing. We must always degrade to manual profile values.
- Round-trip risk: workouts we write back can flow into our own
  `useOsHeartRateStream` if we're not careful. iOS uses
  `HKSource.default()` filtering; Android Health Connect filters by
  `dataOrigin`. Apply the filter in _every_ read query.
- HKObserverQuery + HKAnchoredObjectQuery has a hidden battery cost;
  background delivery in particular is heavy. Limit to weight (low
  frequency) at first; HR live-stream stays foreground-only in P3.
- Privacy nutrition labels: writing workouts is a data category we
  must declare in the App Store privacy policy. Both iOS and Android
  require an in-app privacy disclosure linkable from the permission
  prompt.
- Time-zone correctness: HK timestamps are in UTC. The activity FIT
  writer already uses FIT-epoch UTC seconds, so no conversion is
  needed end-to-end.
- Permission revocation: the user can revoke individual HK permissions
  at any time. We must re-check at the start of each background-sync
  attempt and silently drop unavailable fields.

## 8. Test strategy

- Pure adapters: `lib/health/adapters.ts` takes "a HK quantity" and
  returns "a `Partial<ProfilePrefs>`"; trivially testable in node.
- Platform layers: mock the native module with a small fake (the
  king-library exposes a clean async API). Unit-test the platform
  routing layer to verify "iOS path called", "Android path called",
  "web path is a no-op".
- Live writer: integration tests on a device. Add a manual QA
  checklist to the next phase's PR description (see template below).

QA checklist template:

- [ ] Fresh install on iOS: Profile shows "Connect to Apple Health"
      CTA; tapping it presents the system sheet with all expected
      types.
- [ ] Granting weight + denying HR: Profile populates weight only;
      `useOsHeartRateStream` reports `isStreaming === false`.
- [ ] Denying everything: Profile screen surfaces "Reconnect to
      Health" row; manual entry still works.
- [ ] Saving an activity (P2): the activity appears in Apple Health
      under "Workouts → Rowing" with the correct duration and
      calorie count.
- [ ] Round-trip: a saved-by-RowerM8 workout doesn't appear back in
      `useOsHeartRateStream` once P3 lands.
- [ ] Same on Android with Health Connect installed.
- [ ] Same on Android _without_ Health Connect installed → graceful
      "Install Health Connect" CTA links to Play Store.

## 9. Open questions for the next planner

These deliberately stay open so the next planning pass can pick a
direction with the user:

- Should OS sync default to opt-in (one-time prompt) or opt-out
  (auto-import on first launch with a deny banner)?
- If the user changes weight in the app, do we write it back to HK?
  (P2 scope; today's draft keeps writes restricted to workouts.)
- Live HR: when both BLE and OS are streaming, prefer BLE (lower
  latency, higher Hz) or OS (always available, Apple Watch comfort)?
- Apple Watch standalone app: out of scope for this doc, but worth
  flagging if HK live HR works well — a watchOS companion that pairs
  the screen-on Free Row session with a wrist heart rate source is a
  natural P4.
- Workout writes: do we also write distance? Indoor-rowing distance is
  estimated, so writing it to HK risks polluting the user's
  "distance covered today" metric. Default proposal: no distance, just
  duration + calories + HR series.
- Background sync of weight: how often is "often enough"? Once per
  app foreground vs HKObserverQuery pushes. The latter is more correct
  but invokes the entitlement and battery tax.

## 10. Suggested commit cadence (when this is picked up)

- C1 — `feat(health): adapters + permission prompt + read-static profile fields` (P1).
- C2 — `feat(health): write completed activities back to HealthKit / Health Connect` (P2.1).
- C3 — `feat(health): observe weight changes in the background` (P2.2).
- C4 — `feat(health): live HR source picker (BLE / OS)` (P3).

Each commit ships behind no feature flag; we lean on the
`manualOverride` flags + opt-in CTA to keep the feature inert until
the user explicitly enables it.
