/**
 * Stack / Inline — tiny layout primitives.
 *
 * `Stack` lays children out vertically with `gap` between them;
 * `Inline` lays children out horizontally. Both accept a token spacing
 * key so call sites don't sprinkle raw numbers.
 *
 * Equivalent of e.g. ChakraUI's `<VStack>`/`<HStack>`. Kept minimal —
 * if you need cross-axis alignment beyond the defaults, drop down to a
 * raw `<View>`.
 */

import { type ReactNode } from "react";
import {
  type FlexAlignType,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";

import { useTheme } from "../provider";
import { type SpacingToken } from "../tokens/spacing";

export type StackProps = {
  children: ReactNode;
  /** Spacing token. Defaults to `"sm"` (12 dp). */
  gap?: SpacingToken;
  /** Cross-axis alignment. */
  align?: FlexAlignType;
  style?: ViewStyle | ViewStyle[];
};

export function Stack({ children, gap = "sm", align, style }: StackProps) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.stack,
        { gap: tokens.spacing[gap], alignItems: align },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export type InlineProps = StackProps & {
  /** Main-axis distribution. */
  justify?: "flex-start" | "flex-end" | "center" | "space-between";
  /** Wrap to next line if children overflow. */
  wrap?: boolean;
};

export function Inline({
  children,
  gap = "xs",
  align = "center",
  justify,
  wrap = false,
  style,
}: InlineProps) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.inline,
        {
          gap: tokens.spacing[gap],
          alignItems: align,
          justifyContent: justify,
          flexWrap: wrap ? "wrap" : "nowrap",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    flexDirection: "column",
  },
  inline: {
    flexDirection: "row",
  },
});
