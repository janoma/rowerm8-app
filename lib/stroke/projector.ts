/**
 * 3D-to-1D projectors for the stroke detector.
 *
 * The Dart snippet treated the rowing motion as one-dimensional: the user
 * passed in a single scalar `value` per sample. In practice the IMU gives us
 * three axes whose meaning depends entirely on how the device is oriented
 * (phone in a holder vs WitMotion strapped to a seat), so we need an
 * orientation-agnostic way to collapse three axes into one.
 *
 * Three projectors are provided:
 *
 *   - `magnitudeProjector`: `||a|| - rest`. Always available; ignores
 *     orientation; loses sign asymmetry.
 *   - `fixedAxisProjector`: pulls a single axis. Fast and deterministic when
 *     the mounting is known; useful for tests and known calibrations.
 *   - `pcaProjector`: continuously fits the dominant axis of recent
 *     acceleration variance and projects every sample onto it. Best fidelity
 *     to the 1D-rowing-motion assumption the Dart code was written under.
 *
 * Every projector is pure-state (no I/O) and exposes `reset()` so a session
 * can start clean.
 */

import type { Projector, SymMat3, Vec3Sample } from "./types";

// --- Magnitude projector --------------------------------------------------

export type MagnitudeProjectorConfig = {
  /**
   * Restricts how quickly the "rest" magnitude EMA tracks the live signal.
   * Smaller = slower (more inertia, better at ignoring strokes); larger =
   * faster. We default to ~1 second of effective averaging at 50 Hz, which
   * is slow enough that strokes don't pull rest along but fast enough that
   * the user can pick the phone up and put it down without waiting forever
   * for the baseline to settle.
   */
  restEmaAlpha: number;
};

export const DEFAULT_MAGNITUDE_CONFIG: MagnitudeProjectorConfig = {
  restEmaAlpha: 0.02,
};

/**
 * Project as `||a||` minus a slow EMA "rest" magnitude. Subtracting the rest
 * value is what removes the constant gravity bias (~9.81 m/s^2) so the
 * detector sees a signal that wobbles around zero rather than around 1g.
 */
export function magnitudeProjector(
  config: Partial<MagnitudeProjectorConfig> = {},
): Projector {
  const cfg = { ...DEFAULT_MAGNITUDE_CONFIG, ...config };
  let rest = 0;
  let initialized = false;

  return {
    project(sample: Vec3Sample): number {
      const m = Math.sqrt(
        sample.x * sample.x + sample.y * sample.y + sample.z * sample.z,
      );
      if (!initialized) {
        rest = m;
        initialized = true;
      } else {
        rest = (1 - cfg.restEmaAlpha) * rest + cfg.restEmaAlpha * m;
      }
      return m - rest;
    },
    reset(): void {
      rest = 0;
      initialized = false;
    },
  };
}

// --- Fixed-axis projector -------------------------------------------------

export type Axis = "x" | "y" | "z";

/**
 * Project onto a single named axis. No EMA / DC removal — callers that need
 * gravity-removed input should wrap this with a high-pass filter, or use the
 * magnitude projector instead.
 */
export function fixedAxisProjector(axis: Axis): Projector {
  return {
    project(sample: Vec3Sample): number {
      return sample[axis];
    },
    reset(): void {
      // stateless
    },
  };
}

// --- PCA projector --------------------------------------------------------

export type PcaProjectorConfig = {
  /**
   * EMA alpha applied to the running mean and covariance matrix. Smaller =
   * slower adaptation (more stable axis, slower to follow re-orientation);
   * larger = faster. Default of 0.02 corresponds to ~1 s of effective
   * memory at 50 Hz which works well for indoor rowing where the device
   * stays put.
   */
  covarianceAlpha: number;
  /**
   * Refit the principal axis at most this often (ms). Power iteration on a
   * 3x3 matrix is cheap, but we still throttle it because the dominant
   * direction simply doesn't change between consecutive 50 Hz samples.
   */
  refitEveryMs: number;
  /**
   * Skip the first N samples before publishing a fitted axis. Until then,
   * `project()` falls back to the magnitude minus its EMA mean — this
   * prevents the first few samples from getting projected onto a degenerate
   * axis derived from a covariance matrix that has barely accumulated
   * anything.
   */
  warmupSamples: number;
  /**
   * Power-iteration cap. The 3x3 dominant eigenvector converges in a
   * handful of iterations even from a random seed, so 16 is plenty.
   */
  powerIterationSteps: number;
};

export const DEFAULT_PCA_CONFIG: PcaProjectorConfig = {
  covarianceAlpha: 0.02,
  refitEveryMs: 250,
  warmupSamples: 30,
  powerIterationSteps: 16,
};

/**
 * Continuously-fitted principal-axis projector.
 *
 * Math sketch:
 *
 *   - Maintain an EMA of the mean `mu` and an EMA of the centred outer
 *     product `(a - mu)(a - mu)^T`. After enough samples this converges to
 *     the covariance matrix in a stable frame.
 *   - Periodically run power iteration on `cov` to extract the dominant
 *     eigenvector `v` (the direction of greatest acceleration variance).
 *   - Project the centred sample onto `v`: `signed = (a - mu) . v`.
 *   - Maintain a sign convention by aligning each newly fitted `v` against
 *     the previously published one (eigenvectors are sign-ambiguous; we
 *     don't want the cadence signal to invert mid-session).
 */
