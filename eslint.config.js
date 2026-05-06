// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
// eslint-config-prettier disables stylistic rules that would conflict with
// Prettier's formatting. Keep it last so it has the final say on those rules.
const prettierConfig = require("eslint-config-prettier");
const tsEslintPlugin = require("@typescript-eslint/eslint-plugin");

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ["dist/*"],
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
]);
