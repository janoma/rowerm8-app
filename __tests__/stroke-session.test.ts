import { gravityFromAngle } from "@/lib/stroke/gravity";
import {
  fixedAxisProjector,
  handleAxisProjector,
  magnitudeProjector,
} from "@/lib/stroke/projector";
import { createStrokeSession } from "@/lib/stroke/session";
import type { Angle, MotionSample, Vec3Sample } from "@/lib/stroke/types";
import { GRAVITY_MPS2 } from "@/lib/units";

/**
 * Build a 3D pulse train where each stroke is a positive bump along the
 * Y axis on top of a constant +Z gravity vector. This is a reasonable
 * model of a phone in a holder where strokes induce horizontal jolts.
 */
function gravityPlusYPulses({
  strokeAmplitude,
  pulseWidthSeconds,
  periodSeconds,
  durationSeconds,
  sampleRateHz,
}: {
  strokeAmplitude: number;
  pulseWidthSeconds: number;
  periodSeconds: number;
  durationSeconds: number;
  sampleRateHz: number;
}): { sample: Vec3Sample; tMs: number }[] {
  const dtMs = 1000 / sampleRateHz;
  const totalSamples = Math.floor(durationSeconds * sampleRateHz);
  const out: { sample: Vec3Sample; tMs: number }[] = [];
  for (let i = 0; i < totalSamples; i++) {
    const tSeconds = (i * dtMs) / 1000;
    const tInPeriod = tSeconds % periodSeconds;
    const yKick =
      tInPeriod < pulseWidthSeconds
        ? strokeAmplitude * Math.sin((Math.PI * tInPeriod) / pulseWidthSeconds)
        : 0;
    out.push({
      sample: { x: 0, y: yKick, z: GRAVITY_MPS2 },
      tMs: i * dtMs,
    });
  }
  return out;
}

/**
 * WitMotion-shaped path: a handle held at a fixed attitude (gravity is
 * baked in based on `restAngle`) with stroke pulses applied as a linear
 * pull along `pullDirection` in the body frame. Each emitted sample
 * carries the `angle` field so the gravity-correcting projector can
 * subtract gravity analytically.
 */
function handlePullPulses({
  pullAmplitude,
  pulseWidthSeconds,
  periodSeconds,
  durationSeconds,
  sampleRateHz,
  restAngle,
  pullDirection,
}: {
  pullAmplitude: number;
  pulseWidthSeconds: number;
  periodSeconds: number;
  durationSeconds: number;
  sampleRateHz: number;
  restAngle: Angle;
  pullDirection: Vec3Sample;
}): { sample: MotionSample; tMs: number }[] {
  const dtMs = 1000 / sampleRateHz;
  const totalSamples = Math.floor(durationSeconds * sampleRateHz);
  const g = gravityFromAngle(restAngle);
  const norm = Math.sqrt(
    pullDirection.x * pullDirection.x +
      pullDirection.y * pullDirection.y +
      pullDirection.z * pullDirection.z,
  );
  const u = {
    x: pullDirection.x / norm,
    y: pullDirection.y / norm,
    z: pullDirection.z / norm,
  };
  const out: { sample: MotionSample; tMs: number }[] = [];
  for (let i = 0; i < totalSamples; i++) {
    const tSeconds = (i * dtMs) / 1000;
    const tInPeriod = tSeconds % periodSeconds;
    const a =
      tInPeriod < pulseWidthSeconds
        ? pullAmplitude * Math.sin((Math.PI * tInPeriod) / pulseWidthSeconds)
        : 0;
    out.push({
      sample: {
        x: g.x + u.x * a,
        y: g.y + u.y * a,
        z: g.z + u.z * a,
        angle: restAngle,
      },
      tMs: i * dtMs,
    });
  }
  return out;
}

