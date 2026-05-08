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

/** A single half-sine pulse starting at `startMs`. */
function singlePulse({
  amplitude,
  pulseWidthSeconds,
  startMs,
  trailingRestMs = 0,
  sampleRateHz = 50,
}: {
  amplitude: number;
  pulseWidthSeconds: number;
  startMs: number;
  trailingRestMs?: number;
  sampleRateHz?: number;
}): { value: number; timestampMs: number }[] {
  const dtMs = 1000 / sampleRateHz;
  const pulseSamples = Math.ceil((pulseWidthSeconds * 1000) / dtMs);
  const restSamples = Math.ceil(trailingRestMs / dtMs);
  const samples: { value: number; timestampMs: number }[] = [];
  for (let i = 0; i < pulseSamples; i++) {
    const tInPulseMs = i * dtMs;
    const v =
      amplitude * Math.sin((Math.PI * tInPulseMs) / (pulseWidthSeconds * 1000));
    samples.push({ value: v, timestampMs: startMs + tInPulseMs });
  }
  for (let i = 0; i < restSamples; i++) {
    samples.push({
      value: 0,
      timestampMs: startMs + pulseSamples * dtMs + i * dtMs,
    });
  }
  return samples;
}

// ---------------------------------------------------------------------------
// Counting / state-machine semantics
// ---------------------------------------------------------------------------

