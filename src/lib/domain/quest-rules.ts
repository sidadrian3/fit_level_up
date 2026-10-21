import { DomainError } from "./domain-error";
import type { QuestCategory, QuestActivity, QuestMetric } from "@/lib/types";
import { toLocalDay, addDays, startOfWeek } from "@/lib/utils/dates";

export function getPeriodForCategory(category: QuestCategory, now: Date, timeZone: string) {
  const today = toLocalDay(now, timeZone);

  if (category === "daily") {
    return {
      periodStart: today,
      periodEnd: today,
    };
  }

  if (category === "weekly") {
    const monday = startOfWeek(today);

    return {
      periodStart: monday,
      periodEnd: addDays(monday, 6),
    };
  }

  return {
    periodStart: "all-time",
    periodEnd: "all-time",
  };
}

export function calcNextProgress(currentProgress: number, amountToAdd: number, target: number): number {
  return Math.min(currentProgress + amountToAdd, target);
}

export function validateQuestClaim(quest: { completed: boolean; claimed: boolean }): void {
  if (!quest.completed) {
    throw new DomainError("invalid", "Quest is not completed");
  }

  if (quest.claimed) {
    throw new DomainError("conflict", "Quest already claimed");
  }
}

type QuestProgressUpdate = {
  metric: QuestMetric;
  amount: number;
};

type QuestActivityHandler<T extends QuestActivity> = (activity: T) => QuestProgressUpdate[];

const QUEST_ACTIVITY_UPDATES: {
  [K in QuestActivity["type"]]: QuestActivityHandler<Extract<QuestActivity, { type: K }>>
} = {
  workout_created: (_activity) => [
    {
      metric: "workout_count",
      amount: 1,
    },
  ],
  run_created: (activity) => [
    {
      metric: "run_count",
      amount: 1,
    },
    {
      metric: "run_distance",
      amount: activity.distance,
    },
  ],
};

export function getQuestProgressUpdates(activity: QuestActivity): QuestProgressUpdate[] {
  const handler = QUEST_ACTIVITY_UPDATES[activity.type] as QuestActivityHandler<QuestActivity>;
  if (!handler) {
    return [];
  }
  return handler(activity);
}
