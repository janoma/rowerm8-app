import { GRAVITY_MPS2 } from "@/lib/units";

import {
  fixedAxisProjector,
  magnitudeProjector,
  pcaProjector,
} from "@/lib/stroke/projector";
import type { Vec3Sample } from "@/lib/stroke/types";

function feed(
  projector: ReturnType<typeof magnitudeProjector>,
  samples: { sample: Vec3Sample; tMs: number }[],
): number[] {
  return samples.map(({ sample, tMs }) => projector.project(sample, tMs));
}

describe("magnitudeProjector", () => {
  it("collapses a constant gravity vector to ~zero after the EMA settles", () => {
    const projector = magnitudeProjector({ restEmaAlpha: 0.5 });
    // 200 samples of pure +Z gravity; output should converge to zero as
    // the rest EMA tracks |a| = g.
    let last = 0;
    for (let i = 0; i < 200; i++) {
      last = projector.project({ x: 0, y: 0, z: GRAVITY_MPS2 }, i * 20);
    }
    expect(Math.abs(last)).toBeLessThan(1e-9);
  });

  it("emits the deviation magnitude when a transient bump arrives", () => {
    const projector = magnitudeProjector({ restEmaAlpha: 0.05 });
    // First settle on +Z gravity.
    for (let i = 0; i < 200; i++) {
      projector.project({ x: 0, y: 0, z: GRAVITY_MPS2 }, i * 20);
    }
    // Then a brief sideways spike — the magnitude jumps above rest.
    const out = projector.project({ x: 5, y: 0, z: GRAVITY_MPS2 }, 201 * 20);
    // ||(5, 0, g)|| = sqrt(25 + g^2) ≈ 11.0 — minus rest ≈ 9.81 ≈ 1.2.
    expect(out).toBeGreaterThan(1.0);
    expect(out).toBeLessThan(1.5);
  });

  it("reset() forgets the rest EMA so the next sample re-seeds it", () => {
    const projector = magnitudeProjector();
    for (let i = 0; i < 50; i++) {
      projector.project({ x: 0, y: 0, z: GRAVITY_MPS2 }, i * 20);
    }
    projector.reset();
    // First post-reset sample seeds rest -> output is exactly zero.
    expect(projector.project({ x: 7, y: 0, z: 0 }, 0)).toBe(0);
  });
});

describe("fixedAxisProjector", () => {
  it("returns the chosen axis verbatim", () => {
    const xp = fixedAxisProjector("x");
    const yp = fixedAxisProjector("y");
    const zp = fixedAxisProjector("z");
    const sample: Vec3Sample = { x: 1, y: 2, z: 3 };
    expect(xp.project(sample, 0)).toBe(1);
    expect(yp.project(sample, 0)).toBe(2);
    expect(zp.project(sample, 0)).toBe(3);
  });

  it("is stateless across reset()", () => {
    const p = fixedAxisProjector("y");
    expect(p.project({ x: 0, y: 7, z: 0 }, 0)).toBe(7);
    p.reset();
    expect(p.project({ x: 0, y: 7, z: 0 }, 0)).toBe(7);
  });
});

