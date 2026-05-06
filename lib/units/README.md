# Units

Conversion primitives for the app. The cardinal rule:

> **Store and compute in SI base units. Convert only at the display or input
> boundary.**

## Why

Round-tripping values through display units accumulates floating-point error
("drift"). Concretely, doing `m -> mi -> m` and persisting the result will
shift the underlying value by hundredths of a metre per cycle. Repeated over
the lifetime of a workout history this is visible, and it produces
disagreements between devices.

The fix is mechanical: every persisted, computed, or transmitted value is
already in SI; conversions live only inside `lib/format/*` (one step, then
discarded) and in `parse*ToSI` helpers used when accepting human input
(also one step).

## Canonical units

| Quantity      | Canonical SI unit | Where it appears                             |
| ------------- | ----------------- | -------------------------------------------- |
| Distance      | metres (m)        | sensor frames, persisted workouts            |
| Time          | seconds (s)       | durations, splits                            |
| Speed         | m/s               | derived from distance/time                   |
| Pace (rowing) | s/500m (derived)  | computed from m/s; see `mpsToSecondsPer500m` |
| Mass          | kilograms (kg)    | body weight                                  |
| Power         | watts (W)         | (no conversion needed)                       |
| Energy        | joules (J)        | display as kcal via `joulesToKcal`           |
| Temperature   | degrees Celsius   |                                              |
| Acceleration  | m/s^2             | normalized at ingress; see `gToMps2`         |
| Stroke rate   | strokes/min (spm) | universal — no conversion                    |

## Anti-patterns

- Do not write `value * 1.609` anywhere outside `convert.ts`. Add a constant
  if you find yourself wanting to.
- Do not persist a "miles" number alongside a `unit` string. Persist metres.
- Do not chain conversions (e.g. `metersToMiles(metersToKm(m) * 1000)`).
  Each `convert.ts` helper is a single multiplication for a reason.
- Do not toggle the user's unit pref by rewriting stored data. Stored data is
  invariant; only the formatter output changes.
