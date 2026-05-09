/**
 * Switch — themed wrapper around React Native's `Switch`.
 *
 * Threads our `accent` token through `trackColor.true` so the toggle
 * matches the rest of the brand. RN's `Switch` already renders the
 * native UISwitch on iOS and a Material thumb on Android, so the only
 * thing we need to override per-platform is the colors.
 *
 * Same component on iOS, Android, and web — no `.ios` / `.android`
 * splits needed because the native widget itself handles the
 * platform-shape differences for us.
 */

import {
  Switch as RNSwitch,
  type SwitchProps as RNSwitchProps,
} from "react-native";

import { useTheme } from "../provider";

export type SwitchProps = Pick<
  RNSwitchProps,
  "value" | "onValueChange" | "disabled" | "accessibilityLabel" | "testID"
>;

export function Switch(props: SwitchProps) {
  const { tokens } = useTheme();
  return (
    <RNSwitch
      {...props}
      trackColor={{
        false: tokens.colors.borderStrong,
        true: tokens.colors.accent,
      }}
      thumbColor={tokens.colors.surface}
      ios_backgroundColor={tokens.colors.borderStrong}
    />
  );
}
