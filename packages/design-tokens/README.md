# @rowerm8/design-tokens

Pure-data design tokens for the RowerM8 ecosystem.

This workspace package owns the canonical color, typography, spacing,
radius, motion, HR-zone, achievement, and chart tokens. Both the
React Native app (via `lib/design-system/tokens`) and a future
Next.js marketing website import directly from this package, so the
two surfaces never drift.

## Constraints

- **No React Native imports.** Enforced by ESLint
  (`no-restricted-imports`). Anything that needs `Platform.select`
  or `StyleSheet.hairlineWidth` belongs in the app's
  `lib/design-system/tokens/` shim, not here.
- **Pure data.** Functions are allowed (e.g. `buildChartTokens`) but
  they must take their inputs as plain arguments — no `import` of
  runtime singletons.

## Layout

```
packages/design-tokens/
├── src/
│   ├── colors.ts           Light + dark semantic palette
│   ├── hr-zones.ts         5-zone Garmin ramp
│   ├── achievements.ts     Bronze / silver / gold / personal best
│   ├── chart.ts            Sparkline aliases (cadence → accent, heart → Z5)
│   ├── typography.ts       Font families per platform + text-style scale
│   ├── spacing.ts          4-pt scale
│   ├── radius.ts           Corner radii
│   ├── motion.ts           Durations + easing curves
│   └── index.ts            Composes lightTokens / darkTokens / tokensForScheme
├── scripts/
│   └── build-tokens.ts     Emits dist/tokens.json + dist/tokens.css
├── eslint.config.mjs       Bans react-native imports inside this package
├── tsconfig.json
└── package.json
```

## Build

```sh
pnpm -F @rowerm8/design-tokens build
```

Outputs:

- `dist/tokens.json` — full bundle with `light` and `dark` keys.
  Suitable for Figma plugins, marketing automation, and other
  non-JS consumers.
- `dist/tokens.css` — `:root` and `[data-theme='dark']` blocks of
  `--rm8-*` custom properties. Drop into a Next.js global stylesheet
  to get the same palette as the app.

## Lint

```sh
pnpm -F @rowerm8/design-tokens lint
```

Fails if any source file imports `react-native` or
`react-native-web` (including sub-paths).
