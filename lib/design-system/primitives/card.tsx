/**
 * Card — a surface container with the standard radius + hairline
 * border. Most surfaces in the app are Cards (rowing-metrics card,
 * sensor status, settings groups, summary panels).
 *
 * Two visual variants:
 *   - `surface` (default) — uses `tokens.colors.surface` (the page bg).
 *   - `elevated`         — uses `tokens.colors.surfaceElevated` (the
 *                           muted gray-blue used for stat cards today).
 *
 * Optional `accentBar` paints a 3 dp coloured strip on the *start*
 * edge (logical left in LTR, right in RTL — matches what
 * `components/ble/device-card.tsx` does today). The `accentBarColor`
 * prop lets callers thread an HR zone color or a status hue through.
 *
 * `padding` uses the spacing scale; default is `"md"` (16 dp).
 */

import { type ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { useTheme } from "../provider";
import { type SpacingToken } from "../tokens/spacing";

export type CardVariant = "surface" | "elevated";

export type CardProps = {
  children: ReactNode;
  variant?: CardVariant;
  padding?: SpacingToken | "none";
  /** When true, paints a 3 dp colored strip on the start edge. */
  accentBar?: boolean;
  /** Color for the accent bar; defaults to `tokens.colors.accent`. */
  accentBarColor?: string;
  style?: ViewStyle | ViewStyle[];
};

export function Card({
  children,
  variant = "elevated",
  padding = "md",
  accentBar = false,
  accentBarColor,
  style,
}: CardProps) {
  const { tokens } = useTheme();
  const bg =
    variant === "elevated"
      ? tokens.colors.surfaceElevated
      : tokens.colors.surface;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: bg,
          borderColor: tokens.colors.border,
          borderRadius: tokens.radius.lg,
          padding: padding === "none" ? undefined : tokens.spacing[padding],
        },
        accentBar
          ? {
              borderStartWidth: 3,
              borderStartColor: accentBarColor ?? tokens.colors.accent,
            }
          : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
});