describe("pcaProjector", () => {
  /**
   * Build a sample sequence that varies along a single 3D direction. The
   * dominant principal axis should align with that direction.
   */
  function samplesAlongDirection(
    direction: Vec3Sample,
    amplitudes: number[],
    sampleRateHz = 50,
  ): { sample: Vec3Sample; tMs: number }[] {
    const norm = Math.sqrt(
      direction.x * direction.x +
        direction.y * direction.y +
        direction.z * direction.z,
    );
    const u = {
      x: direction.x / norm,
      y: direction.y / norm,
      z: direction.z / norm,
    };
    const dtMs = 1000 / sampleRateHz;
    return amplitudes.map((amp, i) => ({
      sample: { x: u.x * amp, y: u.y * amp, z: u.z * amp },
      tMs: i * dtMs,
    }));
  }

  it("recovers the dominant axis of a known 1D-varying signal", () => {
    const direction = { x: 1, y: 2, z: 0 };
    const amps: number[] = [];
    for (let i = 0; i < 200; i++) {
      amps.push(Math.sin((2 * Math.PI * i) / 25));
    }
    const samples = samplesAlongDirection(direction, amps);
    const projector = pcaProjector({
      covarianceAlpha: 0.05,
      refitEveryMs: 100,
      warmupSamples: 30,
      powerIterationSteps: 32,
    });
    const projected = feed(projector, samples);
    // Once warmed up, the projection should track the underlying
    // 1D signal up to a sign and scale. We compare the absolute
    // correlation of the second half (post-warmup) of the data with
    // the underlying amplitude.
    const tail = projected.slice(120);
    const truth = amps.slice(120);
    const corr = absCorrelation(tail, truth);
    expect(corr).toBeGreaterThan(0.95);
  });

  it("preserves sign continuity across refits", () => {
    // Drive the projector with a signal that varies along (1,2,0) for a
    // while, then continues with the same direction. The projected
    // values should not flip sign across refit boundaries — eigenvectors
    // are sign-ambiguous, but our sign-stabilisation should keep things
    // continuous.
    const direction = { x: 1, y: 2, z: 0 };
    const amps: number[] = [];
    for (let i = 0; i < 600; i++) {
      amps.push(Math.sin((2 * Math.PI * i) / 25));
    }
    const samples = samplesAlongDirection(direction, amps);
    const projector = pcaProjector({
      covarianceAlpha: 0.1, // fast, so refits actually change something
      refitEveryMs: 200,
      warmupSamples: 30,
    });
    const projected = feed(projector, samples);
    // Look at the post-warmup segment; check no large sign flip with
    // similar-magnitude neighbours (a sign flip would show as
    // sign(projected[i]) != sign(amps[i]) suddenly inverting around a
    // refit boundary). We use the absolute correlation as a proxy.
    const tail = projected.slice(120);
    const truth = amps.slice(120);
    expect(rawCorrelation(tail, truth)).toBeGreaterThan(0.9);
  });

  it("falls back to centred magnitude during the warmup period", () => {
    const projector = pcaProjector({
      warmupSamples: 50,
      refitEveryMs: 1000,
    });
    // First sample seeds the mean -> centred value is zero.
    expect(projector.project({ x: 1, y: 2, z: 3 }, 0)).toBe(0);
    // A second, very different sample produces a non-zero centred
    // magnitude (|sample - mean|).
    const out = projector.project({ x: 5, y: 0, z: 0 }, 20);
    expect(out).not.toBe(0);
  });

  it("reset() clears all state so a fresh axis is fitted", () => {
    const projector = pcaProjector({
      covarianceAlpha: 0.1,
      warmupSamples: 30,
      refitEveryMs: 50,
    });
    // Drive along X to fit the X axis.
    for (let i = 0; i < 100; i++) {
      projector.project({ x: Math.sin(i / 5), y: 0, z: 0 }, i * 20);
    }
    projector.reset();
    // After reset, drive along Y; the new axis should align with Y, not X.
    const projected: number[] = [];
    const truth: number[] = [];
    for (let i = 0; i < 200; i++) {
      const y = Math.sin(i / 5);
      projected.push(projector.project({ x: 0, y, z: 0 }, i * 20));
      truth.push(y);
    }
    // If the axis still pointed along X, projections would be near zero
    // for all i. A correctly re-fitted projector tracks the Y signal up
    // to a sign and an EMA-driven scale; either way the post-warmup tail
    // should correlate strongly with the true Y value. We use 0.85 (not
    // 1.0) because the EMA mean tracker introduces phase lag that
    // dampens the centred signal slightly even when the axis is
    // perfectly aligned.
    const tail = projected.slice(60);
    const truthTail = truth.slice(60);
    expect(absCorrelation(tail, truthTail)).toBeGreaterThan(0.85);
  });
});

// --- helpers --------------------------------------------------------------

function rawCorrelation(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }
  const meanA = a.reduce((s, v) => s + v, 0) / a.length;
  const meanB = b.reduce((s, v) => s + v, 0) / b.length;
  let num = 0;
  let denomA = 0;
  let denomB = 0;
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denomA += da * da;
    denomB += db * db;
  }
  const denom = Math.sqrt(denomA * denomB);
  return denom === 0 ? 0 : num / denom;
}

function absCorrelation(a: number[], b: number[]): number {
  return Math.abs(rawCorrelation(a, b));
}
