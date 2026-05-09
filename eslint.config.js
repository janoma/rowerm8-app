// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
// eslint-config-prettier disables stylistic rules that would conflict with
// Prettier's formatting. Keep it last so it has the final say on those rules.
const prettierConfig = require("eslint-config-prettier");
const tsEslintPlugin = require("@typescript-eslint/eslint-plugin");

module.exports = defineConfig([
  // A flat-config block with only `ignores` is treated as a global ignore.
  // We pull these out of the rules block below so files like the
  // expo-router-generated `.expo/types/router.d.ts` aren't linted at all
  // (otherwise the boilerplate `/* eslint-disable */` they ship with
  // becomes an unused-disable warning under our --max-warnings 0 rule).
  { ignores: ["dist/**", ".expo/**"] },
  expoConfig,
  prettierConfig,
  {
    plugins: {
      // Re-register the plugin in this config block so we can override its
      // rules below. Flat config scopes plugins per block — our overrides
      // would otherwise fail with "could not find plugin".
      "@typescript-eslint": tsEslintPlugin,
    },
    rules: {
      // Always require braces around control-flow bodies. Prevents one-liner
      // `if (cond) doThing();` style and the bug-prone dangling-else cases.
      curly: ["error", "all"],
      // Honor the conventional `_`-prefix to mark intentionally-unused
      // bindings (e.g. `const _result = sideEffectfulCall()` in tests, or
      // unused destructure positions). Anything not prefixed is still flagged.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // The design-tokens package must stay framework-agnostic so a future
    // Next.js site can consume it without dragging React Native along.
    // Block any `react-native` / `react-native-web` import — including
    // sub-paths (e.g. `react-native/Libraries/...`).
    files: ["packages/design-tokens/**/*.{ts,tsx,js,mjs,cjs}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react-native",
                "react-native/*",
                "react-native-web",
                "react-native-web/*",
              ],
              message:
                "@rowerm8/design-tokens must remain pure data — no React Native imports.",
            },
          ],
        },
      ],
    },
  },
]);
