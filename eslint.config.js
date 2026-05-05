// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
// eslint-config-prettier disables stylistic rules that would conflict with
// Prettier's formatting. Keep it last so it has the final say on those rules.
const prettierConfig = require("eslint-config-prettier");

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ["dist/*"],
    rules: {
      // Always require braces around control-flow bodies. Prevents one-liner
      // `if (cond) doThing();` style and the bug-prone dangling-else cases.
      curly: ["error", "all"],
    },
  },
]);
