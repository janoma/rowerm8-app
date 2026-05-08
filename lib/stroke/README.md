# Stroke detection

Pure, framework-free pipeline that turns a 3-axis motion stream (phone
accelerometer or WitMotion BLE handle sensor) into stroke counts,
cadence, and pace. The React layer drives this pipeline through
`hooks/use-stroke-session.ts`; everything in `lib/stroke/` is pure and
unit-tested under `ts-jest`.

## Pipeline

```
MotionSample (3 axes + optional Euler angle)
        │
        ▼
   Projector  ──►  scalar effort signal
        │
        ▼
 createStrokeDetector  ──►  per-sample StrokeUpdateResult
        │
        ▼
 createStrokeSession  ──►  SessionMetrics (count, cadence, pace, …)
```

Projectors:

- `magnitudeProjector` — `||a|| − rest`. Used for the phone path.
- `pcaProjector` — continuously fits the dominant variance direction.
- `handleAxisProjector` — gravity-correct (using the WitMotion's on-device
  Euler angles) → PCA pull-axis fit → 1st-order IIR low-pass. Used for
  the BLE path; see `lib/stroke/projector.ts` and `lib/stroke/gravity.ts`.

Detector v2 is a four-phase state machine (`IDLE → ARMED →
END_OF_DRIVE → IDLE`) gated by peak amplitude, drive duration, and
integrated impulse. Strokes fire at end-of-drive but are timestamped at
the candidate's peak so cadence stays peak-to-peak. See
`lib/stroke/detector.ts` for the full state diagram in the file header.

## Deferred work / roadmap

These are deliberate cuts from the v2 plan. They're listed in the order
we expect to pick them up (tightest user-visible win first); each one is
self-contained and has notes on the implementation sketch and the data
or UX it would need.

### 1. Calibration UI for `metersPerStroke`

**Status.** Back-end ready; UI not written.

**What it does.** Turns the placeholder `metersPerStroke = 8` constant in
`lib/stroke/pace.ts` into a per-user value derived from the user's own
machine and stroke. Today's pace is a rough proxy; calibrated, it
becomes meaningful.

**How calibration would work.**

- A short setup flow on the Settings or first-launch screen.
- Prompt: "Row a known distance (200 m) at any pace." User taps Start,
  rows 200 m by their machine's display, taps Stop.
- App divides the display distance by the strokes counted to get
  `metersPerStroke`. Two repetitions at different paces averaged would
  improve the estimate; one is already enough for v1.
- Persist per-user; `PaceEstimateOptions.metersPerStroke` already
  accepts the override.

**Why deferred.** It's a UX feature — needs screens, persistence, copy,
a "recalibrate" affordance, and ideally a "calibration quality"
indicator. The detector / pace modules are already structured to accept
the value via config so the back-end is ready when the UI is.

### 2. Gyro (`angularVelocity`) sanity gate

**Status.** Data is decoded but discarded.

**What it does.** The WitMotion BWT901 reports `angularVelocity` (deg/s,
three axes) on every active frame. We currently throw it away in
`hooks/use-ble-stream.ts` (only `accel` and `angle` are forwarded). The
idea is a second-opinion gate: a real drive rotates the handle around at
least one axis (typically a noticeable yaw/pitch sweep as the user
pulls); a still handle has near-zero `||ω||` and shouldn't ever produce
strokes regardless of how the linear-acceleration channel looks.

**Where it would live.** A fifth gate inside the END_OF_DRIVE evaluation
in `lib/stroke/detector.ts`:

```
gyroActive = max(||ω||) accumulated over ARMED  ≥  ω_min
```

Or as a precondition for arming. Inside the candidate is probably
better — we want the gyro envelope across the whole drive, not just the
arm sample.

**Implementation steps.**

- Forward `frame.angularVelocity` from the decoder through `useBleStream`
  and `useMotionStream` (mirror of how we did `angle`).
- Extend `MotionSample` with optional `angularVelocity?: Vec3Sample`.
- Add `minGyroPeak` (rad/s or deg/s — pick once and stick) to
  `StrokeDetectorConfig`.
- Track `candidateGyroPeak` in `StrokeDetectorState`; update during
  ARMED; check at END_OF_DRIVE.

**Why deferred.** I have no idea what natural rowing gyro magnitudes
actually look like on a handle. Picking `ω_min` out of thin air is just
as likely to introduce false negatives as it is to catch noise. The
honest move is to record one real session, plot `||ω||` vs the projected
linear signal, and pick the gate empirically.

### 3. Calibration UI for `minStrokeImpulse`

**Status.** Back-end ready; UI not written. Pairs naturally with #1
above.

**What it does.** Replaces the empirical placeholder
`minStrokeImpulse = 0.5` (`m/s` — see
`DEFAULT_DETECTOR_CONFIG`) with a per-user value. Different rowers
produce wildly different impulse envelopes — a junior rower at 18 spm
and a heavyweight pulling 32 spm need different gates.

**How calibration would work.**

- Prompt: "Row at a comfortable pace for 30 seconds."
- Record raw samples; run the existing detector with permissive gates
  (e.g. `minStrokeImpulse: 0`) to count candidates.
- Compute the median peak impulse across the candidates; set
  `minStrokeImpulse = 0.5 × median` and persist.
- Offer the same recalibration affordance as #1.

