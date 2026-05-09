import type { ComponentProps, ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import type { IconSymbol } from "@/components/ui/icon-symbol";

export type ListRowProps = {
  label: string;
  subtitle?: string;
  /** Optional leading icon. */
  icon?: ComponentProps<typeof IconSymbol>["name"];
  /**
   * Right-side widget. Three values are meaningful:
   *   - `undefined`: when `onPress` is set, draw a chevron; otherwise nothing.
   *   - `null`: never draw anything (used by selector rows that show
   *     a checkmark or nothing).
   *   - any node: rendered as-is (checkmark, switch, value text, …).
   */
  accessory?: ReactNode;
  onPress?: () => void;
  /** Style label in the danger color and announce as destructive. */
  destructive?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};
