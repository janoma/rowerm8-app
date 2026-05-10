/**
 * Heart-rate zone palette — "Garmin" 5-zone ramp.
 *
 * Five zones from easy (Z1) to maximum effort (Z5):
 *   Z1 light blue · Z2 green · Z3 yellow · Z4 orange · Z5 red.
 *
 * Each zone exposes four slots so consumers don't have to pick
 * accessibility-safe text colors at the call site:
 *   - `bg`         : saturated zone fill (used in `<ZoneBar>`).
 *   - `bgSubtle`   : tinted background for inline status pills.
 *   - `text`       : darker shade of the zone color, legible against
 *                    the app's `surface` token.
 *   - `onZoneText` : white or near-black text legible *on top of* `bg`.
 *
 * The Z5 red is also the canonical "heart" color throughout the app
 * (see `chart.ts` — the activity-detail HR sparkline aliases it). If
 * you change Z5 you'll change those visuals too — that's intentional;
 * live + recorded HR views must agree.
 */

export type HrZoneKey = "z1" | "z2" | "z3" | "z4" | "z5";

export type HrZoneTokens = {
  bg: string;
  bgSubtle: string;
  text: string;
  onZoneText: string;
};

export type HrZonePalette = Record<HrZoneKey, HrZoneTokens>;

export const hrZonesLight: HrZonePalette = {
  z1: {
    bg: "#7BB7E0",
    bgSubtle: "rgba(123, 183, 224, 0.18)",
    text: "#1B4A6B",
    onZoneText: "#0F2535",
  },
  z2: {
    bg: "#3FBF6F",
    bgSubtle: "rgba(63, 191, 111, 0.18)",
    text: "#1A5A36",
    onZoneText: "#0B2A18",
  },
  z3: {
    bg: "#F5C518",
    bgSubtle: "rgba(245, 197, 24, 0.20)",
    text: "#7A5C00",
    onZoneText: "#3A2C00",
  },
  z4: {
    bg: "#F58221",
    bgSubtle: "rgba(245, 130, 33, 0.20)",
    text: "#7A3A0A",
    onZoneText: "#FFFFFF",
  },
  z5: {
    bg: "#E63946",
    bgSubtle: "rgba(230, 57, 70, 0.20)",
    text: "#7A1820",
    onZoneText: "#FFFFFF",
  },
};

export const hrZonesDark: HrZonePalette = {
  z1: {
    bg: "#7BB7E0",
    bgSubtle: "rgba(123, 183, 224, 0.20)",
    text: "#A8D0EA",
    onZoneText: "#0F2535",
  },
  z2: {
    bg: "#3FBF6F",
    bgSubtle: "rgba(63, 191, 111, 0.22)",
    text: "#7CDA9C",
    onZoneText: "#0B2A18",
  },
  z3: {
    bg: "#F5C518",
    bgSubtle: "rgba(245, 197, 24, 0.22)",
    text: "#F2D770",
    onZoneText: "#3A2C00",
  },
  z4: {
    bg: "#F58221",
    bgSubtle: "rgba(245, 130, 33, 0.22)",
    text: "#F4A86A",
    onZoneText: "#1B0E04",
  },
  z5: {
    bg: "#E63946",
    bgSubtle: "rgba(230, 57, 70, 0.24)",
    text: "#F08089",
    onZoneText: "#FFFFFF",
  },
};

/** Ordered list of zone keys, easy → max. Useful for `<ZoneBar>` segment loops. */
export const HR_ZONE_KEYS: readonly HrZoneKey[] = [
  "z1",
  "z2",
  "z3",
  "z4",
  "z5",
];

/**
 * Coggan/Friel 7-zone HR palette.
 *
 * The first five zones reuse the Garmin/Polar 5-zone ramp so users
 * who switch between models get the same "blue → green → yellow →
 * orange → red" intuition for the bulk of the bar; the two new top
 * zones (c5b, c5c) extend with a deeper red and a violet so the
 * ramp keeps progressing past Z5. Same four-slot structure
 * (`bg`, `bgSubtle`, `text`, `onZoneText`) as the 5-zone palette so
 * `<ZonePill>` / `<ZoneBar>` consumers can swap palettes without
 * touching layout code.
 *
 * Naming follows Joel Friel's adaptation of Andrew Coggan's HR
 * zones: c1 Recovery, c2 Aerobic, c3 Tempo, c4 SubThreshold,
 * c5a SuperThreshold, c5b Aerobic Capacity, c5c Anaerobic Capacity.
 */
export type CogganZoneKey = "c1" | "c2" | "c3" | "c4" | "c5a" | "c5b" | "c5c";

export type CogganZonePalette = Record<CogganZoneKey, HrZoneTokens>;

export const cogganZonesLight: CogganZonePalette = {
  c1: hrZonesLight.z1,
  c2: hrZonesLight.z2,
  c3: hrZonesLight.z3,
  c4: hrZonesLight.z4,
  c5a: hrZonesLight.z5,
  c5b: {
    bg: "#B62232",
    bgSubtle: "rgba(182, 34, 50, 0.20)",
    text: "#5C0F18",
    onZoneText: "#FFFFFF",
  },
  c5c: {
    bg: "#7A2BAE",
    bgSubtle: "rgba(122, 43, 174, 0.20)",
    text: "#3F1264",
    onZoneText: "#FFFFFF",
  },
};

export const cogganZonesDark: CogganZonePalette = {
  c1: hrZonesDark.z1,
  c2: hrZonesDark.z2,
  c3: hrZonesDark.z3,
  c4: hrZonesDark.z4,
  c5a: hrZonesDark.z5,
  c5b: {
    bg: "#B62232",
    bgSubtle: "rgba(182, 34, 50, 0.24)",
    text: "#E5818D",
    onZoneText: "#FFFFFF",
  },
  c5c: {
    bg: "#A04AD8",
    bgSubtle: "rgba(160, 74, 216, 0.24)",
    text: "#D5A8EE",
    onZoneText: "#FFFFFF",
  },
};

/** Ordered list of Coggan/Friel zone keys, easy → max. */
export const COGGAN_ZONE_KEYS: readonly CogganZoneKey[] = [
  "c1",
  "c2",
  "c3",
  "c4",
  "c5a",
  "c5b",
  "c5c",
];