describe("createStrokeDetector v2 — counting", () => {
  it("counts one stroke per pulse on a steady stroke-pulse train", () => {
    // 1.5 s period -> 40 spm; 12 s of data -> 8 strokes. Pulses are wide
    // enough that drive duration clears `minDriveDurationMs` and impulse
    // clears `minStrokeImpulse`.
    const detector = createStrokeDetector();
    const wave = strokePulseTrain({
      amplitude: 2,
      pulseWidthSeconds: 0.5,
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
      pulseWidthSeconds: 0.5,
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
      pulseWidthSeconds: 0.5,
      periodSeconds: 1.5,
      durationSeconds: 6,
      sampleRateHz: 50,
    });
    const { strokeIndices } = drive(detector, wave);
    expect(strokeIndices.length).toBe(0);
  });

  it("fires exactly once per clean pulse, on the falling edge", () => {
    // One isolated pulse: assert that exactly one stroke fires, and that
    // it fires AFTER the peak — i.e. on the falling half of the bump.
    const detector = createStrokeDetector();
    const wave = singlePulse({
      amplitude: 2,
      pulseWidthSeconds: 0.5,
      startMs: 0,
      trailingRestMs: 1500,
    });
    const { results, strokeIndices } = drive(detector, wave);
    expect(strokeIndices.length).toBe(1);

    // Half-sine peak is at pulseWidth/2 = 250 ms. The end-of-drive
    // trigger sample must come strictly later than that.
    const fireIdx = strokeIndices[0];
    const fireTs = wave[fireIdx].timestampMs;
    expect(fireTs).toBeGreaterThan(250);
    expect(fireTs).toBeLessThan(500);

    // The state machine should have returned to IDLE by the very next
    // sample; no further strokes should fire from this pulse.
    expect(results[fireIdx].strokeJustDetected).toBe(true);
    expect(results[fireIdx + 1]?.strokeJustDetected ?? false).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Gate rejections
// ---------------------------------------------------------------------------

describe("createStrokeDetector v2 — gate rejections", () => {
  it("rejects a sub-200 ms blip even with a tall peak (fails minDriveDurationMs)", () => {
    // Tall narrow spike: peak well above any reasonable threshold, plenty
    // of impulse, but the *drive duration* (arm-crossing → peak) is far
    // below the 200 ms gate.
    //
    // We freeze the threshold at the floor (`thresholdAlpha: 0`) so the
    // arm threshold and bigEnough gate are both predictable and the test
    // is exercising minDriveDurationMs in isolation.
    const detector = createStrokeDetector({
      thresholdAlpha: 0,
      thresholdFloor: 0.5,
      minStrokeImpulse: 0.0, // disable impulse gate to isolate duration
    });
    const wave = singlePulse({
      amplitude: 10,
      pulseWidthSeconds: 0.18, // 180 ms total → peak at 90 ms
      startMs: 0,
      trailingRestMs: 1500,
    });
    const { strokeIndices } = drive(detector, wave);
    expect(strokeIndices.length).toBe(0);
  });

  it("rejects a long shallow pulse below minStrokeImpulse", () => {
    // Pulse is wide enough (drive duration > 200 ms) and tall enough to
    // arm and pass bigEnough, but its integrated impulse is well under
    // the 0.5 m/s gate.
    //
    // Freezing the threshold + raising the impulse gate makes this the
    // single failing condition.
    const detector = createStrokeDetector({
      thresholdAlpha: 0,
      thresholdFloor: 0.4,
      minStrokeImpulse: 1.0,
    });
    const wave = singlePulse({
      amplitude: 0.7,
      pulseWidthSeconds: 0.5, // peak at 250 ms; impulse ≈ 0.16 m/s
      startMs: 0,
      trailingRestMs: 1500,
    });
    const { strokeIndices } = drive(detector, wave);
    expect(strokeIndices.length).toBe(0);
  });

  it("rejects a wide low pulse whose peak is below the dynamic threshold", () => {
    // Wide pulse: long drive duration, plenty of impulse, but the peak
    // never reaches the threshold floor.
    //
    // The release-threshold is 0.4 × 0.9 = 0.36 and end-of-drive fires
    // at 0.5 × peak = 0.4, so the candidate makes it to end-of-drive
    // before the release-cancel kicks in — exactly the path we want to
    // cover for the bigEnough gate.
    const detector = createStrokeDetector({
      thresholdAlpha: 0,
      thresholdFloor: 0.9,
      minStrokeImpulse: 0.0, // disable impulse gate to isolate bigEnough
    });
    const wave = singlePulse({
      amplitude: 0.8,
      pulseWidthSeconds: 2.0, // peak at 1000 ms; impulse ≈ 0.86 m/s
      startMs: 0,
      trailingRestMs: 1500,
    });
    const { strokeIndices } = drive(detector, wave);
    expect(strokeIndices.length).toBe(0);
  });

  it("cancels an ARMED candidate when value drops below releaseThreshold", () => {
    // A pulse that arms but immediately collapses below the release
    // threshold should NOT fire and should leave the state machine back
    // in IDLE (verified by feeding a real stroke afterwards and observing
    // it counts cleanly).
    const detector = createStrokeDetector({
      thresholdAlpha: 0,
      thresholdFloor: 1.0,
    });
    const samples: { value: number; timestampMs: number }[] = [];
    // Quiet → arm-crossing spike → quiet (cancel).
    samples.push({ value: 0, timestampMs: 0 });
    samples.push({ value: 0.6, timestampMs: 20 }); // arms (≥ 0.5 × 1.0)
    samples.push({ value: 0.1, timestampMs: 40 }); // < 0.4 × 1.0 → cancel
    // Then a real stroke pulse, well after refractory.
    const real = singlePulse({
      amplitude: 3,
      pulseWidthSeconds: 0.5,
      startMs: 2000,
      trailingRestMs: 500,
    });
    samples.push(...real);
    const { strokeIndices } = drive(detector, samples);
    expect(strokeIndices.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Refractory period
// ---------------------------------------------------------------------------

describe("createStrokeDetector v2 — refractory period", () => {
  it("blocks a second stroke whose peak lands inside minStrokeGapMs", () => {
    const detector = createStrokeDetector({ minStrokeGapMs: 2000 });
    // Two real pulses 1.0 s apart — well inside the 2 s refractory
    // window, so only the first should count.
    const samples = [
      ...singlePulse({
        amplitude: 2,
        pulseWidthSeconds: 0.5,
        startMs: 0,
        trailingRestMs: 200,
      }),
      ...singlePulse({
        amplitude: 2,
        pulseWidthSeconds: 0.5,
        startMs: 1000,
        trailingRestMs: 1500,
      }),
    ];
    const { strokeIndices } = drive(detector, samples);
    expect(strokeIndices.length).toBe(1);
  });

  it("admits a second stroke once minStrokeGapMs has elapsed", () => {
    const detector = createStrokeDetector({ minStrokeGapMs: 1000 });
    const samples = [
      ...singlePulse({
        amplitude: 2,
        pulseWidthSeconds: 0.5,
        startMs: 0,
        trailingRestMs: 1500,
      }),
      ...singlePulse({
        amplitude: 2,
        pulseWidthSeconds: 0.5,
        startMs: 2000,
        trailingRestMs: 1500,
      }),
    ];
    const { strokeIndices } = drive(detector, samples);
    expect(strokeIndices.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Cadence
// ---------------------------------------------------------------------------

describe("createStrokeDetector v2 — cadence", () => {
  it("settles instantaneous cadence near the driving period after a few strokes", () => {
    // 2.0 s per stroke -> 30 spm.
    const detector = createStrokeDetector({
      cadenceEmaAlpha: 1.0, // smoothed = instant for this test
      initialCadenceSpm: 30,
    });
    const wave = strokePulseTrain({
      amplitude: 2,
      pulseWidthSeconds: 0.5,
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

  it("smoothes cadence with the configured EMA alpha (peak-to-peak gaps)", () => {
    // Three real pulses whose peaks are ~2.0 s and then ~1.1 s apart.
    // With cadenceEmaAlpha = 0.5 the smoothed cadence should NOT snap to
    // the last (faster) instantaneous value. We override
    // `minStrokeGapMs` slightly below the second gap so the third stroke
    // is not refractory-blocked.
    const detector = createStrokeDetector({
      cadenceEmaAlpha: 0.5,
      initialCadenceSpm: 20,
      minStrokeGapMs: 900,
    });
    const samples = [
      ...singlePulse({
        amplitude: 2,
        pulseWidthSeconds: 0.5,
        startMs: 0,
        trailingRestMs: 1300,
      }),
      ...singlePulse({
        amplitude: 2,
        pulseWidthSeconds: 0.5,
        startMs: 2000,
        trailingRestMs: 400,
      }),
      ...singlePulse({
        amplitude: 2,
        pulseWidthSeconds: 0.5,
        startMs: 3100,
        trailingRestMs: 500,
      }),
    ];
    const { results } = drive(detector, samples);
    const last = results[results.length - 1];
    // Peaks at ~250, ~2250, ~3350 ms. Gaps: 2.0 s (30 spm), 1.1 s
    // (≈54.5 spm). EMA: seed=20 → 0.5·20 + 0.5·30 = 25 → 0.5·25 + 0.5·54.5 ≈ 39.7
    expect(last.cadenceSpm).toBeGreaterThan(35);
    expect(last.cadenceSpm).toBeLessThan(50);
  });
});

// ---------------------------------------------------------------------------
// Threshold dynamics (carried over from v1; semantics are unchanged)
// ---------------------------------------------------------------------------

describe("createStrokeDetector v2 — threshold dynamics", () => {
  it("ratchets the threshold upward as bigger strokes arrive", () => {
    const config: Partial<StrokeDetectorConfig> = {
      thresholdFloor: 0.5,
      thresholdAlpha: 0.2,
      minStrokeGapMs: 500,
      // Looser gates so larger pulses don't get accidentally rejected.
      minDriveDurationMs: 0,
      minStrokeImpulse: 0,
    };
    const detector = createStrokeDetector(config);
    const samples: { value: number; timestampMs: number }[] = [];
    const sampleRateHz = 50;
    const dtMs = 1000 / sampleRateHz;
    let amplitude = 1;
    for (let p = 0; p < 8; p++) {
      const baseT = p * 1000;
      // 200 ms half-sine pulse, 800 ms quiet rest.
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
    const peakThreshold = Math.max(...results.map((r) => r.threshold));
    expect(peakThreshold).toBeGreaterThan(1.0);
    expect(peakThreshold).toBeLessThan(
      DEFAULT_DETECTOR_CONFIG.thresholdCeiling,
    );
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
    for (let t = 0; t < 5000; t += 20) {
      detector.update(0.05, t);
    }
    expect(detector.getState().threshold).toBe(0.7);
  });

  it("does not raise the threshold above the configured ceiling", () => {
    const detector = createStrokeDetector({
      thresholdFloor: 0.5,
      thresholdCeiling: 1.0,
      thresholdAlpha: 0.9,
      minStrokeGapMs: 100,
    });
    const samples: { value: number; timestampMs: number }[] = [];
    for (let t = 0; t < 5000; t += 20) {
      samples.push({ value: t % 80 < 40 ? 100 : 0, timestampMs: t });
    }
    const { results } = drive(detector, samples);
    const maxThreshold = Math.max(...results.map((r) => r.threshold));
    expect(maxThreshold).toBeLessThanOrEqual(1.0 + 1e-9);
  });
});

// ---------------------------------------------------------------------------
// Baseline behaviour (unchanged from v1)
// ---------------------------------------------------------------------------

describe("createStrokeDetector v2 — baseline behaviour", () => {
  it("freezes the baseline EMA while value is above 1.15 × threshold", () => {
    const detector = createStrokeDetector({
      baselineAlpha: 0.5,
      thresholdFloor: 1.0,
      thresholdCeiling: 1.0,
    });
    detector.update(0.2, 0);
    const seededBaseline = detector.getState().baseline;
    expect(seededBaseline).toBeCloseTo(0.2, 6);
    for (let t = 20; t < 1000; t += 20) {
      detector.update(50, t);
    }
    expect(detector.getState().baseline).toBeCloseTo(seededBaseline, 6);
  });

  it("tracks slow drift via the baseline EMA when value stays below the gate", () => {
    const detector = createStrokeDetector({
      baselineAlpha: 0.2,
      thresholdFloor: 5.0,
      thresholdCeiling: 5.0,
    });
    for (let t = 0; t < 1000; t += 20) {
      detector.update(t / 1000, t);
    }
    const b = detector.getState().baseline;
    expect(b).toBeGreaterThan(0.5);
    expect(b).toBeLessThanOrEqual(1.0);
  });
});

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

describe("createStrokeDetector v2 — reset", () => {
  it("returns to the initial state after reset", () => {
    const detector = createStrokeDetector();
    const wave = strokePulseTrain({
      amplitude: 2,
      pulseWidthSeconds: 0.5,
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
      phase: "IDLE",
      candidateStartMs: null,
      candidatePeak: 0,
      candidatePeakMs: null,
      candidateImpulse: 0,
      candidateArmThreshold: DEFAULT_DETECTOR_CONFIG.initialThreshold,
      lastSampleMs: null,
    });
  });
});
