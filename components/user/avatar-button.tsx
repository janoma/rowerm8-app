import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/lib/design-system";

type Size = "sm" | "md";

type Props = {
  size?: Size;
  /**
   * Override the default tap behavior. When omitted the button opens the
   * login prompt via `auth.openLoginPrompt()`, which is what the Home header
   * needs (guests can re-trigger the sign-in dialog any time).
   */
  onPress?: () => void;
};

const SIZE_TOKENS: Record<Size, { container: number; font: number }> = {
  sm: { container: 32, font: 12 },
  md: { container: 36, font: 13 },
};

/**
 * Compact circular avatar shown in screen chrome (currently the Home header).
 *
 * Renders the user's initials over a soft accent-tinted background. Guests
 * see the localized guest initials (shown uppercase via style); real signed-in users see whichever
 * `initials` their `AuthUser` carries.
 *
 * Tapping opens the login prompt overlay so guests can sign in at any time.
 * Right-to-left placement is the caller's responsibility — the avatar itself
 * has no edge anchoring.
 */
export function AvatarButton({ size = "md", onPress }: Props) {
  const { tokens } = useTheme();
  const { user, openLoginPrompt } = useAuth();
  const { t } = useTranslation("auth");
  const dims = SIZE_TOKENS[size];

  const initials = user.initials ?? t("guestRower.initials");
  const displayName = user.displayName ?? t("guestRower.name");
  const a11yLabel = user.isGuest
    ? t("avatar.a11yLabelGuest")
    : t("avatar.a11yLabelUser", { name: displayName });

  const handlePress = onPress ?? openLoginPrompt;

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.pressable,
        {
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.circle,
          {
            width: dims.container,
            height: dims.container,
            borderRadius: dims.container / 2,
            backgroundColor: tokens.colors.accentSubtle,
            borderColor: tokens.colors.accentSubtleBorder,
          },
        ]}
      >
        <Text
          style={[
            styles.initials,
            {
              fontSize: dims.font,
              color: tokens.colors.accent,
            },
          ]}
          // Avoid the OS scaling the initials past the circle on aggressive
          // accessibility text-size settings — the Pressable already exposes
          // the full localized name to assistive tech.
          allowFontScaling={false}
        >
          {initials}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  initials: {
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
