import { Children, Fragment, isValidElement, ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Card, Divider, useTheme } from "@/lib/design-system";

type Props = {
  header?: string;
  footer?: string;
  children: ReactNode;
};

export function SettingsSection({ header, footer, children }: Props) {
  const { tokens } = useTheme();

  const items = Children.toArray(children).filter(isValidElement);

  return (
    <View style={styles.section}>
      {header ? (
        <ThemedText
          style={[styles.header, { color: tokens.colors.textSecondary }]}
        >
          {header.toUpperCase()}
        </ThemedText>
      ) : null}
      <Card variant="surface" padding="none">
        {items.map((child, index) => (
          <Fragment key={index}>
            {index > 0 ? <Divider inset={16} /> : null}
            {child}
          </Fragment>
        ))}
      </Card>
      {footer ? (
        <ThemedText
          style={[styles.footer, { color: tokens.colors.textSecondary }]}
        >
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
  footer: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
