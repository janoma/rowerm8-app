# How a stroke gets detected

A walk-through, end to end, of what the app does between the moment the
WitMotion sensor on the handle takes a measurement and the moment the
app's stroke counter ticks up by one. Written for an engineer who does
not write code: there are units, intervals, formulas, and signal-shape
sketches, but no source listings.

The whole pipeline is a chain of small pure transformations. Nothing in
this document depends on the phone's accelerometer path — that path
exists, but it isn't used in the WitMotion build, and it would only
distract from the BLE story.

## 1. Bird's-eye view

```
   WitMotion BWT901 BLE handle           (the sensor)
                ↓
   raw 20-byte frame, 50 Hz
                ↓
        [ frame decoder ]                (extract accel, gyro, Euler angles)
                ↓
   3D linear acceleration  +  3D gravity vector (synthesized from Euler angles)
                ↓
        [ gravity subtraction ]          (remove the ~9.81 m/s² constant bias)
                ↓
   3D motion-only acceleration vector
                ↓
        [ PCA ]                          (find the pull axis, project onto it)
                ↓
   1D signed "effort" scalar
                ↓
        [ low-pass IIR ]                 (≈3 Hz cutoff, kills vibration)
                ↓
   1D smooth scalar  (this is what the detector actually sees)
                ↓
        [ stroke detector state machine ]
                ↓
   ↑ stroke! (with timestamp = candidate peak, not end-of-drive)
                ↓
   stroke count, cadence (smoothed SPM), pace estimate
```

Each block below explains one of these arrows.

## 2. What the WitMotion is actually sending

The handle sensor is a WitMotion BWT901BLE5.0-family device (in our
case, a WT9011DCL). It's a 9-axis IMU: a 3-axis accelerometer, a 3-axis
gyroscope, and a 3-axis magnetometer. It also runs on-device sensor
fusion that turns those nine raw channels into a stable Euler-angle
attitude estimate (roll / pitch / yaw). All of that lives inside the
device; we only see the post-fusion result over Bluetooth Low Energy.

We tell the device on connect to stream at 50 Hz (the highest discrete
output rate the firmware supports at or below our 60 Hz internal cap).
At 50 Hz it produces one **active frame** every 20 ms.

An active frame is 20 bytes:

| Byte(s) | What it is                                  |
| ------- | ------------------------------------------- |
| 0       | header byte `0x55`                          |
| 1       | frame-type byte `0x61` (active)             |
| 2-7     | accelerometer X / Y / Z (3 × signed 16-bit) |
| 8-13    | gyroscope X / Y / Z (3 × signed 16-bit)     |
| 14-19   | roll / pitch / yaw (3 × signed 16-bit)      |

Each 16-bit value is scaled into engineering units inside the decoder:

- accelerometer values: `int16 × (16 g / 32768)` → m/s² (range ±16 g)
- gyroscope values: `int16 × (2000 / 32768)` → degrees/s (range ±2000 °/s)
- angle values: `int16 × (180 / 32768)` → degrees (range ±180°)

