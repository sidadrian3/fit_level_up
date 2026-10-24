import type { Achievement } from "@/lib/types";

export type AchievementCondition = {
  metric: "total_workouts" | "total_distance" | "level" | "streak";
  target: number;
};

type AchievementDefinition = {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: Achievement["rarity"];
  condition: AchievementCondition;
};

export const ACHIEVEMENT_DEFINITIONS = [
  {
    id: "first_workout",
    title: "First Steps",
    description: "Complete your first workout",
    icon: "footprints",
    rarity: "common",
    condition: { metric: "total_workouts", target: 1 },
  },
  {
    id: "speed_demon",
    title: "Speed Demon",
    description: "Run a total of 5 km",
    icon: "zap",
    rarity: "rare",
    condition: { metric: "total_distance", target: 5 },
  },
  {
    id: "iron_will",
    title: "Iron Will",
    description: "Complete 50 workouts",
    icon: "shield",
    rarity: "epic",
    condition: { metric: "total_workouts", target: 50 },
  },
  {
    id: "unstoppable",
    title: "Unstoppable",
    description: "Reach a 30-day streak",
    icon: "flame",
    rarity: "epic",
    condition: { metric: "streak", target: 30 },
  },
  {
    id: "legendary_warrior",
    title: "Legendary Warrior",
    description: "Reach level 25",
    icon: "crown",
    rarity: "legendary",
    condition: { metric: "level", target: 25 },
  },
] as const satisfies readonly AchievementDefinition[];
