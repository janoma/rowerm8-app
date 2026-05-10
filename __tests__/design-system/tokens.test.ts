/**
 * Token-shape sanity checks.
 *
 * These tests do *not* try to lock down every hex value (the design
 * team should be free to nudge a color without churning a snapshot
 * file). Instead they assert the *shape* of the token bundles:
 *
 *   - both schemes export the same set of semantic roles,
 *   - the HR ramp has all 5 zones in both schemes with the expected
 *     keys,
 *   - the chart aliases line up the way the activity-detail charts
 *     and the live HR pill rely on (`chart.heart === hrZones.z5.bg`,
 *     `chart.cadence === colors.accent`).
 *
 * Imports go through the per-module paths to avoid pulling
 * `lib/design-system/index.ts`'s re-exports of the React Native
 * primitives into the test runtime.
 */

import {
  COGGAN_ZONE_KEYS,
  darkTokens,
  HR_ZONE_KEYS,
  lightTokens,
  tokensForScheme,
} from "@/lib/design-system/tokens";

describe("design-system tokens", () => {
  it("exposes the same color roles for light and dark", () => {
    const lightRoles = Object.keys(lightTokens.colors).sort();
    const darkRoles = Object.keys(darkTokens.colors).sort();
    expect(darkRoles).toEqual(lightRoles);
  });

  it("declares every HR zone with the same field shape in both schemes", () => {
    for (const scheme of ["light", "dark"] as const) {
      const palette =
        scheme === "light" ? lightTokens.hrZones : darkTokens.hrZones;
      expect(Object.keys(palette).sort()).toEqual([...HR_ZONE_KEYS].sort());
      for (const zone of HR_ZONE_KEYS) {
        expect(palette[zone]).toEqual(
          expect.objectContaining({
            bg: expect.any(String),
            bgSubtle: expect.any(String),
            text: expect.any(String),
            onZoneText: expect.any(String),
          }),
        );
      }
    }
  });

  it("declares every Coggan zone with the same field shape in both schemes", () => {
    for (const scheme of ["light", "dark"] as const) {
      const palette =
        scheme === "light" ? lightTokens.cogganZones : darkTokens.cogganZones;
      expect(Object.keys(palette).sort()).toEqual([...COGGAN_ZONE_KEYS].sort());
      for (const zone of COGGAN_ZONE_KEYS) {
        expect(palette[zone]).toEqual(
          expect.objectContaining({
            bg: expect.any(String),
            bgSubtle: expect.any(String),
            text: expect.any(String),
            onZoneText: expect.any(String),
          }),
        );
      }
    }
  });

  it("aliases chart.cadence to the accent and chart.heart to Z5 bg", () => {
    for (const scheme of ["light", "dark"] as const) {
      const tokens = tokensForScheme(scheme);
      expect(tokens.chart.cadence).toBe(tokens.colors.accent);
      expect(tokens.chart.heart).toBe(tokens.hrZones.z5.bg);
    }
  });

  it("returns the right bundle from tokensForScheme()", () => {
    expect(tokensForScheme("light")).toBe(lightTokens);
    expect(tokensForScheme("dark")).toBe(darkTokens);
  });

  it("ships a non-empty achievement palette in both schemes", () => {
    for (const scheme of ["light", "dark"] as const) {
      const tokens = tokensForScheme(scheme);
      expect(Object.keys(tokens.achievements).sort()).toEqual([
        "bronze",
        "gold",
        "personalBest",
        "silver",
      ]);
    }
  });

  it("has a 4-pt spacing scale and pill radius", () => {
    expect(lightTokens.spacing.xs).toBe(8);
    expect(lightTokens.spacing.md).toBe(16);
    expect(lightTokens.spacing.xl).toBe(24);
    expect(lightTokens.radius.pill).toBeGreaterThanOrEqual(999);
  });
});
