import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  GRAVITY_MPS2,
  gToMps2,
  joulesToKcal,
  JOULES_PER_KCAL,
  kcalToJoules,
  kilogramsToPounds,
  KG_PER_POUND,
  kphToMps,
  metersToKilometers,
  metersToMiles,
  metersToYards,
  METERS_PER_KILOMETER,
  METERS_PER_MILE,
  METERS_PER_YARD,
  milesToMeters,
  mphToMps,
  mps2ToG,
  mpsToKph,
  mpsToMph,
  mpsToSecondsPer500m,
  poundsToKilograms,
  secondsPer500mToSecondsPerKm,
  secondsPer500mToSecondsPerMile,
  secondsPerKmToSecondsPer500m,
  secondsPerMileToSecondsPer500m,
  yardsToMeters,
} from "@/lib/units";

const VALUES = [0, 1, 100, 2_500, 10_000, 42_195, 1_000_000];

describe("unit conversions: golden values", () => {
  it("metres <-> kilometres exact at boundaries", () => {
    expect(metersToKilometers(0)).toBe(0);
    expect(metersToKilometers(1000)).toBe(1);
    expect(metersToKilometers(METERS_PER_KILOMETER * 5)).toBe(5);
  });

  it("metres <-> miles uses exact NIST factor", () => {
    expect(metersToMiles(METERS_PER_MILE)).toBe(1);
    expect(milesToMeters(1)).toBe(METERS_PER_MILE);
    // 5K race in miles
    expect(metersToMiles(5000)).toBeCloseTo(3.1068559611, 9);
  });

  it("metres <-> yards", () => {
    expect(metersToYards(METERS_PER_YARD)).toBe(1);
    expect(yardsToMeters(1)).toBe(METERS_PER_YARD);
    expect(metersToYards(100)).toBeCloseTo(109.36132983377079, 9);
  });

  it("kilograms <-> pounds", () => {
    expect(kilogramsToPounds(KG_PER_POUND)).toBe(1);
    expect(poundsToKilograms(1)).toBe(KG_PER_POUND);
    expect(kilogramsToPounds(80)).toBeCloseTo(176.36980974790175, 9);
  });

  it("speed: m/s <-> km/h <-> mph", () => {
    expect(mpsToKph(10)).toBe(36);
    expect(kphToMps(36)).toBe(10);
    expect(mpsToMph(0)).toBe(0);
    expect(mphToMps(60)).toBeCloseTo(26.8224, 9);
  });

  it("acceleration g <-> m/s^2 anchored on standard gravity", () => {
    expect(gToMps2(1)).toBe(GRAVITY_MPS2);
    expect(mps2ToG(GRAVITY_MPS2)).toBe(1);
  });

  it("energy: kcal <-> joules anchored on thermochemical kcal", () => {
    expect(kcalToJoules(1)).toBe(JOULES_PER_KCAL);
    expect(joulesToKcal(JOULES_PER_KCAL)).toBe(1);
  });

  it("temperature: 0 C = 32 F, 100 C = 212 F", () => {
    expect(celsiusToFahrenheit(0)).toBe(32);
    expect(celsiusToFahrenheit(100)).toBe(212);
    expect(fahrenheitToCelsius(32)).toBe(0);
    expect(fahrenheitToCelsius(212)).toBeCloseTo(100, 12);
  });

  it("rowing pace conversions follow Concept2 conventions", () => {
    // A 1:50 / 500m split is 220 s/km. In miles the pace is
    //   110 s/500m * (1609.344 m/mi) / (500 m) = 354.05568 s/mi
    expect(secondsPer500mToSecondsPerKm(110)).toBe(220);
    expect(secondsPer500mToSecondsPerMile(110)).toBeCloseTo(354.05568, 5);
    expect(secondsPerKmToSecondsPer500m(220)).toBe(110);
    expect(secondsPerMileToSecondsPer500m(354.05568)).toBeCloseTo(110, 5);
  });

  it("mpsToSecondsPer500m: zero/negative -> Infinity, positive -> 500 / mps", () => {
    expect(mpsToSecondsPer500m(0)).toBe(Number.POSITIVE_INFINITY);
    expect(mpsToSecondsPer500m(-1)).toBe(Number.POSITIVE_INFINITY);
    expect(mpsToSecondsPer500m(5)).toBe(100);
    expect(mpsToSecondsPer500m(2)).toBe(250);
  });
});

describe("unit conversions: round-trip identity (no drift)", () => {
  it.each(VALUES)("metres -> miles -> metres for %p", (m) => {
    expect(milesToMeters(metersToMiles(m))).toBeCloseTo(m, 9);
  });

  it.each(VALUES)("metres -> kilometres -> metres for %p", (m) => {
    expect(metersToKilometers(m) * METERS_PER_KILOMETER).toBe(m);
  });

  it.each(VALUES)("metres -> yards -> metres for %p", (m) => {
    expect(yardsToMeters(metersToYards(m))).toBeCloseTo(m, 9);
  });

  it.each(VALUES)("kg -> lb -> kg for %p", (kg) => {
    expect(poundsToKilograms(kilogramsToPounds(kg))).toBeCloseTo(kg, 9);
  });

  it.each([0, 1, 7.5, 11.2, 100])("m/s -> km/h -> m/s for %p", (mps) => {
    expect(kphToMps(mpsToKph(mps))).toBeCloseTo(mps, 12);
  });

  it.each([1, 7.5, 11.2, 100])("m/s -> mph -> m/s for %p", (mps) => {
    expect(mphToMps(mpsToMph(mps))).toBeCloseTo(mps, 9);
  });

  it.each([90, 110, 130, 200])(
    "rowing pace round-trip per500m -> perKm -> per500m for %p",
    (sp500) => {
      const back = secondsPerKmToSecondsPer500m(
        secondsPer500mToSecondsPerKm(sp500),
      );
      expect(back).toBe(sp500);
    },
  );

  it.each([90, 110, 130, 200])(
    "rowing pace round-trip per500m -> perMile -> per500m for %p",
    (sp500) => {
      const back = secondsPerMileToSecondsPer500m(
        secondsPer500mToSecondsPerMile(sp500),
      );
      expect(back).toBeCloseTo(sp500, 9);
    },
  );

  it("temperature C -> F -> C is exact at integer C", () => {
    for (const c of [-40, -10, 0, 21, 37, 100]) {
      expect(fahrenheitToCelsius(celsiusToFahrenheit(c))).toBeCloseTo(c, 12);
    }
  });

  it("does not drift after 1000 round-trips through miles", () => {
    let m = 5000;
    for (let i = 0; i < 1000; i++) {
      m = milesToMeters(metersToMiles(m));
    }
    expect(m).toBeCloseTo(5000, 6);
  });
});

describe("constants are exact (NIST SP 811)", () => {
  it("METERS_PER_MILE is exactly 1609.344", () => {
    expect(METERS_PER_MILE).toBe(1609.344);
  });

  it("METERS_PER_YARD is exactly 0.9144", () => {
    expect(METERS_PER_YARD).toBe(0.9144);
  });

  it("KG_PER_POUND is exactly 0.45359237", () => {
    expect(KG_PER_POUND).toBe(0.45359237);
  });

  it("JOULES_PER_KCAL is exactly 4184", () => {
    expect(JOULES_PER_KCAL).toBe(4184);
  });

  it("GRAVITY_MPS2 is the standard 9.80665", () => {
    expect(GRAVITY_MPS2).toBe(9.80665);
  });
});
