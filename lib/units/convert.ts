/**
 * Pure unit conversions. Every function is a *single* multiplication or
 * division through an exact constant in `./constants`. There is no chaining
 * (no `metersToMiles(metersToKm(x) * 1000)` style tricks) so the only
 * floating-point error is the one IEEE-754 step at the I/O boundary.
 *
 * Display code lives in `lib/format`; these helpers are intentionally free
 * of locale/formatting concerns so they can be unit-tested in isolation.
 */

import {
  GRAVITY_MPS2,
  JOULES_PER_KCAL,
  KG_PER_POUND,
  METERS_PER_KILOMETER,
  METERS_PER_MILE,
  METERS_PER_YARD,
  SECONDS_PER_HOUR,
} from "./constants";

// --- Distance --------------------------------------------------------------

export function metersToKilometers(meters: number): number {
  return meters / METERS_PER_KILOMETER;
}

export function kilometersToMeters(km: number): number {
  return km * METERS_PER_KILOMETER;
}

export function metersToMiles(meters: number): number {
  return meters / METERS_PER_MILE;
}

export function milesToMeters(miles: number): number {
  return miles * METERS_PER_MILE;
}

export function metersToYards(meters: number): number {
  return meters / METERS_PER_YARD;
}

export function yardsToMeters(yards: number): number {
  return yards * METERS_PER_YARD;
}

// --- Mass ------------------------------------------------------------------

export function kilogramsToPounds(kg: number): number {
  return kg / KG_PER_POUND;
}

export function poundsToKilograms(lb: number): number {
  return lb * KG_PER_POUND;
}

// --- Speed -----------------------------------------------------------------

export function mpsToKph(mps: number): number {
  return (mps * SECONDS_PER_HOUR) / METERS_PER_KILOMETER;
}

export function kphToMps(kph: number): number {
  return (kph * METERS_PER_KILOMETER) / SECONDS_PER_HOUR;
}

export function mpsToMph(mps: number): number {
  return (mps * SECONDS_PER_HOUR) / METERS_PER_MILE;
}

export function mphToMps(mph: number): number {
  return (mph * METERS_PER_MILE) / SECONDS_PER_HOUR;
}

// --- Pace ------------------------------------------------------------------
// Rowing's canonical pace is "seconds per 500 metres". Whatever happens at
// the display boundary, time/distance are always stored in SI (s and m), and
// the canonical pace is derived from those. These helpers let display code
// switch between the three common conventions without chaining conversions.

export function secondsPer500mToSecondsPerKm(spk500: number): number {
  return spk500 * 2;
}

export function secondsPer500mToSecondsPerMile(spk500: number): number {
  return (spk500 * METERS_PER_MILE) / 500;
}

export function secondsPerKmToSecondsPer500m(spk: number): number {
  return spk / 2;
}

export function secondsPerMileToSecondsPer500m(spm: number): number {
  return (spm * 500) / METERS_PER_MILE;
}

/**
 * Derive seconds-per-500m from raw SI speed. Returns `Infinity` when speed
 * is zero so callers can render the conventional "—" placeholder instead of
 * dividing by zero themselves.
 */
export function mpsToSecondsPer500m(mps: number): number {
  if (mps <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return 500 / mps;
}

// --- Energy ----------------------------------------------------------------

export function joulesToKcal(j: number): number {
  return j / JOULES_PER_KCAL;
}

export function kcalToJoules(kcal: number): number {
  return kcal * JOULES_PER_KCAL;
}

// --- Temperature -----------------------------------------------------------

export function celsiusToFahrenheit(c: number): number {
  return c * (9 / 5) + 32;
}

export function fahrenheitToCelsius(f: number): number {
  return (f - 32) * (5 / 9);
}

// --- Acceleration ----------------------------------------------------------
// Sensors that report in "g" must be normalized to m/s^2 at ingress. This is
// the *only* place this conversion should appear; never duplicate the literal
// 9.80665 elsewhere.

export function gToMps2(g: number): number {
  return g * GRAVITY_MPS2;
}

export function mps2ToG(mps2: number): number {
  return mps2 / GRAVITY_MPS2;
}