export function pcaProjector(
  config: Partial<PcaProjectorConfig> = {},
): Projector {
  const cfg = { ...DEFAULT_PCA_CONFIG, ...config };
  // Seed the axis with a non-axis-aligned direction. Power iteration on
  // a covariance matrix that lacks variance along the seed direction will
  // produce a zero matrix-vector product and stall, so a uniform seed
  // (1,1,1)/sqrt(3) avoids the failure mode of seeding parallel to (or
  // orthogonal to) the dominant subspace.
  const SEED_AXIS = (() => {
    const k = 1 / Math.sqrt(3);
    return { x: k, y: k, z: k };
  })();

  let sampleCount = 0;
  let mu = { x: 0, y: 0, z: 0 };
  let cov: SymMat3 = { xx: 0, yy: 0, zz: 0, xy: 0, xz: 0, yz: 0 };
  let axis = { ...SEED_AXIS };
  let axisFitted = false;
  let lastFitMs: number | null = null;

  function reset(): void {
    sampleCount = 0;
    mu = { x: 0, y: 0, z: 0 };
    cov = { xx: 0, yy: 0, zz: 0, xy: 0, xz: 0, yz: 0 };
    axis = { ...SEED_AXIS };
    axisFitted = false;
    lastFitMs = null;
  }

  function project(sample: Vec3Sample, timestampMs: number): number {
    sampleCount += 1;

    // EMA of the mean. Seed with the first sample so we don't spend N
    // iterations pulling the mean off (0,0,0).
    if (sampleCount === 1) {
      mu = { x: sample.x, y: sample.y, z: sample.z };
    } else {
      const a = cfg.covarianceAlpha;
      mu = {
        x: (1 - a) * mu.x + a * sample.x,
        y: (1 - a) * mu.y + a * sample.y,
        z: (1 - a) * mu.z + a * sample.z,
      };
    }

    const dx = sample.x - mu.x;
    const dy = sample.y - mu.y;
    const dz = sample.z - mu.z;

    // EMA of the centred outer product. Same alpha as the mean keeps the
    // two estimators in sync.
    const a = cfg.covarianceAlpha;
    cov = {
      xx: (1 - a) * cov.xx + a * dx * dx,
      yy: (1 - a) * cov.yy + a * dy * dy,
      zz: (1 - a) * cov.zz + a * dz * dz,
      xy: (1 - a) * cov.xy + a * dx * dy,
      xz: (1 - a) * cov.xz + a * dx * dz,
      yz: (1 - a) * cov.yz + a * dy * dz,
    };

    // Refit if enough wall-clock has elapsed and we're past the warmup.
    const dueForRefit =
      lastFitMs == null || timestampMs - lastFitMs >= cfg.refitEveryMs;
    if (sampleCount >= cfg.warmupSamples && dueForRefit) {
      const next = dominantEigenvector3(cov, axis, cfg.powerIterationSteps);
      // Sign convention: keep the new axis pointing the same way as the
      // previously published one whenever the dot product would otherwise
      // flip. This keeps the projected signal continuous across refits.
      const dot = next.x * axis.x + next.y * axis.y + next.z * axis.z;
      axis = dot < 0 ? { x: -next.x, y: -next.y, z: -next.z } : next;
      axisFitted = true;
      lastFitMs = timestampMs;
    }

    // Before the axis is fitted, fall back to centred magnitude. This gives
    // the detector something usable during the first ~half second instead
    // of zeroes (which would make the threshold seed look like noise).
    if (!axisFitted) {
      const mag = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // Sign of dx as a tie-break so it's not strictly positive — the
      // detector's upward-crossing logic doesn't care, but the value reads
      // more naturally on a debug graph.
      return dx >= 0 ? mag : -mag;
    }

    return dx * axis.x + dy * axis.y + dz * axis.z;
  }

  return { project, reset };
}

/**
 * Power-iteration estimate of the dominant eigenvector of a 3x3 symmetric
 * matrix. Returns a unit vector (or the seed if the input is degenerate).
 */
function dominantEigenvector3(
  cov: SymMat3,
  seed: { x: number; y: number; z: number },
  steps: number,
): { x: number; y: number; z: number } {
  // Two seeds: the caller's preferred direction (good for sign continuity)
  // and a uniform fallback. If the first one produces a zero matrix-vector
  // product (seed lies in a null subspace of `cov`), retry with the
  // fallback so we don't get stuck on degenerate data.
  const k = 1 / Math.sqrt(3);
  const fallback = { x: k, y: k, z: k };
  for (const start of [seed, fallback]) {
    let v = { ...start };
    if (v.x === 0 && v.y === 0 && v.z === 0) {
      v = { ...fallback };
    }
    let stalled = false;
    for (let i = 0; i < steps; i++) {
      const mx = cov.xx * v.x + cov.xy * v.y + cov.xz * v.z;
      const my = cov.xy * v.x + cov.yy * v.y + cov.yz * v.z;
      const mz = cov.xz * v.x + cov.yz * v.y + cov.zz * v.z;
      const norm = Math.sqrt(mx * mx + my * my + mz * mz);
      if (norm === 0 || !Number.isFinite(norm)) {
        stalled = true;
        break;
      }
      v = { x: mx / norm, y: my / norm, z: mz / norm };
    }
    if (!stalled) {
      return v;
    }
  }
  // Both seeds stalled — covariance is identically zero (no motion). Keep
  // the original caller seed so the projection direction stays stable.
  return { ...seed };
}
