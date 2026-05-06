import { Children, Fragment, isValidElement, ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";

const COLORS = {
  light: {
    header: "#687076",
    footer: "#687076",
    card: "#FFFFFF",
    cardBorder: "#E4E6EA",
    divider: "#E4E6EA",
  },
  dark: {
    header: "#9BA1A6",
    footer: "#9BA1A6",
    card: "#1B1D1F",
    cardBorder: "#2F3236",
    divider: "#2F3236",
  },
} as const;

type Props = {
  header?: string;
  footer?: string;
  children: ReactNode;
};

export function SettingsSection({ header, footer, children }: Props) {
  const scheme = useColorScheme() ?? "light";
  const palette = COLORS[scheme];

  const items = Children.toArray(children).filter(isValidElement);

  return (
    <View style={styles.section}>
      {header ? (
        <ThemedText style={[styles.header, { color: palette.header }]}>
          {header.toUpperCase()}
        </ThemedText>
      ) : null}
      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.cardBorder },
        ]}
      >
        {items.map((child, index) => (
          <Fragment key={index}>
            {index > 0 ? (
              <View
                style={[styles.divider, { backgroundColor: palette.divider }]}
              />
            ) : null}
            {child}
          </Fragment>
        ))}
      </View>
      {footer ? (
        <ThemedText style={[styles.footer, { color: palette.footer }]}>
          {footer}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  header: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  footer: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
