import type { ReactNode } from "react";

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Optional title rendered in the sheet header. */
  title?: string;
  /**
   * When true, dismisses on backdrop press (default `true`). Set to
   * `false` for sheets that must show an explicit Cancel button.
   */
  dismissOnBackdrop?: boolean;
};