describe("createStrokeSession — end-to-end with magnitude projector", () => {
  // The magnitude projector's `sqrt(yKick² + g²) − rest` transform is
  // strongly nonlinear and compresses the rising half of the pulse —
  // for a 0.5 s input pulse the projected drive duration ends up below
  // the 200 ms default `minDriveDurationMs` gate. We use 0.8 s pulses
  // so the projected pulse comfortably clears the gate. A future phone
  // path will want its own gravity correction (e.g. `DeviceMotion`),
  // at which point this nonlinearity goes away.

  it("counts strokes correctly when magnitude rises above gravity rest", () => {
    const session = createStrokeSession(magnitudeProjector());
    const samples = gravityPlusYPulses({
      strokeAmplitude: 10,
      pulseWidthSeconds: 0.8,
      periodSeconds: 1.6,
      durationSeconds: 19.2, // 12 periods
      sampleRateHz: 50,
    });
    let lastMetrics = session.getMetrics();
    for (const { sample, tMs } of samples) {
      lastMetrics = session.update(sample, tMs);
    }
    // 12 expected strokes; allow a small tolerance for EMA warm-up.
    expect(lastMetrics.strokeCount).toBeGreaterThanOrEqual(9);
    expect(lastMetrics.strokeCount).toBeLessThanOrEqual(12);
    expect(lastMetrics.elapsedSeconds).toBeCloseTo(19.2 - 1 / 50, 1);
    expect(lastMetrics.isReady).toBe(true);
  });

  it("converges cadence to ~37.5 spm for a 1.6 s period", () => {
    const session = createStrokeSession(magnitudeProjector(), {
      // Faster cadence smoother so the test doesn't have to drive 30+
      // strokes for the EMA to settle.
      detector: { cadenceEmaAlpha: 0.7 },
    });
    const samples = gravityPlusYPulses({
      strokeAmplitude: 10,
      pulseWidthSeconds: 0.8,
      periodSeconds: 1.6,
      durationSeconds: 25.6, // 16 periods
      sampleRateHz: 50,
    });
    let lastMetrics = session.getMetrics();
    for (const { sample, tMs } of samples) {
      lastMetrics = session.update(sample, tMs);
    }
    expect(lastMetrics.cadenceSpm).toBeGreaterThan(33);
    expect(lastMetrics.cadenceSpm).toBeLessThan(42);
    expect(lastMetrics.instantCadenceSpm).toBeCloseTo(60 / 1.6, 0);
  });
});

describe("createStrokeSession — WitMotion handle path", () => {
  it("counts pull pulses cleanly with gravity removed via on-device angles", () => {
    // Handle held at a non-trivial tilt; pulls along (1, 2, 0) in the
    // body frame. With the angle field on every sample, the projector
    // subtracts gravity analytically and PCA locks onto the pull axis.
    const session = createStrokeSession(handleAxisProjector(), {
      detector: { cadenceEmaAlpha: 0.7 },
    });
    const samples = handlePullPulses({
      pullAmplitude: 8, // 8 m/s² peak — typical of a hard pull
      pulseWidthSeconds: 0.5,
      periodSeconds: 1.5,
      durationSeconds: 18,
      sampleRateHz: 50,
      restAngle: { roll: 15, pitch: -25, yaw: 0 },
      pullDirection: { x: 1, y: 2, z: 0 },
    });
    let lastMetrics = session.getMetrics();
    for (const { sample, tMs } of samples) {
      lastMetrics = session.update(sample, tMs);
    }
    // 18 s / 1.5 s = 12 strokes. Allow a small tolerance for the PCA
    // warm-up at the start.
    expect(lastMetrics.strokeCount).toBeGreaterThanOrEqual(9);
    expect(lastMetrics.strokeCount).toBeLessThanOrEqual(12);
    expect(lastMetrics.cadenceSpm).toBeGreaterThan(30);
    expect(lastMetrics.cadenceSpm).toBeLessThan(50);
  });

  it("does NOT count a 10 cm hand-bump as a stroke (impulse / duration gates reject it)", () => {
    // A short, low-amplitude bump — the kind we get from picking the
    // handle up an inch or wiggling it. Peak displacement of ~10 cm
    // achieved over ~150 ms corresponds to a peak acceleration around
    // 1.5 m/s² and a total impulse < 0.25 m/s. Both well below our
    // gates, and the drive duration is also under 200 ms.
    const session = createStrokeSession(handleAxisProjector(), {});
    const restAngle: Angle = { roll: 0, pitch: 0, yaw: 0 };
    const g = gravityFromAngle(restAngle);
    const samples: { sample: MotionSample; tMs: number }[] = [];
    const sampleRateHz = 50;
    const dtMs = 1000 / sampleRateHz;

    // 10 s of stationary samples to let PCA / baseline settle.
    for (let i = 0; i < sampleRateHz * 10; i++) {
      samples.push({
        sample: { x: g.x, y: g.y, z: g.z, angle: restAngle },
        tMs: i * dtMs,
      });
    }

    // A series of small jiggles along Y, each ~150 ms wide and 1.5 m/s²
    // peak, separated by 1.5 s gaps so the refractory window is not a
    // factor. Without the new gates, the v1 detector would have fired
    // on each one.
    let baseT = sampleRateHz * 10 * dtMs;
    for (let bump = 0; bump < 5; bump++) {
      const bumpStartT = baseT;
      const bumpWidthMs = 150;
      const bumpAmplitude = 1.5;
      const bumpPulseSamples = Math.ceil(bumpWidthMs / dtMs);
      for (let i = 0; i < bumpPulseSamples; i++) {
        const tInBump = i * dtMs;
        const yKick =
          bumpAmplitude * Math.sin((Math.PI * tInBump) / bumpWidthMs);
        samples.push({
          sample: { x: g.x, y: g.y + yKick, z: g.z, angle: restAngle },
          tMs: bumpStartT + tInBump,
        });
      }
      baseT = bumpStartT + 1500; // next bump 1.5 s later
      const restSamples = Math.ceil(
        (baseT - (bumpStartT + bumpPulseSamples * dtMs)) / dtMs,
      );
      for (let i = 0; i < restSamples; i++) {
        samples.push({
          sample: { x: g.x, y: g.y, z: g.z, angle: restAngle },
          tMs: bumpStartT + bumpPulseSamples * dtMs + i * dtMs,
        });
      }
    }

    let lastMetrics = session.getMetrics();
    for (const { sample, tMs } of samples) {
      lastMetrics = session.update(sample, tMs);
    }
    expect(lastMetrics.strokeCount).toBe(0);
  });
});

