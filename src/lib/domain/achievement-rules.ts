// PURE FUNCTION — no imports from infrastructure, no database, no process.env

import type { User } from "@/lib/types";

export type AchievementCondition = {
  metric: "total_workouts" | "total_distance" | "level" | "streak";
  target: number;
};

export function isConditionMet(condition: AchievementCondition, user: User): boolean {
  switch (condition.metric) {
    case "total_workouts":
      return user.totalWorkouts >= condition.target;
    case "total_distance":
      return user.totalDistance >= condition.target;
    case "level":
      return user.level >= condition.target;
    case "streak":
      return user.streak >= condition.target;
    default:
      return false;
  }
}
