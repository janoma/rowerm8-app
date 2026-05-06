import type {
  MeasurementSystem,
  PaceUnit,
  TemperatureUnit,
  WeightUnit,
} from "@/lib/units";

/**
 * Concrete (already auto-resolved) display preferences passed into formatter
 * functions. The `auto` sentinel never appears here — it's resolved upstream
 * by `LocaleProvider` against the OS locale.
 */
export type ResolvedFormatPrefs = {
  /** BCP-47 tag, e.g. `"en-US"`. Drives `Intl.*` locale-aware output. */
  locale: string;
  measurementSystem: MeasurementSystem;
  paceUnit: PaceUnit;
  weightUnit: WeightUnit;
  temperatureUnit: TemperatureUnit;
};