describe("createStrokeSession — pace and elapsed time", () => {
  it("derives pace from cadence using the configured metersPerStroke", () => {
    const session = createStrokeSession(magnitudeProjector(), {
      detector: { cadenceEmaAlpha: 0.7 },
      pace: { metersPerStroke: 10 },
    });
    const samples = gravityPlusYPulses({
      strokeAmplitude: 10,
      pulseWidthSeconds: 0.8,
      periodSeconds: 1.6, // 37.5 spm
      durationSeconds: 25.6,
      sampleRateHz: 50,
    });
    let lastMetrics = session.getMetrics();
    for (const { sample, tMs } of samples) {
      lastMetrics = session.update(sample, tMs);
    }
    // 37.5 spm * 10 m/stroke / 60 = 6.25 m/s; pace = 500 / 6.25 = 80 s/500m.
    // Allow some slack because cadence may not have perfectly converged.
    expect(lastMetrics.boatSpeedMps).toBeGreaterThan(5.0);
    expect(lastMetrics.boatSpeedMps).toBeLessThan(7.0);
    expect(lastMetrics.paceSecondsPer500m).toBeGreaterThan(70);
    expect(lastMetrics.paceSecondsPer500m).toBeLessThan(100);
  });

  it("returns Infinity pace before any stroke fires", () => {
    const session = createStrokeSession(fixedAxisProjector("y"));
    // One sample, value below the floor → no stroke.
    const m = session.update({ x: 0, y: 0.01, z: 0 }, 0);
    expect(m.strokeCount).toBe(0);
    expect(m.paceSecondsPer500m).toBe(Number.POSITIVE_INFINITY);
    expect(m.boatSpeedMps).toBe(0);
  });

  it("elapsed time advances monotonically and is anchored to the first sample", () => {
    const session = createStrokeSession(fixedAxisProjector("y"));
    const m1 = session.update({ x: 0, y: 0, z: 0 }, 1000);
    const m2 = session.update({ x: 0, y: 0, z: 0 }, 1500);
    const m3 = session.update({ x: 0, y: 0, z: 0 }, 4000);
    expect(m1.elapsedSeconds).toBe(0);
    expect(m2.elapsedSeconds).toBe(0.5);
    expect(m3.elapsedSeconds).toBe(3);
  });
});

describe("createStrokeSession — reset", () => {
  it("clears stroke count, elapsed time, and detector state", () => {
    // A session driven by a wide-pulse fixed-axis projector so we can
    // reliably fire a stroke through all of v2's gates.
    const session = createStrokeSession(fixedAxisProjector("y"), {
      detector: {
        thresholdFloor: 0.5,
        minDriveDurationMs: 0,
        minStrokeImpulse: 0,
      },
    });
    // Half-sine bump on Y, wide enough to clear duration / impulse
    // gates and tall enough to clear the threshold floor.
    const dtMs = 20;
    for (let i = 0; i < 30; i++) {
      const tMs = i * dtMs;
      const tInPulse = tMs;
      const v = tInPulse < 600 ? 2 * Math.sin((Math.PI * tInPulse) / 600) : 0;
      session.update({ x: 0, y: v, z: 0 }, tMs);
    }
    expect(session.getMetrics().strokeCount).toBeGreaterThan(0);
    session.reset();
    expect(session.getMetrics()).toMatchObject({
      strokeCount: 0,
      elapsedSeconds: 0,
      isReady: false,
      paceSecondsPer500m: Number.POSITIVE_INFINITY,
      boatSpeedMps: 0,
    });
  });
});
