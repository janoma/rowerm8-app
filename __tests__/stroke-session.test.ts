import { GRAVITY_MPS2 } from "@/lib/units";

import { fixedAxisProjector, magnitudeProjector } from "@/lib/stroke/projector";
import { createStrokeSession } from "@/lib/stroke/session";
import type { Vec3Sample } from "@/lib/stroke/types";

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

describe("createStrokeSession — end-to-end with magnitude projector", () => {
  it("counts strokes correctly when magnitude rises above gravity rest", () => {
    // 1.5 s period, amplitude 4 m/s^2 horizontally — easily above the
    // gravity rest level once the magnitude EMA settles.
    const session = createStrokeSession(magnitudeProjector());
    const samples = gravityPlusYPulses({
      strokeAmplitude: 4,
      pulseWidthSeconds: 0.4,
      periodSeconds: 1.5,
      durationSeconds: 18,
      sampleRateHz: 50,
    });
    let lastMetrics = session.getMetrics();
    for (const { sample, tMs } of samples) {
      lastMetrics = session.update(sample, tMs);
    }
    // 18 s / 1.5 s = 12 strokes, less a couple while the magnitude EMA
    // settles to track ~|gravity|. Allow a small tolerance.
    expect(lastMetrics.strokeCount).toBeGreaterThanOrEqual(9);
    expect(lastMetrics.strokeCount).toBeLessThanOrEqual(12);
    expect(lastMetrics.elapsedSeconds).toBeCloseTo(18 - 1 / 50, 1);
    expect(lastMetrics.isReady).toBe(true);
  });

  it("converges cadence to ~40 spm for a 1.5 s period", () => {
    const session = createStrokeSession(magnitudeProjector(), {
      // Faster cadence smoother so the test doesn't have to drive 30+
      // strokes for the EMA to settle.
      detector: { cadenceEmaAlpha: 0.7 },
    });
    const samples = gravityPlusYPulses({
      strokeAmplitude: 4,
      pulseWidthSeconds: 0.4,
      periodSeconds: 1.5,
      durationSeconds: 24,
      sampleRateHz: 50,
    });
    let lastMetrics = session.getMetrics();
    for (const { sample, tMs } of samples) {
      lastMetrics = session.update(sample, tMs);
    }
    expect(lastMetrics.cadenceSpm).toBeGreaterThan(35);
    expect(lastMetrics.cadenceSpm).toBeLessThan(45);
    expect(lastMetrics.instantCadenceSpm).toBeCloseTo(40, 0);
  });
});

describe("createStrokeSession — pace and elapsed time", () => {
  it("derives pace from cadence using the configured metersPerStroke", () => {
    const session = createStrokeSession(magnitudeProjector(), {
      detector: { cadenceEmaAlpha: 0.7 },
      pace: { metersPerStroke: 10 },
    });
    const samples = gravityPlusYPulses({
      strokeAmplitude: 4,
      pulseWidthSeconds: 0.4,
      periodSeconds: 1.5, // 40 spm
      durationSeconds: 24,
      sampleRateHz: 50,
    });
    let lastMetrics = session.getMetrics();
    for (const { sample, tMs } of samples) {
      lastMetrics = session.update(sample, tMs);
    }
    // 40 spm * 10 m/stroke / 60 = 6.67 m/s; pace = 500 / 6.67 = 75 s/500m.
    // Allow some slack because cadence may not have perfectly converged.
    expect(lastMetrics.boatSpeedMps).toBeGreaterThan(5.5);
    expect(lastMetrics.boatSpeedMps).toBeLessThan(7.5);
    expect(lastMetrics.paceSecondsPer500m).toBeGreaterThan(65);
    expect(lastMetrics.paceSecondsPer500m).toBeLessThan(95);
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
    const session = createStrokeSession(fixedAxisProjector("y"));
    // Drive enough to fire at least one stroke.
    for (let i = 0; i < 10; i++) {
      session.update({ x: 0, y: i % 2 === 0 ? 0 : 2, z: 0 }, i * 200);
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