**Why deferred.** Same as #1 — UX-driven, back-end ready. Best done in
the same setup flow as `metersPerStroke` so the user doesn't perform two
separate calibration sessions.

### 4. Explicit "calibrate handle axis" step

**Status.** Optional improvement; PCA's auto-fit already works.

**What it does.** Today `handleAxisProjector` finds the pull axis
automatically via PCA — about 30 strokes in (the warm-up,
`DEFAULT_PCA_CONFIG.warmupSamples`) it locks onto whatever direction has
the most variance in the gravity-corrected acceleration. This is
convenient but has two downsides:

- The first ~30 samples use a still-fitting axis, so the projected
  scalar is noisier early on.
- If the user starts the session by adjusting the handle / putting on
  shoes / etc., PCA might briefly lock onto that motion and need to
  relock when real rowing starts.

**What an explicit calibration would look like.** A 10-second "row 5
strokes to calibrate the handle direction" prompt. We'd collect the
gravity-corrected vectors during that window, run a one-shot PCA on the
buffered data, and write the resulting axis (just `{x, y, z}`) into
per-handle storage keyed by the BLE device id. On subsequent sessions
with the same handle, the projector loads that axis as a hot-start
instead of warming PCA from scratch.

**Implementation steps.**

- Add an optional `seedAxis?: Vec3Sample` field to
  `HandleAxisProjectorConfig`. When present, skip the warm-up phase and
  use that direction immediately.
- Keep PCA running in the background to drift-correct over time —
  handles can be remounted, and the snapshotted axis goes stale.
- Persist per-BLE-device-id (we already have the id available in the BLE
  context).

**Why deferred.** PCA's auto-fit works well enough in offline tests that
this isn't worth the storage / UI / seed-axis machinery until we see
that warm-up is actually a problem in field testing. If you find that
the first 1-2 strokes of every session are flaky, this is the cure. If
not, it's complexity nobody's asking for.

### 5. Concept2-style drive/recovery duration ratio

**Status.** Lowest priority; revisit only if other gates are
insufficient.

**What it does.** On a real rowing stroke the drive (catch → release) is
fast; the recovery (release → next catch) is 2-3× longer. The PM5 uses
this 1:2 to 1:3 ratio as a sanity check — anything way outside that
band probably isn't a stroke.

We already track the components: `driveDurationMs = candidatePeakMs −
candidateStartMs`, and the recovery duration is
`nextCandidateStartMs − previousEndOfDriveMs`. Both available; we'd
need to remember the previous candidate's end timestamp.

**Where it would live.** A new gate inside END_OF_DRIVE that fires only
when we have a previous stroke to compare against:

```
if previousRecoveryMs is set:
  ratio = recoveryMs / driveMs
  reject if ratio < 0.8 or > 5.0   // placeholder bounds
```

**Why deferred.** Two reasons.

- Only kicks in from the second stroke onward — the first stroke can
  never be ratio-rejected, so a noisy false positive at session start
  still gets through.
- In session warm-up, people sometimes do a single half-stroke to
  settle in, and the ratio for the next "real" stroke is then
  unrepresentative. The amplitude / impulse / duration gates we already
  have don't have this edge case.

Once we have a session log we can decide whether the ratio adds enough
discrimination to be worth the extra state and edge-case handling.

## Recommended order of attack

The first three are the most user-visible improvements; #4 and #5 are
algorithm-tuning niceties only worth doing if field testing surfaces a
real problem.

1. **Calibration UI for `metersPerStroke`** (#1) — biggest user-visible
   win (pace becomes correct), needs least new algorithm work.
2. **Gyro sanity gate** (#2) — tightens up false-positive rejection;
   one config value, one new gate.
3. **Calibration UI for `minStrokeImpulse`** (#3) — pairs naturally with
   #1 in the same setup flow.
4. **Explicit handle-axis calibration** (#4) — only if PCA warm-up
   shows up as a real problem in field testing.
5. **Drive/recovery ratio** (#5) — last; lowest marginal information vs
   the gates we already have.

## Out of scope (not on the roadmap)

- **Phone-side gravity correction via `expo-sensors` `DeviceMotion`** —
  only relevant if/when we re-enable the phone path for end users.
  Today the phone path uses `magnitudeProjector` which handles gravity
  via a slow EMA "rest" estimate.

## Where things live

| Concern                | File                                  |
| ---------------------- | ------------------------------------- |
| Shared types           | `lib/stroke/types.ts`                 |
| Detector state machine | `lib/stroke/detector.ts`              |
| Default detector knobs | `DEFAULT_DETECTOR_CONFIG` (same)      |
| Gravity math           | `lib/stroke/gravity.ts`               |
| Projectors             | `lib/stroke/projector.ts`             |
| Pace estimation        | `lib/stroke/pace.ts`                  |
| Session orchestration  | `lib/stroke/session.ts`               |
| React glue (live data) | `hooks/use-stroke-session.ts`         |
| BLE sample plumbing    | `hooks/use-ble-stream.ts`             |
| Phone sample plumbing  | `hooks/use-accelerometer-stream.ts`   |
| WitMotion BLE decoder  | `decoders/witmotion-bwt901.ts`        |
| Row screen UI          | `components/row/row-metrics-card.tsx` |
| Tests                  | `__tests__/stroke-*.test.ts`          |
