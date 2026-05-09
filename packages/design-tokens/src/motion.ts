/**
 * Animation tokens — durations and easings.
 *
 * Bezier curves match the Material Design 3 motion specs since
 * `Easing` from `react-native-reanimated` does not export the same
 * semantic names: we expose curves as 4-tuples consumers can feed to
 * `Easing.bezier(...curve)` themselves.
 */

export const duration = {
  /** 120 ms — micro-interactions (haptic confirmation, ripple). */
  fast: 120,
  /** 200 ms — default transition (sheet open, card flip). */
  base: 200,
  /** 320 ms — full-screen modal slide. */
  slow: 320,
} as const;

export type DurationToken = keyof typeof duration;

export const easing = {
  /** Standard ease — most general transitions. */
  standard: [0.2, 0.0, 0.0, 1.0] as const,
  /** Emphasized ease — for "important" moments (record start/finish). */
  emphasized: [0.3, 0.0, 0.0, 1.0] as const,
  /** Decelerated — entering content slows to a stop. */
  decelerated: [0.0, 0.0, 0.0, 1.0] as const,
  /** Accelerated — exiting content speeds away. */
  accelerated: [0.3, 0.0, 1.0, 1.0] as const,
} as const;

export type EasingToken = keyof typeof easing;

export const motion = { duration, easing } as const;
export type MotionTokens = typeof motion;
