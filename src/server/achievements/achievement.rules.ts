import type { AchievementCondition } from "@/shared/achievement-definitions";

type AchievementStats = {
  totalWorkouts: number;
  totalDistance: number;
  level: number;
  streak: number;
};

const STAT_BY_METRIC: Record<AchievementCondition["metric"], (stats: AchievementStats) => number> = {
  total_workouts: (stats) => stats.totalWorkouts,
  total_distance: (stats) => stats.totalDistance,
  level: (stats) => stats.level,
  streak: (stats) => stats.streak,
};

export function isConditionMet(condition: AchievementCondition, stats: AchievementStats): boolean {
  return STAT_BY_METRIC[condition.metric](stats) >= condition.target;
}

export function findNewUnlocks(
  definitions: readonly { id: string; condition: AchievementCondition }[],
  unlockedIds: ReadonlySet<string>,
  stats: AchievementStats,
): string[] {
  return definitions
    .filter((definition) => !unlockedIds.has(definition.id) && isConditionMet(definition.condition, stats))
    .map((definition) => definition.id);
}
