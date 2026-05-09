import { StyleSheet, Text, type TextProps } from "react-native";

import { useTheme } from "@/lib/design-system";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: "default" | "title" | "defaultSemiBold" | "subtitle" | "link";
};

/**
 * Drop-in themed `<Text>` that resolves its color from the design-system
 * theme. The `lightColor` / `darkColor` overrides are kept for backward
 * compatibility with screens that haven't migrated to the design-system
 * primitives yet — they take precedence over the token-derived color.
 *
 * New code should prefer the typography helpers + `useTheme()` directly,
 * but this component is intentionally cheap to keep in place because 10+
 * existing screens import it.
 */
export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "default",
  ...rest
}: ThemedTextProps) {
  const { scheme, tokens } = useTheme();

  const override = scheme === "dark" ? darkColor : lightColor;
  const baseColor = type === "link" ? tokens.colors.link : tokens.colors.text;
  const color = override ?? baseColor;

  return (
    <Text
      style={[
        { color },
        type === "default" ? styles.default : undefined,
        type === "title" ? styles.title : undefined,
        type === "defaultSemiBold" ? styles.defaultSemiBold : undefined,
        type === "subtitle" ? styles.subtitle : undefined,
        type === "link" ? styles.link : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
  },
});
