import { weekInstants } from "@/shared/time/calendar";
import { calcLifetimeXp } from "@/server/progression";
import type { DashboardStats } from "@/shared/contracts/stats";
import type { User } from "@/shared/contracts/user";
import { countWorkoutsInRange, findLiftMaxes, findWorkoutDatesInRange } from "../workouts/workout.repository";
import { findFastestRunInWindow, findLongestRun, sumDistanceInRange } from "../runs/run.repository";
import type { PersonalRecord } from "@/shared/contracts/personal-record";
import {
  FIVE_K_WINDOW_KM,
  TEN_K_WINDOW_KM,
  TOP_LIFT_COUNT,
  buildPersonalRecords,
  calcActiveDays,
} from "./stats.rules";

type DashboardStatsOptions = {
    countAchievements: (userId: string) => Promise<number>;
    now?: Date;
};

export async function getDashboardStats(
    userId: string,
    user: Pick<User, "timeZone" | "level" | "xp">,
    { countAchievements, now = new Date() }: DashboardStatsOptions,
): Promise<DashboardStats> {
    const { lastWeekFrom, thisWeekFrom, nextWeekFrom } = weekInstants(now, user.timeZone);

    const [weeklyWorkouts, lastWeekWorkouts, weeklyDistance, totalAchievements] = await Promise.all([
        countWorkoutsInRange(userId, thisWeekFrom, nextWeekFrom),
        countWorkoutsInRange(userId, lastWeekFrom, thisWeekFrom),
        sumDistanceInRange(userId, thisWeekFrom, nextWeekFrom),
        countAchievements(userId),
    ]);

    return {
        weeklyWorkouts,
        lastWeekWorkouts,
        weeklyDistance,
        totalAchievements,
        lifetimeXP: calcLifetimeXp(user.level, user.xp),
    };
}

export async function getPersonalRecords(userId: string): Promise<PersonalRecord[]> {
    const [liftMaxes, longest, fastest5k, fastest10k] = await Promise.all([
        findLiftMaxes(userId, TOP_LIFT_COUNT),
        findLongestRun(userId),
        findFastestRunInWindow(userId, FIVE_K_WINDOW_KM),
        findFastestRunInWindow(userId, TEN_K_WINDOW_KM),
    ]);
    return buildPersonalRecords(liftMaxes, { longest, fastest5k, fastest10k });
}

export async function getActiveDaysThisWeek(
    userId: string,
    { timeZone, now = new Date() }: { timeZone: string; now?: Date },
): Promise<boolean[]> {
    const { thisWeekFrom, nextWeekFrom } = weekInstants(now, timeZone);
    const instants = await findWorkoutDatesInRange(userId, thisWeekFrom, nextWeekFrom);
    return calcActiveDays(instants, now, timeZone);
}