Of those three triplets, the stroke pipeline currently uses **only the
accelerometer and the Euler angles**. The gyroscope is decoded and
thrown away — using it as an additional sanity gate ("is the handle
actually rotating?") is on the roadmap but not implemented yet.

There is also a second frame type we receive on demand — a 20-byte
register-read response containing the battery voltage — but that's only
for the battery indicator on the connection screen, not for stroke
detection, so I'll skip it here.

## 3. The decoder

Bluetooth doesn't deliver one neat frame per notification; it can lump
several together, prepend or append a junk byte, or split a frame
across two notifications. The decoder loops byte by byte:

- if it sees `0x55 0x61` and there are 18 more bytes available, it
  parses a 20-byte active frame and advances 20 bytes;
- if it sees `0x55 0x71 0x64 0x00`, it parses a battery-voltage
  response;
- otherwise it skips one byte and tries again at the next position.

So at the output of the decoder, every sample we hand downstream is
already a clean structured object: three-axis acceleration in m/s², and
three-axis Euler attitude in degrees, with a wall-clock timestamp from
when the BLE notification arrived.

## 4. Removing gravity

The accelerometer is reading the **specific force** acting on its
proof-mass — i.e. the user's hand acceleration plus the constant 9.81
m/s² reaction force from gravity. Even a perfectly still handle reads a
non-zero vector with magnitude ≈ 9.81. We need to take that out before
the rest of the pipeline can see anything useful.

Two ways exist to do this:

1. Estimate a slow "rest" magnitude from the data itself with an
   exponentially-weighted average and subtract it. This is what the
   phone path does. It works, but a long, sustained pull (1+ second of
   continuous force) drags the rest estimate around, which then biases
   the next stroke's detection.
2. Use the device's own attitude estimate to compute the gravity
   vector analytically and subtract it. This is what the WitMotion
   path does, because the device gives us the attitude for free.

The math, briefly. The Euler angles describe the sensor's orientation
relative to the world. With a ZYX intrinsic rotation convention (yaw →
pitch → roll, the standard aerospace and WitMotion ordering), the
gravity vector in the sensor's body frame works out to:

```
   g_x  =  g · ( cos(yaw)·sin(pitch)·cos(roll)  +  sin(yaw)·sin(roll) )
   g_y  =  g · ( sin(yaw)·sin(pitch)·cos(roll)  −  cos(yaw)·sin(roll) )
   g_z  =  g ·   cos(pitch)·cos(roll)
```

(With the device flat — roll, pitch, yaw all zero — this collapses to
`(0, 0, +g)`, which is exactly what an accelerometer at rest on a
table reads on its Z axis. Sanity-checked against three orientations
in our unit tests.)

We compute that vector for every frame, subtract it from the raw accel
vector, and the result is the **linear acceleration** of the handle —
the part the rower actually creates by pulling.

## 5. From 3D to 1D — finding the pull axis automatically (PCA)

A rowing stroke is essentially one-dimensional motion (along the pull
axis), but the sensor gives us three axes whose meaning depends on how
the user wrapped or strapped the handle. We don't know, ahead of time,
which axis "is" the pull axis, and we don't want to ask the user to
mount the sensor in a specific orientation.

So we let the data tell us. We run **principal component analysis**
(PCA) on the gravity-corrected acceleration vector. Briefly:

- Maintain an exponentially-weighted estimate of the mean acceleration
  vector `μ` and of the centered covariance matrix `Σ` (3 × 3,
  symmetric). Both EMAs use α ≈ 0.02, which corresponds to roughly one
  second of effective memory at 50 Hz.
- About four times per second, run a few iterations of the power method
  on `Σ` to extract its dominant eigenvector `v`. Geometrically this
  is the direction in 3-space along which the recent acceleration data
  has the most variance.
- Project every centered sample onto `v`: `value = (a − μ) · v`. The
  result is a **signed** scalar — positive on one side of the mean,
  negative on the other.

We do an additional bookkeeping step at every refit to keep the sign
of `v` aligned with the previous one (eigenvectors are sign-ambiguous
by definition; without this the projected signal would invert
arbitrarily mid-session and the cadence would jump).

For the first ~30 samples (≈0.6 s) the covariance matrix has barely
accumulated anything, so we don't trust the fitted axis yet. During
that warm-up window we feed the detector a fallback signal: the
magnitude of the centered acceleration vector, with a sign tie-break
so it isn't strictly positive. Once warm-up is done, the PCA-projected
value takes over.

For a handle-mounted IMU, the "direction of greatest variance" is
overwhelmingly the pull axis itself, simply because that's where the
rower puts the most acceleration. So although we never tell the
algorithm "pull axis," it locks onto it within a couple of strokes.

## 6. Low-pass filter

A single first-order IIR low-pass smoother is applied to the projected
scalar:

```
   y[n]  =  (1 − α) · y[n−1]  +  α · x[n]            with  α = 0.3
```

At 50 Hz this is roughly a 3 Hz cutoff. The stroke band is 0.3–1 Hz
(20 spm = 0.33 Hz, 60 spm = 1.0 Hz), so this kills vibration above 3
Hz without smearing the pulse shape we care about.

The output of this stage is the 1D signal the detector actually
operates on. Call it `value(t)`. From here on the math is purely 1D.

## 7. The detector — adaptive baseline and threshold

Before we get to the stroke logic itself, two slow tracking signals:

- **Baseline**: a slow EMA of `value`. Roughly, "what does the signal
  read at rest?" Updated only when `value < 1.15 × threshold` so that
  the middle of an in-progress pull doesn't drag the baseline up.
- **Threshold**: an EMA of `1.2 × max(0, value − baseline)`, clamped
  to a configurable floor and ceiling. Roughly, "how big are recent
  positive excursions?" Faster than the baseline, so it follows
  changes in effort within a few strokes.

Both EMAs update on every sample, regardless of what the state machine
is doing. A new user starting from rest will see the threshold climb
over the first 3-4 strokes until it settles into a level proportional
to their actual stroke amplitude.

## 8. The detector — a state machine

The detector is in one of two phases, with a third "phase" that is
really just an end-of-pulse evaluation:

```
        ┌──────────────────────────── value drops below
        │                              0.4 × armed-threshold
        ▼
   ┌─────────┐    value ≥ 0.5 × threshold    ┌─────────┐
   │  IDLE   │ ───────────────────────────►  │  ARMED  │
   └─────────┘                                └─────────┘
        ▲                                          │
        │                                          │  value falling AND
        │                                          │  value < ½ × peak-so-far
        │                                          ▼
        │                                  ┌──────────────┐
        └──────────────────────────────────│ END_OF_DRIVE │
              evaluate four gates           └──────────────┘
              (see §9), fire stroke
              if all pass
```

In words:

- **IDLE.** No active candidate. We are waiting. As soon as `value`
  exceeds `0.5 × threshold`, we open a candidate and switch to ARMED.
  We also snapshot the threshold _at this moment_ — call it the
  **arm-time threshold** — and freeze it for the lifetime of this
  candidate. (More on why in a moment.)
- **ARMED.** A candidate is in progress. On every sample we:
  - update the running peak height (`max value − baseline` so far,
    plus the timestamp at which it occurred);
  - integrate the impulse: `∫ max(0, value − baseline) dt`;
  - check for two exits.
- **Cancel exit.** If `value` falls below `0.4 × arm-time-threshold`,
  the candidate fizzled (a small jiggle that didn't develop into a
  real stroke). We drop it without firing and return to IDLE.
- **End-of-drive exit.** If `value` is falling _and_ has come back
  below half of its peak-so-far, the drive is effectively over. We
  evaluate the four gates and fire iff they all pass.

Two design notes worth calling out, because they would otherwise look
like bugs:

> The 0.5 / 0.4 hysteresis. The arm threshold is `0.5 × threshold`
> and the release threshold is `0.4 × arm-time-threshold`, slightly
> lower. The 10% gap is just hysteresis: a single noisy sample can't
> bounce us between IDLE and ARMED faster than we can react.

> Why we freeze the threshold at arm time. The threshold EMA keeps
> climbing while we're inside ARMED (every positive-deviation sample
> feeds it). If we used the _live_ threshold for the bigEnough gate
> at end-of-drive, a candidate that legitimately armed could be
> retroactively rejected because the threshold it itself drove
> upward has now climbed past its own peak. Snapshotting the
> threshold at arm time eliminates that.

