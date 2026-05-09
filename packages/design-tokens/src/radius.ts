/**
 * Corner-radius tokens.
 *
 * `xs`/`sm` for badges and chips, `md` for inline buttons, `lg` for
 * cards (the dominant radius today), `xl` for sheets and large
 * modal containers, `pill` for fully-rounded badges/buttons.
 */

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radius;
export type RadiusScale = typeof radius;
