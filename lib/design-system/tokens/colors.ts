/**
 * App-side re-export of the canonical color tokens.
 *
 * The actual values live in `@rowerm8/design-tokens` so a future
 * Next.js website can consume the same palette without dragging
 * React Native along. Keeping this thin shim lets every existing
 * `from "@/lib/design-system/tokens/colors"` import keep working
 * unchanged.
 */
export {
  darkColors,
  lightColors,
  type ColorTokens,
} from "@rowerm8/design-tokens";
