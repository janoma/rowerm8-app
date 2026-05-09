/**
 * Public entry-point for the in-app design system.
 *
 * Components and screens import from `@/lib/design-system` (or one of
 * its sub-paths) and never reach into the provider's implementation
 * file directly. This keeps the file layout free to change later.
 */

export * from "./primitives";
export * from "./provider";
export * from "./tokens";
