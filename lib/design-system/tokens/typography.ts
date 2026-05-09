/**
 * App-side re-export of typography tokens. Source of truth lives in
 * `@rowerm8/design-tokens`.
 *
 * The `lib/design-system/provider/theme-context.tsx` runtime uses
 * `Platform.select` over `fontsIos` / `fontsAndroid` / `fontsWeb` to
 * pick the right family map at startup; the package keeps all three
 * maps as plain data so the Next.js website can pick `fontsWeb`
 * without ever loading React Native.
 */
export {
  fontsAndroid,
  fontsIos,
  fontsWeb,
  text,
  typography,
  type FontFamilies,
  type TextStyleKey,
  type TextStyleToken,
  type TypographyTokens,
} from "@rowerm8/design-tokens";
