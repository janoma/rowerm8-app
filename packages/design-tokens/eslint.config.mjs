/**
 * Standalone ESLint config for `@rowerm8/design-tokens`.
 *
 * Mirrors the package-scoped block that lives in the root
 * `eslint.config.js`, so the package can be linted in isolation
 * (`pnpm -F @rowerm8/design-tokens lint`) without depending on the
 * Expo lint preset. The single rule that matters here is the
 * `no-restricted-imports` ban on React Native — the whole point of
 * the package boundary is that it stays framework-agnostic.
 */
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
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
];
