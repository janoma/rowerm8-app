/**
 * Cadence-driven pace estimator.
 *
 * The IMU alone cannot tell us boat speed (double-integrating acceleration
 * to displacement drifts badly within a single stroke), but for indoor
 * rowing we can derive a usable estimate from cadence + a per-user
 * "meters per stroke" calibration constant. Until the calibration flow
 * exists this constant is a placeholder; see TODO(calibration) below.
 *
 * Math:
 *
 *     boatSpeedMps        = metersPerStroke * cadenceSpm / 60
 *     paceSecondsPer500m  = mpsToSecondsPer500m(boatSpeedMps)
 *
 * Pace is routed through {@link mpsToSecondsPer500m} so all SI/pace
 * conversions go through the same helper as the rest of the app — there
 * is no inline `500 / x` here.
 */

import { mpsToSecondsPer500m, SECONDS_PER_MINUTE } from "@/lib/units";

/**
 * TODO(calibration): replace the default with a per-user value once the
 * indoor-rowing calibration flow is in place. ~8 m/stroke is a plausible
 * mid-range placeholder for an adult on a standard ergometer at moderate
 * intensity; it is **not** a reliable estimate.
 */
export const DEFAULT_METERS_PER_STROKE = 8;

export type PaceEstimateOptions = {
  /** Per-user calibration: meters of boat displacement per stroke. */
  metersPerStroke?: number;
};

/**
 * Estimate boat speed (m/s) from cadence (strokes/min) and a calibration
 * constant. Zero / non-finite inputs collapse to zero.
 */
export function estimateBoatSpeedMps(
  cadenceSpm: number,
  options: PaceEstimateOptions = {},
): number {
  const metersPerStroke = options.metersPerStroke ?? DEFAULT_METERS_PER_STROKE;
  if (
    !Number.isFinite(cadenceSpm) ||
    cadenceSpm <= 0 ||
    !Number.isFinite(metersPerStroke) ||
    metersPerStroke <= 0
  ) {
    return 0;
  }
  return (metersPerStroke * cadenceSpm) / SECONDS_PER_MINUTE;
}

/**
 * Estimate pace (seconds per 500 m) from cadence. Returns `Infinity` when
 * speed is non-positive so callers can render the conventional "—"
 * placeholder via {@link import("@/lib/format").formatPace}.
 */
export function estimatePaceSecondsPer500m(
  cadenceSpm: number,
  options: PaceEstimateOptions = {},
): number {
  return mpsToSecondsPer500m(estimateBoatSpeedMps(cadenceSpm, options));
}
