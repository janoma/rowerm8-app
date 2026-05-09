/**
 * SettingsRow — thin wrapper over the design-system `<ListRow>`
 * primitive. Kept as its own file so existing call sites in
 * `app/(tabs)/settings/*` don't change; new screens should import
 * `<ListRow>` directly from `@/lib/design-system`.
 *
 * The DS primitive is platform-flavored (`.ios.tsx` / `.android.tsx`),
 * so on Android the row picks up an MD3 ripple state layer for free.
 */

import { ListRow, type ListRowProps } from "@/lib/design-system";

export type SettingsRowProps = ListRowProps;

export function SettingsRow(props: SettingsRowProps) {
  return <ListRow {...props} />;
}
