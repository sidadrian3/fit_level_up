import { weekInstants } from "@/shared/time/calendar";
import { countUserAchievements } from "@/lib/data/achievements-db";
import { calcLifetimeXp } from "@/server/progression";
import type { DashboardStats, User } from "@/lib/types";
import { countWorkoutsInRange } from "../workouts/workout.repository";
import { sumDistanceInRange } from "../runs/run.repository";

export async function getDashboardStats(userId: string, user: Pick<User, "timeZone" | "level" | "xp">, now: Date = new Date()): Promise<DashboardStats> {
    const { lastWeekFrom, thisWeekFrom, nextWeekFrom } = weekInstants(now, user.timeZone);

    const [weeklyWorkouts, lastWeekWorkouts, weeklyDistance, totalAchievements] = await Promise.all([
        countWorkoutsInRange(userId, thisWeekFrom, nextWeekFrom),
        countWorkoutsInRange(userId, lastWeekFrom, thisWeekFrom),
        sumDistanceInRange(userId, thisWeekFrom, nextWeekFrom),
        countUserAchievements(userId),
    ]);

    return {
        weeklyWorkouts,
        lastWeekWorkouts,
        weeklyDistance,
        totalAchievements,
        lifetimeXP: calcLifetimeXp(user.level, user.xp),
    };
}
