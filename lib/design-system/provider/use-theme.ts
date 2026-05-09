/**
 * Public hook: subscribes to the design-system `Theme` and
 * returns it.
 *
 * Components should always use *this* hook (re-exported from
 * `@/lib/design-system`) so they don't import the provider's
 * implementation file directly.
 */

import { type Theme, useThemeContext } from "./theme-context";

export function useTheme(): Theme {
  return useThemeContext();
}

export type { Theme };