## 9. The four gates

When the state machine reaches END_OF_DRIVE, four things must all be
true to count this candidate as a real stroke:

| Gate         | Definition                               | Default | Why it exists                                                                                  |
| ------------ | ---------------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `inGap`      | `peak time − last-stroke time > 1000 ms` | 1000 ms | Refractory window. A single peak can't ring up two strokes during its tail.                    |
| `bigEnough`  | `candidate peak ≥ arm-time threshold`    | live    | Amplitude gate. Pulses that armed (at 50% of threshold) but never grew tall enough are tossed. |
| `longEnough` | `peak time − arm time ≥ 200 ms`          | 200 ms  | Real drives are 300-700 ms; sub-200 ms blips are noise.                                        |
| `punchy`     | `accumulated impulse ≥ 0.5 m/s`          | 0.5 m/s | Rejects tall but instantaneous spikes — there has to be sustained push, not just a kick.       |

The "impulse" in the punchy gate is the integrated positive deviation
above baseline over the whole ARMED window. Because the underlying
signal is linear acceleration in m/s², its time integral is a velocity
change in m/s — roughly the velocity the handle picked up along the
pull axis during the drive. (Hence the unit on the table.)

If all four gates pass, on this very sample:

- the stroke counter increments;
- cadence is updated (see §10);
- the stroke is **timestamped at the candidate's peak**, not at the
  end-of-drive sample we're currently on. This is deliberate — see
  the next section.

