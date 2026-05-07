import {
  createStrokeDetector,
  DEFAULT_DETECTOR_CONFIG,
  type StrokeDetector,
} from "@/lib/stroke/detector";
import type {
  StrokeDetectorConfig,
  StrokeUpdateResult,
} from "@/lib/stroke/types";

/**
 * Drive a detector with a sampled waveform. Returns the per-sample results
 * along with the indices at which a stroke fired, so individual tests can
 * assert against the count, the inter-stroke gaps, or the precise sample
 * index.
 */
function drive(
  detector: StrokeDetector,
  waveform: { value: number; timestampMs: number }[],
): {
  results: StrokeUpdateResult[];
  strokeIndices: number[];
} {
  const results: StrokeUpdateResult[] = [];
  const strokeIndices: number[] = [];
  for (let i = 0; i < waveform.length; i++) {
    const r = detector.update(waveform[i].value, waveform[i].timestampMs);
    results.push(r);
    if (r.strokeJustDetected) {
      strokeIndices.push(i);
    }
  }
  return { results, strokeIndices };
}

/**
 * Generate a stroke-pulse train: a half-sine "bump" of `amplitude` and
 * `pulseWidthSeconds`, repeated once per `periodSeconds`, with quiet rest
 * (zero) between bumps. This is a much closer model of what the magnitude
 * projector emits on real rowing data than a bipolar sine wave: each catch
 * is a positive lobe, the recovery is near zero.
 */
function strokePulseTrain({
  amplitude,
  pulseWidthSeconds,
  periodSeconds,
  durationSeconds,
  sampleRateHz,
  noiseAmplitude = 0,
  rngSeed = 1,
}: {
  amplitude: number;
  pulseWidthSeconds: number;
  periodSeconds: number;
  durationSeconds: number;
  sampleRateHz: number;
  noiseAmplitude?: number;
  rngSeed?: number;
}): { value: number; timestampMs: number }[] {
  const dtMs = 1000 / sampleRateHz;
  const totalSamples = Math.floor(durationSeconds * sampleRateHz);
  // Tiny LCG so noise is deterministic without bringing in a dep.
  let seed = rngSeed;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff - 0.5;
  };
  const out: { value: number; timestampMs: number }[] = [];
  for (let i = 0; i < totalSamples; i++) {
    const tSeconds = (i * dtMs) / 1000;
    const tInPeriod = tSeconds % periodSeconds;
    const value =
      tInPeriod < pulseWidthSeconds
        ? amplitude * Math.sin((Math.PI * tInPeriod) / pulseWidthSeconds)
        : 0;
    out.push({
      value: value + noiseAmplitude * rand(),
      timestampMs: i * dtMs,
    });
  }
  return out;
}

describe("createStrokeDetector — counting", () => {
  it("counts one stroke per pulse on a steady stroke-pulse train", () => {
    // 1.5 s period -> 40 spm; 12 s of data -> 8 strokes.
    const detector = createStrokeDetector();
    const wave = strokePulseTrain({
      amplitude: 2,
      pulseWidthSeconds: 0.4,
      periodSeconds: 1.5,
      durationSeconds: 12,
      sampleRateHz: 50,
    });
    const { strokeIndices } = drive(detector, wave);
    expect(strokeIndices.length).toBe(8);
  });

  it("counts strokes correctly with mild noise on top", () => {
    const detector = createStrokeDetector();
    const wave = strokePulseTrain({
      amplitude: 2,
      pulseWidthSeconds: 0.4,
      periodSeconds: 1.5,
      durationSeconds: 12,
      sampleRateHz: 50,
      noiseAmplitude: 0.1,
    });
    const { strokeIndices } = drive(detector, wave);
    expect(strokeIndices.length).toBe(8);
  });

  it("does not count strokes from a quiet (sub-floor) signal", () => {
    const detector = createStrokeDetector();
    const wave = strokePulseTrain({
      amplitude: 0.2,
      pulseWidthSeconds: 0.4,
      periodSeconds: 1.5,
      durationSeconds: 6,
      sampleRateHz: 50,
    });
    const { strokeIndices } = drive(detector, wave);
    expect(strokeIndices.length).toBe(0);
  });

  it("settles instantaneous cadence near the driving period after a few strokes", () => {
    // 2.0 s per stroke -> 30 spm.
    const detector = createStrokeDetector({
      // Use a very low EMA so the smoothed cadence converges to the
      // instant value within a few strokes; the smoother is exercised
      // separately further down.
      cadenceEmaAlpha: 1.0,
      initialCadenceSpm: 30,
    });
    const wave = strokePulseTrain({
      amplitude: 2,
      pulseWidthSeconds: 0.4,
      periodSeconds: 2.0,
      durationSeconds: 12,
      sampleRateHz: 50,
    });
    const { results, strokeIndices } = drive(detector, wave);
    expect(strokeIndices.length).toBeGreaterThanOrEqual(5);
    const last = results[results.length - 1];
    expect(last.cadenceSpm).toBeCloseTo(30, 0);
    expect(last.instantCadenceSpm).toBeCloseTo(30, 0);
  });

  it("smoothes cadence with the configured EMA alpha", () => {
    // Two strokes far apart, then a sudden faster gap should not snap
    // immediately to the new cadence at alpha = 0.5.
    const detector = createStrokeDetector({
      cadenceEmaAlpha: 0.5,
      initialCadenceSpm: 20,
    });
    // strokes at t = 0.1, 2.1, 3.1 s (after suitably-shaped pulses).
    // First gap = 2.0 s -> 30 spm; second gap = 1.0 s -> 60 spm.
    const samples: { value: number; timestampMs: number }[] = [];
    const peakAt = (tMs: number) => {
      // Two-sample upward crossing: a low sample followed by a high one.
      samples.push({ value: 0.0, timestampMs: tMs - 20 });
      samples.push({ value: 2.0, timestampMs: tMs });
      samples.push({ value: 0.0, timestampMs: tMs + 20 });
    };
    peakAt(100);
    peakAt(2100);
    peakAt(3101);
    const { results } = drive(detector, samples);
    const last = results[results.length - 1];
    // EMA on cadence: seed=20, after 2.0 s gap → 0.5*20 + 0.5*30 = 25,
    // after 1.001 s gap (~59.94 spm) → 0.5*25 + 0.5*59.94 ≈ 42.5.
    expect(last.cadenceSpm).toBeGreaterThan(35);
    expect(last.cadenceSpm).toBeLessThan(50);
  });
});

