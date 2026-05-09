/**
 * @jest-environment node
 *
 * Smoke test to verify the i18next + i18next-icu wiring actually formats
 * ICU MessageFormat strings (plurals, variables, selects). A regression
 * here is hard to detect at typecheck/lint time, so we lock the behaviour
 * down with a unit test that uses the same plugin registration order as
 * lib/i18n/index.ts.
 */
import { createInstance, t, use as registerI18nPlugin } from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";

describe("i18next + i18next-icu", () => {
  it("interpolates simple variables", async () => {
    const i = createInstance();
    await i.use(ICU).init({
      lng: "en",
      fallbackLng: "en",
      resources: {
        en: {
          translation: {
            hello: "Hello, {name}",
          },
        },
      },
      interpolation: { escapeValue: false },
    });
    expect(i.t("hello", { name: "world" })).toBe("Hello, world");
  });

  it("formats ICU plurals", async () => {
    const i = createInstance();
    await i.use(ICU).init({
      lng: "en",
      fallbackLng: "en",
      resources: {
        en: {
          translation: {
            strokes: "{count, plural, one {# stroke} other {# strokes}}",
          },
        },
      },
      interpolation: { escapeValue: false },
    });
    expect(i.t("strokes", { count: 1 })).toBe("1 stroke");
    expect(i.t("strokes", { count: 5 })).toBe("5 strokes");
  });

  it("formats ICU compound strings (variable + plural)", async () => {
    const i = createInstance();
    await i.use(ICU).init({
      lng: "en",
      fallbackLng: "en",
      resources: {
        en: {
          translation: {
            saved:
              "Saved {duration} with {strokes, plural, one {# stroke} other {# strokes}}.",
          },
        },
      },
      interpolation: { escapeValue: false },
    });
    expect(i.t("saved", { duration: "0:17", strokes: 1 })).toBe(
      "Saved 0:17 with 1 stroke.",
    );
    expect(i.t("saved", { duration: "0:17", strokes: 12 })).toBe(
      "Saved 0:17 with 12 strokes.",
    );
  });

  it("loads the FormatJS polyfill so plurals work even when native Intl.PluralRules is missing", async () => {
    // Regression test for the bug where users saw literal
    // `{count, plural, one {# stroke} other {# strokes}}` on-device:
    // Hermes (and older JSC) ship without `Intl.PluralRules`, which makes
    // `intl-messageformat` throw and `i18next-icu` silently return the raw
    // template. The fix is `lib/i18n/intl-polyfill.ts`, which conditionally
    // installs the FormatJS polyfill at app startup.
    //
    // Here we simulate the missing-API environment by deleting the global,
    // requiring the polyfill module (so the polyfill installs itself
    // against the now-empty global), and asserting that ICU plurals
    // format correctly through the i18next pipeline.
    const intlGlobal = Intl as unknown as { PluralRules?: unknown };
    const originalPluralRules = intlGlobal.PluralRules;
    delete intlGlobal.PluralRules;
    // Drop any cached copy so requiring it actually re-runs the polyfill
    // check against the now-deleted global.
    jest.resetModules();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@/lib/i18n/intl-polyfill");
      expect(typeof intlGlobal.PluralRules).toBe("function");

      const i = createInstance();
      await i.use(ICU).init({
        lng: "en",
        fallbackLng: "en",
        resources: {
          en: {
            translation: {
              strokes: "{count, plural, one {# stroke} other {# strokes}}",
            },
          },
        },
        interpolation: { escapeValue: false },
      });
      expect(i.t("strokes", { count: 1 })).toBe("1 stroke");
      expect(i.t("strokes", { count: 5 })).toBe("5 strokes");
    } finally {
      intlGlobal.PluralRules = originalPluralRules;
    }
  });

  it("formats ICU on the i18next singleton wired exactly like lib/i18n/index.ts", async () => {
    // Mirrors the setup in `lib/i18n/index.ts`: registerI18nPlugin(ICU)
    // chained with `.use(initReactI18next).init(...)` against the global
    // i18next singleton (not createInstance). This is the path the RN app
    // takes; if ICU silently gets stripped by the chain or the singleton
    // is configured elsewhere first, this test fails.
    await registerI18nPlugin(ICU)
      .use(initReactI18next)
      .init({
        lng: "en",
        fallbackLng: "en",
        resources: {
          en: {
            translation: {
              saved:
                "Saved {duration} with {strokes, plural, one {# stroke} other {# strokes}}.",
            },
          },
        },
        interpolation: { escapeValue: false },
      });
    expect(t("saved", { duration: "0:17", strokes: 3 })).toBe(
      "Saved 0:17 with 3 strokes.",
    );
  });
});
