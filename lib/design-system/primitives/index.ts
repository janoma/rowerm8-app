/**
 * Public barrel for design-system primitives.
 *
 * Components and screens import from `@/lib/design-system` (which
 * re-exports this barrel) so the file paths can change without
 * touching every call site.
 *
 * Platform-flavored primitives (Button, ListRow, Sheet, AppHeader)
 * are exported as a single name; Metro picks the `.ios` /
 * `.android` variant automatically based on the build target.
 */

export * from "./app-header";
export type { AppHeaderProps } from "./app-header.shared";

export * from "./badge";
export * from "./banner";
export * from "./button";
export type {
  ButtonProps,
  ButtonSize,
  ButtonTone,
  ButtonVariant,
} from "./button.shared";

export * from "./card";
export * from "./chart-card";
export * from "./chip";
export * from "./divider";
export * from "./empty-state";
export * from "./icon";
export * from "./launcher-card";

export * from "./list-row";
export type { ListRowProps } from "./list-row.shared";

export * from "./sheet";
export type { SheetProps } from "./sheet.shared";

export * from "./sparkline";
export * from "./stack";
export * from "./stat";
export * from "./status-pill";
export * from "./summary-row";
export * from "./switch";
export * from "./zone-bar";
export * from "./zone-pill";