describe("createStrokeDetector — refractory period", () => {
  it("blocks a second trigger inside minStrokeGapMs", () => {
    const detector = createStrokeDetector({ minStrokeGapMs: 1000 });
    // Two upward crossings 200 ms apart: first should fire, second must not.
    const samples = [
      { value: 0.0, timestampMs: 0 },
      { value: 2.0, timestampMs: 100 }, // crossing 1
      { value: 0.0, timestampMs: 200 },
      { value: 2.0, timestampMs: 300 }, // would cross again, blocked
    ];
    const { strokeIndices } = drive(detector, samples);
    expect(strokeIndices).toEqual([1]);
  });

  it("allows a second trigger once minStrokeGapMs has elapsed", () => {
    const detector = createStrokeDetector({ minStrokeGapMs: 1000 });
    const samples = [
      { value: 0.0, timestampMs: 0 },
      { value: 2.0, timestampMs: 100 }, // crossing 1
      { value: 0.0, timestampMs: 200 },
      { value: 0.0, timestampMs: 1100 },
      { value: 2.0, timestampMs: 1200 }, // gap = 1.1 s > 1.0 s, should fire
    ];
    const { strokeIndices } = drive(detector, samples);
    expect(strokeIndices).toEqual([1, 4]);
  });
});

describe("createStrokeDetector — threshold dynamics", () => {
  it("ratchets the threshold upward as bigger strokes arrive", () => {
    // Pulse train of growing amplitude. The threshold should rise above
    // the floor as the algorithm tracks the increasing effort.
    const config: Partial<StrokeDetectorConfig> = {
      thresholdFloor: 0.5,
      thresholdAlpha: 0.2,
      minStrokeGapMs: 500,
    };
    const detector = createStrokeDetector(config);
    const samples: { value: number; timestampMs: number }[] = [];
    const sampleRateHz = 50;
    const dtMs = 1000 / sampleRateHz;
    let amplitude = 1;
    for (let p = 0; p < 8; p++) {
      // A 200-ms half-sine pulse, then 800 ms of rest.
      const baseT = p * 1000;
      for (let s = 0; s < 50; s++) {
        const tMs = baseT + s * dtMs;
        const inPulse = s < 10;
        const v = inPulse
          ? amplitude * Math.sin((Math.PI * (s * dtMs)) / 200)
          : 0;
        samples.push({ value: v, timestampMs: tMs });
      }
      amplitude += 0.5;
    }
    const { results } = drive(detector, samples);
    // Threshold is recomputed every sample; during the rest portion of
    // each cycle it decays toward the floor. The interesting quantity is
    // the running peak — that's what gates whether the next stroke fires.
    const peakThreshold = Math.max(...results.map((r) => r.threshold));
    // Eight strokes ramping from amplitude 1 to ~4.5 — the running peak
    // threshold should track up well past the floor.
    expect(peakThreshold).toBeGreaterThan(1.0);
    expect(peakThreshold).toBeLessThan(
      DEFAULT_DETECTOR_CONFIG.thresholdCeiling,
    );
    // The peak threshold during the second half of the run should be
    // higher than during the first half — this is the "ratcheting"
    // property the algorithm is supposed to exhibit.
    const half = Math.floor(results.length / 2);
    const firstHalfPeak = Math.max(
      ...results.slice(0, half).map((r) => r.threshold),
    );
    const secondHalfPeak = Math.max(
      ...results.slice(half).map((r) => r.threshold),
    );
    expect(secondHalfPeak).toBeGreaterThan(firstHalfPeak);
  });

  it("does not lower the threshold below the configured floor", () => {
    const detector = createStrokeDetector({
      thresholdFloor: 0.7,
      thresholdAlpha: 0.5,
    });
    // Quiet input below the floor for a long time.
    const samples: { value: number; timestampMs: number }[] = [];
    for (let t = 0; t < 5000; t += 20) {
      samples.push({ value: 0.05, timestampMs: t });
    }
    const { results } = drive(detector, samples);
    const minThreshold = Math.min(...results.map((r) => r.threshold));
    expect(minThreshold).toBe(0.7);
  });

  it("does not raise the threshold above the configured ceiling", () => {
    const detector = createStrokeDetector({
      thresholdFloor: 0.5,
      thresholdCeiling: 1.0,
      thresholdAlpha: 0.9,
      minStrokeGapMs: 100,
    });
    // Sustained huge values with brief dips so we stay in recovery often
    // enough for the threshold to climb. Without the dips we'd never be
    // in the recovery branch and the threshold would never update.
    const samples: { value: number; timestampMs: number }[] = [];
    for (let t = 0; t < 5000; t += 20) {
      // Mix small lows with large highs so the EMA sees big positive
      // deviations and the threshold has plenty of opportunities to
      // climb.
      samples.push({ value: t % 80 < 40 ? 100 : 0, timestampMs: t });
    }
    const { results } = drive(detector, samples);
    const maxThreshold = Math.max(...results.map((r) => r.threshold));
    expect(maxThreshold).toBeLessThanOrEqual(1.0 + 1e-9);
  });
});

