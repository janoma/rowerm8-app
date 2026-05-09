/**
 * Build a `@react-navigation/native` Theme from our design-system tokens.
 *
 * The navigator owns a few things that our token system does not:
 * background fill behind transitions, the default header/tab-bar
 * colors, and the active text color. Without bridging those, tab-bar
 * pushes flash white in dark mode while the rest of the screen is
 * dark. This helper builds the bridge.
 */

import {
  DarkTheme as RNDarkTheme,
  DefaultTheme as RNDefaultTheme,
  type Theme as RNNavigationTheme,
} from "@react-navigation/native";

import type { ColorScheme, ThemeTokens } from "../tokens";

export function buildNavigationTheme(
  scheme: ColorScheme,
  tokens: ThemeTokens,
): RNNavigationTheme {
  const base = scheme === "dark" ? RNDarkTheme : RNDefaultTheme;
  return {
    ...base,
    dark: scheme === "dark",
    colors: {
      ...base.colors,
      primary: tokens.colors.accent,
      background: tokens.colors.surface,
      card: tokens.colors.surface,
      text: tokens.colors.text,
      border: tokens.colors.border,
      notification: tokens.colors.danger,
    },
  };
}
