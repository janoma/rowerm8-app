/**
 * Coverage for the pure pieces of the ThemeProvider: validation,
 * pref+system → resolved scheme mapping, and the AsyncStorage-shaped
 * load/save round-trip used by `theme-context.tsx` to persist the
 * user's appearance choice across launches.
 *
 * The provider itself wires these helpers up to React state — that
 * binding is deliberately thin so the things worth testing live here
 * and don't drag a React renderer into the unit-test runtime.
 */

import {
  isThemePref,
  loadThemePref,
  resolveScheme,
  saveThemePref,
  type ThemePref,
  type ThemePrefStorage,
} from "@/lib/design-system/provider/theme-pref";

const KEY = "rowerm8.theme.pref.test";

function memoryStorage(initial: Record<string, string> = {}): ThemePrefStorage {
  const data: Record<string, string> = { ...initial };
  return {
    getItem: (key) => Promise.resolve(key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
      return Promise.resolve();
    },
  };
}

describe("isThemePref", () => {
  it("accepts the three documented prefs", () => {
    expect(isThemePref("auto")).toBe(true);
    expect(isThemePref("light")).toBe(true);
    expect(isThemePref("dark")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isThemePref(null)).toBe(false);
    expect(isThemePref(undefined)).toBe(false);
    expect(isThemePref("AUTO")).toBe(false);
    expect(isThemePref("")).toBe(false);
    expect(isThemePref(42)).toBe(false);
    expect(isThemePref({ pref: "auto" })).toBe(false);
  });
});

describe("resolveScheme", () => {
  it("follows the OS scheme when pref is auto", () => {
    expect(resolveScheme("auto", "light")).toBe("light");
    expect(resolveScheme("auto", "dark")).toBe("dark");
  });

  it("falls back to light when pref is auto and OS scheme is missing", () => {
    expect(resolveScheme("auto", null)).toBe("light");
    expect(resolveScheme("auto", undefined)).toBe("light");
  });

  it("pins the scheme regardless of OS when pref is light or dark", () => {
    expect(resolveScheme("light", "dark")).toBe("light");
    expect(resolveScheme("dark", "light")).toBe("dark");
    expect(resolveScheme("light", null)).toBe("light");
    expect(resolveScheme("dark", undefined)).toBe("dark");
  });
});

describe("loadThemePref", () => {
  it("returns auto when nothing is stored yet", async () => {
    const storage = memoryStorage();
    await expect(loadThemePref(storage, KEY)).resolves.toBe("auto");
  });

  it("returns the stored value when it is one of the valid prefs", async () => {
    for (const pref of [
      "auto",
      "light",
      "dark",
    ] as const satisfies readonly ThemePref[]) {
      const storage = memoryStorage({ [KEY]: pref });
      await expect(loadThemePref(storage, KEY)).resolves.toBe(pref);
    }
  });

  it("falls back to auto when the stored payload is corrupt", async () => {
    const storage = memoryStorage({ [KEY]: "blue" });
    await expect(loadThemePref(storage, KEY)).resolves.toBe("auto");
  });

  it("falls back to auto when the storage read throws", async () => {
    const storage: ThemePrefStorage = {
      getItem: () => Promise.reject(new Error("boom")),
      setItem: () => Promise.resolve(),
    };
    await expect(loadThemePref(storage, KEY)).resolves.toBe("auto");
  });
});

describe("saveThemePref", () => {
  it("round-trips through the same storage instance", async () => {
    const storage = memoryStorage();
    await saveThemePref(storage, KEY, "dark");
    await expect(loadThemePref(storage, KEY)).resolves.toBe("dark");

    await saveThemePref(storage, KEY, "light");
    await expect(loadThemePref(storage, KEY)).resolves.toBe("light");

    await saveThemePref(storage, KEY, "auto");
    await expect(loadThemePref(storage, KEY)).resolves.toBe("auto");
  });

  it("does not throw when the storage write rejects", async () => {
    const storage: ThemePrefStorage = {
      getItem: () => Promise.resolve(null),
      setItem: () => Promise.reject(new Error("nope")),
    };
    await expect(saveThemePref(storage, KEY, "dark")).resolves.toBeUndefined();
  });
});
