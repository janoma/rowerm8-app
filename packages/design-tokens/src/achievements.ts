/**
 * Achievement / award color tokens.
 *
 * Bronze / silver / gold are the obvious medal palette; `personalBest`
 * is an indigo deliberately picked to stand outside the HR zone ramp
 * so a "PR" badge can never be confused for "you're in zone 5".
 */

export type AchievementKey = "bronze" | "silver" | "gold" | "personalBest";

export type AchievementTokens = {
  bg: string;
  text: string;
};

export type AchievementPalette = Record<AchievementKey, AchievementTokens>;

export const achievementsLight: AchievementPalette = {
  bronze: { bg: "#CD7F32", text: "#FFFFFF" },
  silver: { bg: "#C0C0C0", text: "#1A1A1A" },
  gold: { bg: "#E8B547", text: "#3A2A05" },
  personalBest: { bg: "#6B5BD6", text: "#FFFFFF" },
};

export const achievementsDark: AchievementPalette = {
  bronze: { bg: "#CD7F32", text: "#FFFFFF" },
  silver: { bg: "#A8A8A8", text: "#0B0B0B" },
  gold: { bg: "#E8B547", text: "#3A2A05" },
  personalBest: { bg: "#8C7DEA", text: "#0B0817" },
};
