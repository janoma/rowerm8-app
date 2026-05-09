import type { ReactNode } from "react";

export type AppHeaderProps = {
  title: string;
  /** Optional sub-line under the title. */
  subtitle?: string;
  /** Press handler for the back affordance. Hides the affordance if omitted. */
  onBack?: () => void;
  /**
   * Override the back label (iOS only — Android shows the back arrow
   * with no text). Defaults to the localized "Back" string.
   */
  backLabel?: string;
  /**
   * Custom leading-slot content. When provided, replaces the default
   * back affordance entirely — used by modal-style screens that show
   * a "Cancel" text button instead of the chevron-back pattern.
   */
  leading?: ReactNode;
  /** Right-side widget (e.g. an action button or icon). */
  trailing?: ReactNode;
};