describe("createStrokeDetector — baseline behaviour", () => {
  it("freezes the baseline EMA while value is above 1.15 * threshold", () => {
    const detector = createStrokeDetector({
      // Make the gate easy to hit and the EMA fast so any leak would
      // show up immediately.
      baselineAlpha: 0.5,
      thresholdFloor: 1.0,
      thresholdCeiling: 1.0,
    });
    // Seed baseline with a small positive value.
    detector.update(0.2, 0);
    const seededBaseline = detector.getState().baseline;
    expect(seededBaseline).toBeCloseTo(0.2, 6);

    // Now feed values well above the gate (1.15 * 1.0 = 1.15). The
    // baseline must NOT move.
    for (let t = 20; t < 1000; t += 20) {
      detector.update(50, t);
    }
    expect(detector.getState().baseline).toBeCloseTo(seededBaseline, 6);
  });

  it("tracks slow drift via the baseline EMA when value stays below the gate", () => {
    const detector = createStrokeDetector({
      baselineAlpha: 0.2, // fast enough to converge in ~50 samples
      thresholdFloor: 5.0, // gate is 1.15 * 5 = 5.75; everything below
      thresholdCeiling: 5.0,
    });
    // Ramp from 0 to 1 over 1 s so values stay well under the gate.
    for (let t = 0; t < 1000; t += 20) {
      const v = t / 1000;
      detector.update(v, t);
    }
    // The baseline EMA should have drifted upward toward the recent
    // values (~1) but not all the way (the EMA lag).
    const b = detector.getState().baseline;
    expect(b).toBeGreaterThan(0.5);
    expect(b).toBeLessThanOrEqual(1.0);
  });
});

describe("createStrokeDetector — reset", () => {
  it("returns to the initial state after reset", () => {
    const detector = createStrokeDetector();
    // Drive enough samples to mutate every piece of state.
    const wave = strokePulseTrain({
      amplitude: 2,
      pulseWidthSeconds: 0.4,
      periodSeconds: 1.5,
      durationSeconds: 6,
      sampleRateHz: 50,
    });
    drive(detector, wave);
    expect(detector.getState().strokeCount).toBeGreaterThan(0);
    detector.reset();
    expect(detector.getState()).toEqual({
      baseline: 0,
      threshold: DEFAULT_DETECTOR_CONFIG.initialThreshold,
      previousValue: 0,
      lastStrokeTimeMs: null,
      strokeCount: 0,
      cadenceSpm: DEFAULT_DETECTOR_CONFIG.initialCadenceSpm,
      instantCadenceSpm: 0,
    });
  });
});
