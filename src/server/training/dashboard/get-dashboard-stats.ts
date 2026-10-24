import { weekInstants } from "@/shared/time/calendar";
import { calcLifetimeXp } from "@/server/progression";
import type { DashboardStats, User } from "@/lib/types";
import { countWorkoutsInRange } from "../workouts/workout.repository";
import { sumDistanceInRange } from "../runs/run.repository";

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