The detector then clears the candidate state and goes back to IDLE,
ready for the next one.

If any gate fails, the candidate is dropped silently. The user sees
nothing. (We log it internally during testing, but not at runtime.)

## 10. Cadence and pace

Cadence is the inter-peak interval, not the inter-end-of-drive
interval. That's why the stroke is timestamped at the candidate's peak
rather than at the moment we decide it's a stroke — the peak is a
cleaner anchor. The end-of-drive sample is where we _decide_, but the
peak is what we _measure_.

When we fire a stroke at peak time `T_n`, with the previous stroke at
`T_{n-1}`:

```
   gap_seconds   = (T_n − T_{n−1}) / 1000
   instant_spm   = 60 / gap_seconds
   cadence_spm   = (1 − α) · cadence_spm + α · instant_spm     with α = 0.5
```

α = 0.5 is a deliberately light smoothing — half of the displayed
cadence comes from the latest stroke, half from history. It tracks
real changes in stroke rate within two or three strokes without
flickering on a single jittery interval.

The first stroke can't compute a `gap_seconds` (there's nothing before
it), so cadence stays at its seed value of 20 spm until the second
stroke arrives. The UI handles this by showing a placeholder "—" rather
than fake data.

Pace (sec/500m) is then derived from cadence by multiplying by a fixed
`metersPerStroke` constant (currently 8 m, a placeholder pending a
calibration UI). Since this is a constant scaling of the cadence, it
isn't really new information — it's a UX convenience for users who
think in pace rather than cadence.

## 11. Known gap: drive vs. recovery

You asked whether the app currently treats the pull and the return as
two separate strokes when a real rowing stroke is one. The short answer
is: we do count two events per real cycle, but the framing is a little
different from "pull + return". Here's what's actually going on.

Once PCA has locked onto the pull axis, the projected signal is signed:
positive on one side of the centered mean, negative on the other. The
detector only opens a candidate on the positive side (the arm threshold
is positive). So the recovery half of the cycle, which projects with
the opposite sign, never arms — by construction.

What an IMU on a rowing handle actually shows, in linear acceleration
along the pull axis, over one complete stroke cycle, looks more like
this:

```
  +
  |        ╱ ╲
  |      ╱     ╲                                    ╱╲
  |    ╱         ╲                                ╱    ╲
  |  ╱             ╲                            ╱        ╲
  +─╴─╴─╴─╴─╴─╴─╴─╴─╴─╴╲─╴─╴─╴─╴─╴─╴─╴─╴─╴─╴─╴╱╴─╴─╴─╴─╴─╴─╴─►  time
  |                       ╲                  ╱
  |                         ╲              ╱
  |                           ╲          ╱
  |                             ╲      ╱
  -                               ╲  ╱
                                    ╲╱
   ↑                              ↑                   ↑
   catch:                         finish:             arrival at next catch:
   handle accelerates             handle decelerates  handle decelerates
   (positive peak)                & reverses          recovery direction
                                  (negative trough)   (positive peak again)
```

There are **two positive peaks per real rowing cycle**, because the
deceleration of the recovery (just before the next catch) projects with
the same sign as the drive's acceleration. They're not "drive" and
"recovery"; they're "drive-start" and "catch-arrival." But for the
purpose of the stroke counter, the visible behavior is the same as what
you described: one real rowing stroke produces two detected strokes.

The fix is the same regardless of how we frame it. The detector needs a
notion of stroke _phase_, not just amplitude. The gyroscope channel —
which we already decode but discard — would help with this: a real
drive rotates the handle around at least one axis (typically a yaw
sweep), and the catch-arrival blip doesn't. A second-opinion gate on
the angular-velocity envelope would let the catch-arrival peak fail
while the drive peak passes. That work is in our roadmap (see the
"Gyro sanity gate" section in `lib/stroke/README.md`); we deferred it
because nobody had recorded a real session and looked at what gyro
magnitudes actually look like during a drive vs. a catch arrival, so
picking the threshold would have been a guess. Once we have one or two
recorded sessions we'll set it empirically.

A different approach — tracking the drive/recovery duration ratio
explicitly — is also possible, and is in the same roadmap document.
We've ranked it lower than the gyro gate because it only kicks in from
the second stroke onward, and because warm-up half-strokes can confuse
it. The gyro gate seems cleaner.
