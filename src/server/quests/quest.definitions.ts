import type { QuestCategory } from "@/shared/contracts/quest";
import type { QuestMetric } from "./quest.rules";

type QuestDefinition = {
  title: string;
  description: string;
  category: QuestCategory;
  metric: QuestMetric;
  target: number;
  xpReward: number;
  icon: string;
  // Title the quest was seeded with; lets the id migration map old rows. Deleted with the 5.1 cleanup.
  legacyTitle: string;
};

export const QUEST_DEFINITIONS = {
  daily_workout_1: {
    title: "Daily Burn",
    description: "Log at least 1 workout today.",
    category: "daily",
    metric: "workout_count",
    target: 1,
    xpReward: 100,
    icon: "dumbbell",
    legacyTitle: "Daily Burn",
  },
  daily_run_2km: {
    title: "Daily Steps",
    description: "Go for a quick 2km run today.",
    category: "daily",
    metric: "run_distance",
    target: 2,
    xpReward: 100,
    icon: "footprints",
    legacyTitle: "Daily Steps",
  },
  weekly_workouts_3: {
    title: "Weekly Consistency",
    description: "Log 3 workouts this week.",
    category: "weekly",
    metric: "workout_count",
    target: 3,
    xpReward: 500,
    icon: "calendar",
    legacyTitle: "Weekly Consistency",
  },
  weekly_run_15km: {
    title: "Marathon Prep",
    description: "Run a total of 15km this week.",
    category: "weekly",
    metric: "run_distance",
    target: 15,
    xpReward: 600,
    icon: "zap",
    legacyTitle: "Marathon Prep",
  },
  weekend_run_1: {
    title: "Weekend Warrior",
    description: "Log 1 run this weekend.",
    category: "special",
    metric: "run_count",
    target: 1,
    xpReward: 300,
    icon: "flame",
    legacyTitle: "Weekend Warrior",
  },
} as const satisfies Record<string, QuestDefinition>;

export type QuestId = keyof typeof QUEST_DEFINITIONS;

export function getQuestDefinition(id: QuestId): (typeof QUEST_DEFINITIONS)[QuestId] {
  return QUEST_DEFINITIONS[id];
}
