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
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "mjs", "json"],
  transform: {
    "^.+\\.(ts|tsx|js|mjs)$": [
      "ts-jest",
      {
        // tsconfig already enables strict + ESNext target; reuse it so the
        // test compilation matches the runtime build, but force CommonJS
        // output so Jest can require() the resulting modules without
        // experimental ESM. This also lets ts-jest transpile the
        // @garmin/fitsdk ESM sources (see transformIgnorePatterns below).
        tsconfig: {
          allowJs: true,
          module: "commonjs",
          moduleResolution: "node",
          esModuleInterop: true,
          target: "ES2020",
          jsx: "react-native",
        },
        diagnostics: false,
      },
    ],
  },
  // By default jest doesn't transform anything under node_modules. The
  // @garmin/fitsdk package ships as plain ESM .js files, so we make an
  // exception and run it through the same ts-jest transform.
  transformIgnorePatterns: ["node_modules/(?!(@garmin/fitsdk)/)"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};
