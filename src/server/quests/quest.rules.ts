import { DomainError } from "@/server/platform/domain";
import type { QuestCategory, QuestActivity, QuestMetric } from "@/lib/types";
import { toLocalDay, addDays, startOfWeek, startOfLocalDay } from "@/shared/time/calendar";

export type QuestCalendar = { now: Date; timeZone: string };

export type QuestPeriod = { periodStart: string | null; periodEnd: string | null };

export function getPeriodForCategory(category: QuestCategory, now: Date, timeZone: string): QuestPeriod {
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
    periodStart: null,
    periodEnd: null,
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
  workout_created: () => [
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

export function periodRange(period: QuestPeriod, timeZone: string): { from: Date; toExclusive: Date } | null {
  if (period.periodStart === null || period.periodEnd === null) return null;

  return {
    from: startOfLocalDay(period.periodStart, timeZone),
    toExclusive: startOfLocalDay(addDays(period.periodEnd, 1), timeZone),
  };
}
