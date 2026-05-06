/**
 * Jest config for unit tests.
 *
 * The pure modules under `lib/units` and `lib/format/<file>` deliberately
 * avoid React, expo-localization, and React Native imports so they can run
 * in plain Node with `ts-jest`. This keeps the suite fast and avoids
 * dragging the entire Expo runtime through the test process — `jest-expo`
 * is overkill for verifying SI conversions and `Intl` output.
 *
 * Component / context tests (when we add them) should live elsewhere and
 * use the `jest-expo` preset.
 */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        // tsconfig already enables strict + ESNext target; reuse it so the
        // test compilation matches the runtime build.
        tsconfig: "tsconfig.json",
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};
