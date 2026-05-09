import { View, type ViewProps } from "react-native";

import { useTheme } from "@/lib/design-system";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

/**
 * Drop-in themed `<View>` whose background follows the design-system
 * surface token. `lightColor` / `darkColor` overrides remain for the
 * handful of legacy call sites that pass them; new code should consume
 * `useTheme().tokens.colors` directly.
 */
export function ThemedView({
  style,
  lightColor,
  darkColor,
  ...otherProps
}: ThemedViewProps) {
  const { scheme, tokens } = useTheme();

  const override = scheme === "dark" ? darkColor : lightColor;
  const backgroundColor = override ?? tokens.colors.surface;

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
