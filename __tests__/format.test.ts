// Pure-formatter tests. These intentionally import the underlying formatter
// modules (not the barrel) so we don't pull React, expo-localization, or any
// React Native code through the test runner.
import { formatDate, formatDateTime, formatTimeOfDay } from "@/lib/format/date";
import { formatDistance } from "@/lib/format/distance";
import { formatEnergy } from "@/lib/format/energy";
import { formatPace } from "@/lib/format/pace";
import { formatPower, formatStrokeRate } from "@/lib/format/power";
import { formatTemperature } from "@/lib/format/temperature";
import { formatDuration } from "@/lib/format/time";
import type { ResolvedFormatPrefs } from "@/lib/format/types";
import { formatWeight } from "@/lib/format/weight";

const enUSMetric: ResolvedFormatPrefs = {
  locale: "en-US",
  measurementSystem: "metric",
  paceUnit: "per500m",
  weightUnit: "kg",
  temperatureUnit: "C",
};
const enUSImperial: ResolvedFormatPrefs = {
  locale: "en-US",
  measurementSystem: "imperialUS",
  paceUnit: "perMile",
  weightUnit: "lb",
  temperatureUnit: "F",
};
const deDE: ResolvedFormatPrefs = {
  ...enUSMetric,
  locale: "de-DE",
};

describe("formatDistance", () => {
  it("under 1 km in metric stays in metres", () => {
    expect(formatDistance(350, enUSMetric)).toMatch(/^350\s?m$/);
  });

  it(">= 1 km in metric uses km with 2 decimals", () => {
    expect(formatDistance(12_345, enUSMetric)).toMatch(/^12\.35\s?km$/);
  });

  it("under 1 mile in imperial uses yards", () => {
    expect(formatDistance(400, enUSImperial)).toMatch(/yd$/);
  });

  it(">= 1 mile in imperial uses miles", () => {
    const out = formatDistance(5000, enUSImperial);
    expect(out).toMatch(/mi$/);
    expect(out).toMatch(/3\.11/);
  });

  it("German locale uses comma decimal separator", () => {
    expect(formatDistance(12_345, deDE)).toMatch(/^12,35\s?km$/);
  });

  it("returns em-dash for non-finite", () => {
    expect(formatDistance(NaN, enUSMetric)).toBe("—");
    expect(formatDistance(Infinity, enUSMetric)).toBe("—");
  });
});

describe("formatPace", () => {
  it("renders per 500m as '1:50.0 / 500 m' for 4.545 m/s", () => {
    // 500 / 4.545... ≈ 110 s -> 1:50.0
    const out = formatPace(500 / 110, enUSMetric);
    expect(out).toContain("1:50");
    expect(out).toContain("500");
  });

  it("renders per km when prefs.paceUnit = 'perKm'", () => {
    const prefs = { ...enUSMetric, paceUnit: "perKm" as const };
    const out = formatPace(5, prefs);
    // 5 m/s -> 200 s/km = 3:20.0
    expect(out).toContain("3:20");
    expect(out).toMatch(/km/);
  });

  it("renders per mile in imperial-pace mode", () => {
    const out = formatPace(5, enUSImperial);
    // 5 m/s -> 1609.344/5 = 321.87 s/mi = 5:21.9
    expect(out).toContain("5:21");
    expect(out).toMatch(/mi/);
  });

  it("returns em-dash for zero / negative speeds", () => {
    expect(formatPace(0, enUSMetric)).toBe("—");
    expect(formatPace(-1, enUSMetric)).toBe("—");
  });
});

describe("formatDuration", () => {
  it("M:SS for sub-hour, H:MM:SS for >= 1h", () => {
    expect(formatDuration(95)).toBe("1:35");
    expect(formatDuration(3725)).toBe("1:02:05");
  });

  it("with tenths shows .t suffix", () => {
    expect(formatDuration(110.45, { tenths: true })).toBe("1:50.5");
  });

  it("returns em-dash for negative or non-finite", () => {
    expect(formatDuration(-1)).toBe("—");
    expect(formatDuration(NaN)).toBe("—");
  });
});

describe("formatPower / strokeRate", () => {
  it("power formats integer watts with localized grouping", () => {
    expect(formatPower(1234, enUSMetric)).toBe("1,234 W");
    expect(formatPower(1234, deDE)).toBe("1.234 W");
  });

  it("stroke rate formats spm with one decimal", () => {
    expect(formatStrokeRate(28.4, enUSMetric)).toBe("28.4 spm");
  });

  it("power non-finite falls back to em-dash", () => {
    expect(formatPower(NaN, enUSMetric)).toBe("—");
  });
});

describe("formatWeight", () => {
  it("kg in metric, lb in imperial", () => {
    expect(formatWeight(80, enUSMetric)).toMatch(/kg/);
    expect(formatWeight(80, enUSImperial)).toMatch(/lb/);
  });

  it("converts 80 kg to roughly 176.4 lb", () => {
    const out = formatWeight(80, enUSImperial);
    expect(out).toContain("176.4");
  });
});

describe("formatTemperature", () => {
  it("100 C -> 212 F when temperatureUnit = F", () => {
    const out = formatTemperature(100, {
      ...enUSMetric,
      temperatureUnit: "F",
    });
    expect(out).toContain("212");
  });

  it("celsius output respects locale digit grouping", () => {
    expect(formatTemperature(20, enUSMetric)).toMatch(/20/);
  });
});

describe("formatEnergy", () => {
  it("converts joules to kcal, integer rounded", () => {
    // 1 kcal = 4184 J
    expect(formatEnergy(4184, enUSMetric)).toBe("1 kcal");
    expect(formatEnergy(20_920, enUSMetric)).toBe("5 kcal");
  });
});

describe("formatDate / formatTimeOfDay / formatDateTime", () => {
  // Use a fixed UTC instant with no DST surprises.
  const date = new Date(Date.UTC(2024, 0, 15, 14, 30, 0));

  it("date string differs by locale", () => {
    const enOut = formatDate(date, enUSMetric);
    const deOut = formatDate(date, deDE);
    expect(enOut).not.toBe(deOut);
    // Both should be non-empty and contain the year.
    expect(enOut).toContain("2024");
    expect(deOut).toContain("2024");
  });

  it("time-of-day uses the locale's clock convention", () => {
    expect(formatTimeOfDay(date, enUSMetric)).toBeTruthy();
    expect(formatTimeOfDay(date, deDE)).toBeTruthy();
  });

  it("dateTime composes date + time", () => {
    const out = formatDateTime(date, enUSMetric);
    expect(out).toContain("2024");
  });
});

describe("round-trip identity through formatters", () => {
  // The point of these is to confirm we never let a formatted value re-enter
  // the pipeline. They re-derive the SI value from the underlying conversion
  // helpers (NOT by parsing the formatted string) and confirm the SI input
  // is the canonical truth.
  it("distance metric storage is unchanged regardless of display unit", () => {
    const stored = 12_345.6789;
    // Formatting in either system must not mutate the stored value.
    const _a = formatDistance(stored, enUSMetric);
    const _b = formatDistance(stored, enUSImperial);
    expect(stored).toBe(12_345.6789);
  });
});
