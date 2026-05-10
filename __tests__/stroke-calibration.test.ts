/**
 * @jest-environment node
 *
 * Pure tests for the cadence-calibration gate. The module is a
 * deterministic switch over `(strokeCount, gap CV, elapsed since first
 * stroke)`; we exercise each of those branches in isolation.
 */
import {
  CALIBRATION_CONFIG,
  calibrationStatus,
} from "@/lib/stroke/calibration";

const t0 = 1_700_000_000_000;

function call(overrides: {
  strokeCount?: number;
  recentGapsMs?: readonly number[];
  firstStrokeAtMs?: number | null;
  nowMs?: number;
}) {
  return calibrationStatus({
    strokeCount: 0,
    recentGapsMs: [],
    firstStrokeAtMs: null,
    nowMs: t0,
    ...overrides,
  });
}

describe("calibrationStatus — base states", () => {
  it("returns 'idle' before any strokes are detected", () => {
    expect(call({})).toBe("idle");
  });

  it("returns 'idle' when strokeCount > 0 but firstStrokeAtMs is null", () => {
    // Defensive: a caller that bumps strokeCount without anchoring the
    // first-stroke timestamp shouldn't be flipped into calibrating.
    expect(call({ strokeCount: 5, firstStrokeAtMs: null })).toBe("idle");
  });

  it("returns 'calibrating' between strokes 1 and minStrokes-1 regardless of CV", () => {
    for (const sc of [1, 2]) {
      expect(
        call({
          strokeCount: sc,
          firstStrokeAtMs: t0 - 1_000,
          recentGapsMs: [2_500, 2_500],
          nowMs: t0,
        }),
      ).toBe("calibrating");
    }
  });
});

describe("calibrationStatus — CV criterion", () => {
  it("returns 'calibrated' when strokeCount >= minStrokes AND CV <= threshold", () => {
    expect(
      call({
        strokeCount: CALIBRATION_CONFIG.minStrokes,
        firstStrokeAtMs: t0 - 5_000,
        recentGapsMs: [2_500, 2_500, 2_500, 2_500],
        nowMs: t0,
      }),
    ).toBe("calibrated");
  });

  it("stays 'calibrating' when CV is too high even with enough strokes", () => {
    // gaps in seconds: 2.5, 2.5, 1.8, 3.4 → mean 2.55, stddev ≈ 0.572,
    // CV ≈ 0.224 — comfortably above the 0.13 threshold.
    expect(
      call({
        strokeCount: 5,
        firstStrokeAtMs: t0 - 10_000,
        recentGapsMs: [2_500, 2_500, 1_800, 3_400],
        nowMs: t0,
      }),
    ).toBe("calibrating");
  });

  it("considers only the trailing gapWindow gaps when computing CV", () => {
    // The first three (very noisy) gaps would tank the CV; the trailing
    // four are smooth, so calibrated should fire.
    const noisy = [4_000, 1_000, 5_000];
    const smooth = [2_500, 2_500, 2_500, 2_500];
    expect(
      call({
        strokeCount: noisy.length + smooth.length,
        firstStrokeAtMs: t0 - 30_000,
        recentGapsMs: [...noisy, ...smooth],
        nowMs: t0,
      }),
    ).toBe("calibrated");
  });

  it("requires at least 2 gaps before evaluating CV", () => {
    // 3 strokes only produces 2 gaps — that's the minimum the CV
    // computation needs. Anything lower returns null inside the
    // helper; we still report "calibrating" rather than throwing.
    expect(
      call({
        strokeCount: 3,
        firstStrokeAtMs: t0 - 5_000,
        recentGapsMs: [2_500],
        nowMs: t0,
      }),
    ).toBe("calibrating");
  });

  it("treats non-finite gap entries as a hard 'cannot evaluate'", () => {
    expect(
      call({
        strokeCount: 5,
        firstStrokeAtMs: t0 - 10_000,
        recentGapsMs: [2_500, Number.NaN, 2_500, 2_500],
        nowMs: t0,
      }),
    ).toBe("calibrating");
  });
});

describe("calibrationStatus — hard caps", () => {
  it("forces 'calibrated' once strokeCount hits hardCapStrokes regardless of CV", () => {
    expect(
      call({
        strokeCount: CALIBRATION_CONFIG.hardCapStrokes,
        firstStrokeAtMs: t0 - 10_000,
        // Wild rhythm — would not satisfy the CV criterion on its own.
        recentGapsMs: [4_000, 1_000, 5_000, 1_500],
        nowMs: t0,
      }),
    ).toBe("calibrated");
  });

  it("forces 'calibrated' once hardCapMs has elapsed since the first stroke", () => {
    expect(
      call({
        strokeCount: 4,
        firstStrokeAtMs: t0,
        recentGapsMs: [4_000, 1_000, 5_000, 1_500],
        nowMs: t0 + CALIBRATION_CONFIG.hardCapMs,
      }),
    ).toBe("calibrated");
  });

  it("does not fire the elapsed cap before hardCapMs", () => {
    expect(
      call({
        strokeCount: 4,
        firstStrokeAtMs: t0,
        recentGapsMs: [4_000, 1_000, 5_000, 1_500],
        nowMs: t0 + CALIBRATION_CONFIG.hardCapMs - 1,
      }),
    ).toBe("calibrating");
  });
});
