/**
 * Unit-system primitives. Storage and computation in this app always use SI
 * base units (meters, seconds, kilograms, watts, joules, degrees Celsius);
 * these types describe the *display* preferences that drive formatters in
 * `lib/format`.
 */

export type MeasurementSystem = "metric" | "imperialUS";

/**
 * Pace is independent of the measurement system in rowing. Concept2 / World
 * Rowing convention is per-500m regardless of metric vs imperial, but rowers
 * who also run/cycle commonly want per-km or per-mile.
 */
export type PaceUnit = "per500m" | "perKm" | "perMile";

export type WeightUnit = "kg" | "lb";

export type TemperatureUnit = "C" | "F";

export type DistanceUnit = "m" | "km" | "mi" | "yd";

export type SpeedUnit = "mps" | "kph" | "mph";
