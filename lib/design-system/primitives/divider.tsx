/**
 * Divider — a hairline line in the theme's `divider` color.
 *
 * Used to separate stacked rows inside grouped lists (e.g. settings).
 * `inset` shifts the line right so it lines up with the row text and
 * does not run under any leading icon — matches the iOS HIG default.
 */

import { StyleSheet, View, type ViewStyle } from "react-native";

import { useTheme } from "../provider";

export type DividerProps = {
  /** Left/start inset in dp. Defaults to `0` (full bleed). */
  inset?: number;
  style?: ViewStyle;
};

export function Divider({ inset = 0, style }: DividerProps) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.line,
        { backgroundColor: tokens.colors.divider, marginStart: inset },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    width: "auto",
  },
});
